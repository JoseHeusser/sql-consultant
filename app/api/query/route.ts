import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SCHEMA_DESCRIPTION } from '@/app/lib/schema';

export const runtime = 'nodejs';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-haiku-4-5-20251001';

// Strip code fences from LLM SQL output
function extractSQL(text: string): string {
  const fence = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured on the server.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null) as
    | { mode: 'sql'; question: string }
    | { mode: 'summary'; question: string; sql: string; rows: unknown[] }
    | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    if (body.mode === 'sql') {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system:
          SCHEMA_DESCRIPTION +
          '\n\nRespond with a single SQL query and NOTHING ELSE. No explanation, no markdown fences.',
        messages: [{ role: 'user', content: body.question }],
      });
      const text = res.content
        .filter(b => b.type === 'text')
        .map(b => (b as { text: string }).text)
        .join('');
      return NextResponse.json({ sql: extractSQL(text) });
    }

    if (body.mode === 'summary') {
      const preview = JSON.stringify(body.rows.slice(0, 50), null, 2);
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system:
          'You are a senior real-estate analyst helping non-technical stakeholders ' +
          'interpret query results from a database of 5,000 commercial properties in Berlin. ' +
          'Reply in clear English. Keep responses 2–4 sentences, factual, no preamble. ' +
          'Cite specific numbers from the data.',
        messages: [
          {
            role: 'user',
            content:
              `Question: ${body.question}\n\nSQL used:\n${body.sql}\n\n` +
              `Results (first 50 rows):\n${preview}\n\nInterpret these results.`,
          },
        ],
      });
      const text = res.content
        .filter(b => b.type === 'text')
        .map(b => (b as { text: string }).text)
        .join('');
      return NextResponse.json({ summary: text.trim() });
    }

    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
  } catch (e) {
    const msg = (e as Error).message ?? 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
