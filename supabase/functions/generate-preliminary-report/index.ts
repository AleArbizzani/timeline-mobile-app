// Supabase Edge Function: Generate preliminary report from runsheet using Claude API
// Invoke with: POST body { match, officials, runsheetText }
// Requires: Authorization: Bearer <session.access_token>

import * as jose from 'jsr:@panva/jose@6';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const JWT_ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWKS = jose.createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

async function verifyJWT(req: Request): Promise<{ ok: true } | { ok: false; status: number; body: object }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, body: { error: 'missing_authorization' } };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, body: { error: 'missing_token' } };
  }
  try {
    await jose.jwtVerify(token, JWKS, { issuer: JWT_ISSUER });
    return { ok: true };
  } catch {
    return { ok: false, status: 401, body: { error: 'invalid_jwt' } };
  }
}

function buildSystemPrompt() {
  return `You are an expert match analyst. Given a runsheet of incidents from a game, produce a brief preliminary report for each match official.

For each official, your report must include:
- Number of yellow cards and red cards shown (when relevant to that official)
- Key patterns observed (e.g. coach complaints, recurring issues)
- Consider any comments noted on incidents - these often contain important context from the coach or match

Be concise and factual. Use plain language. Focus on what happened from the runsheet data provided.`;
}

function buildUserPrompt(payload: {
  match: { home_team?: string; away_team?: string; competition?: string; ground?: string };
  officials: Array<{ role: string; full_name?: string }>;
  runsheetText: string;
}) {
  const { match, officials, runsheetText } = payload;
  const matchLine = `Match: ${match?.home_team ?? 'Home'} vs ${match?.away_team ?? 'Away'}, ${match?.competition ?? 'Competition'}, ${match?.ground ?? 'Venue'}`;
  const officialsLine = officials
    .filter((o) => o?.role && o?.full_name)
    .map((o) => `${o.role}: ${o.full_name}`)
    .join(', ');
  return `${matchLine}
Officials: ${officialsLine}

RUNSHEET (each incident includes period, time, official, type, sanction codes, and any comments):
${runsheetText || '(No incidents recorded)'}

Analyze the runsheet and return a JSON object with one key per official role (REF, AR1, AR2, FOURTH - only include roles that exist in the officials list above). Each value is a brief preliminary report paragraph for that official. Example format:
{"REF": "Brief report for referee...", "AR1": "Brief report for AR1...", ...}

Return ONLY valid JSON, no markdown or extra text.`;
}

function parseJsonResponse(text: string): Record<string, string> {
  // Strip potential markdown code blocks
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned) as Record<string, string>;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authResult = await verifyJWT(req);
  if (!authResult.ok) {
    return new Response(JSON.stringify(authResult.body), {
      status: authResult.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json();
    const { match, officials, runsheetText } = body;

    if (!match || !officials || !Array.isArray(officials)) {
      return new Response(
        JSON.stringify({ error: 'Missing match, officials, or runsheetText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      match,
      officials,
      runsheetText: runsheetText ?? '',
    });

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return new Response(
        JSON.stringify({ error: 'Claude API request failed', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const contentBlocks = data?.content ?? [];
    const textBlock = contentBlocks.find((b) => b?.type === 'text');
    const text = textBlock?.text ?? '';

    const sections = parseJsonResponse(text);

    return new Response(JSON.stringify({ sections }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
