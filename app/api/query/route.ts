import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SCHEMA_DESCRIPTION } from '@/app/lib/schema';
import { runReadOnlyQuery } from '@/app/lib/supabase';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

function extractSQL(text: string): string {
  const fence = text.match(/```(?:sql|postgres)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
}

function isSafeSelect(sql: string): boolean {
  const s = sql.trim().toLowerCase();
  if (!(s.startsWith('select') || s.startsWith('with'))) return false;
  // Block obvious mutating keywords even though our DB role is read-only.
  const blocked = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create\s+(table|index|view|schema)|copy|vacuum)\b/i;
  return !blocked.test(sql);
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set.' }, { status: 500 });
  }

  const body = await req.json().catch(() => null) as
    | { mode: 'sql'; question: string }
    | { mode: 'run'; sql: string }
    | { mode: 'summary'; question: string; sql: string; rows: unknown[] }
    | null;

  if (!body) return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });

  try {
    if (body.mode === 'sql') {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 600,
        system:
          SCHEMA_DESCRIPTION +
          '\n\nRespond with a single SQL query and NOTHING ELSE. No explanation, no markdown fences.',
        messages: [{ role: 'user', content: body.question }],
      });
      const text = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
      const sql = extractSQL(text);
      return NextResponse.json({ sql });
    }

    if (body.mode === 'run') {
      if (!isSafeSelect(body.sql)) {
        return NextResponse.json({ error: 'Only SELECT queries are allowed.' }, { status: 400 });
      }
      const { rows, error } = await runReadOnlyQuery(body.sql);
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ rows });
    }

    if (body.mode === 'summary') {
      const preview = JSON.stringify(body.rows.slice(0, 50), null, 2);
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 400,
        system:
          'You are an urban-data analyst helping non-technical readers interpret ' +
          'results from a SQL query against Berlin\'s tree cadaster. ' +
          'Reply in clear English. 2–4 sentences max. Cite specific numbers. No preamble.',
        messages: [{
          role: 'user',
          content:
            `Question: ${body.question}\n\nSQL used:\n${body.sql}\n\n` +
            `Results (first 50 rows):\n${preview}\n\nInterpret these results.`,
        }],
      });
      const text = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
      return NextResponse.json({ summary: text.trim() });
    }

    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Unknown error' }, { status: 500 });
  }
}
