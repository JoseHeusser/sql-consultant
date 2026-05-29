/**
 * Live MCP server for the Berlin tree cadaster, hosted inside this Next.js app
 * via mcp-handler (Streamable HTTP). Exposes the same read-only tools as the
 * stdio berlin-trees-mcp package, so any remote MCP client can connect to:
 *
 *   https://sql-consultant.vercel.app/api/mcp
 *
 * Protected by a bearer token (MCP_AUTH_TOKEN). All queries run through the
 * read-only run_query RPC, so the endpoint can never modify data.
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { runReadOnlyQuery } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

// --- SQL helpers ------------------------------------------------------------

function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function tableExpr(scope: "street" | "park" | "all"): string {
  if (scope === "street") return "street_trees";
  if (scope === "park") return "park_trees";
  return "(SELECT * FROM street_trees UNION ALL SELECT * FROM park_trees) AS trees";
}

const BEZIRKE = [
  "Mitte", "Friedrichshain-Kreuzberg", "Pankow", "Charlottenburg-Wilmersdorf",
  "Spandau", "Steglitz-Zehlendorf", "Tempelhof-Schöneberg", "Neukölln",
  "Treptow-Köpenick", "Marzahn-Hellersdorf", "Lichtenberg", "Reinickendorf",
];

function asText(rows: Record<string, unknown>[], note?: string) {
  const header = note ? note + "\n" : "";
  const body = rows.length === 0 ? "No rows returned." : JSON.stringify(rows, null, 2);
  return { content: [{ type: "text" as const, text: header + body }] };
}

function asError(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
}

// --- MCP handler ------------------------------------------------------------

const mcpHandler = createMcpHandler(
  (server) => {
    server.tool(
      "count_trees_by_district",
      "Count trees grouped by Berlin district (Bezirk). Optional species filter (German common name).",
      {
        scope: z.enum(["street", "park", "all"]).default("all"),
        species: z.string().optional(),
      },
      async ({ scope, species }) => {
        const where = species
          ? `WHERE unaccent(art_dtsch) ILIKE unaccent(${lit("%" + species + "%")})`
          : "";
        const sql = `SELECT bezirk, COUNT(*)::int AS tree_count FROM ${tableExpr(scope)} ${where} GROUP BY bezirk ORDER BY tree_count DESC;`;
        const { rows, error } = await runReadOnlyQuery(sql);
        return error ? asError(error) : asText(rows);
      }
    );

    server.tool(
      "search_trees",
      "Search individual trees by species/district/street, returning lat/lng and key attributes.",
      {
        scope: z.enum(["street", "park", "all"]).default("all"),
        species: z.string().optional(),
        district: z.string().optional().describe(`One of: ${BEZIRKE.join(", ")}`),
        street: z.string().optional(),
        min_height_m: z.number().optional(),
        limit: z.number().int().min(1).max(5000).default(50),
      },
      async ({ scope, species, district, street, min_height_m, limit }) => {
        const c: string[] = [];
        if (species) c.push(`unaccent(art_dtsch) ILIKE unaccent(${lit("%" + species + "%")})`);
        if (district) c.push(`bezirk = ${lit(district)}`);
        if (street) c.push(`unaccent(strname) ILIKE unaccent(${lit("%" + street + "%")})`);
        if (typeof min_height_m === "number") c.push(`baumhoehe >= ${min_height_m}`);
        c.push(`lat IS NOT NULL AND lng IS NOT NULL`);
        const sql = `SELECT bezirk, strname, art_dtsch, art_bot, baumhoehe, standalter, lat, lng FROM ${tableExpr(scope)} WHERE ${c.join(" AND ")} ORDER BY baumhoehe DESC NULLS LAST LIMIT ${limit};`;
        const { rows, error } = await runReadOnlyQuery(sql);
        return error ? asError(error) : asText(rows, `${rows.length} tree(s):`);
      }
    );

    server.tool(
      "find_extreme_trees",
      "Find the oldest / tallest / largest-crown / thickest-trunk trees (NULL-safe). Optional district.",
      {
        scope: z.enum(["street", "park", "all"]).default("all"),
        metric: z.enum(["oldest", "tallest", "largest_crown", "thickest_trunk"]),
        district: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(10),
      },
      async ({ scope, metric, district, limit }) => {
        const col = { oldest: "standalter", tallest: "baumhoehe", largest_crown: "kronedurch", thickest_trunk: "stammumfg" }[metric];
        const c = [`${col} IS NOT NULL`, `${col} > 0`, `lat IS NOT NULL`, `lng IS NOT NULL`];
        if (district) c.push(`bezirk = ${lit(district)}`);
        const sql = `SELECT * FROM (SELECT bezirk, strname, art_dtsch, ${col} AS metric_value, lat, lng FROM ${tableExpr(scope)} WHERE ${c.join(" AND ")}) t ORDER BY metric_value DESC LIMIT ${limit};`;
        const { rows, error } = await runReadOnlyQuery(sql);
        return error ? asError(error) : asText(rows, `Top ${rows.length} by ${metric}:`);
      }
    );

    server.tool(
      "tree_statistics",
      "Summary stats: total count, avg height, avg age, distinct species.",
      { scope: z.enum(["street", "park", "all"]).default("all") },
      async ({ scope }) => {
        const sql = `SELECT COUNT(*)::int AS total_trees, ROUND(AVG(baumhoehe) FILTER (WHERE baumhoehe > 0)::numeric, 1) AS avg_height_m, ROUND(AVG(standalter) FILTER (WHERE standalter > 0)::numeric, 1) AS avg_age_years, COUNT(DISTINCT art_dtsch)::int AS distinct_species FROM ${tableExpr(scope)};`;
        const { rows, error } = await runReadOnlyQuery(sql);
        return error ? asError(error) : asText(rows);
      }
    );

    server.tool(
      "run_readonly_sql",
      "Run an arbitrary read-only SQL query (SELECT/WITH only) against street_trees / park_trees. Wrap text matching in unaccent().",
      { query: z.string() },
      async ({ query }) => {
        const { rows, error } = await runReadOnlyQuery(query);
        return error ? asError(error) : asText(rows, `${rows.length} row(s):`);
      }
    );
  },
  {},
  { basePath: "/api" }
);

// --- Bearer-token auth wrapper ----------------------------------------------

function withAuth(handler: (req: Request) => Promise<Response> | Response) {
  return async (req: Request): Promise<Response> => {
    const expected = process.env.MCP_AUTH_TOKEN;
    const provided = req.headers.get("authorization");
    if (!expected || provided !== `Bearer ${expected}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return handler(req);
  };
}

const authed = withAuth(mcpHandler);

export { authed as GET, authed as POST, authed as DELETE };
