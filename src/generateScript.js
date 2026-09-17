const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function buildPrompt({ digestText, hostAName, hostBName, dateLabel }) {
  return `You are writing today's script for a short daily two-host news podcast called "the Daily Briefing", dated ${dateLabel}.

Hosts: ${hostAName} and ${hostBName}. They have a warm, quick, knowledgeable rapport — think NPR meets a tech podcast. Keep it conversational, not a list read-aloud: react to items, banter briefly, but stay tight and information-dense. Total spoken length should be about 6-9 minutes (roughly 900-1300 words total across both hosts).

Cover, in this order, using the research notes below:
1. Cold open / quick welcome (a couple of sentences).
2. AI industry news — OpenAI, Anthropic, Google, Microsoft.
3. Salesforce & Agentforce partner-ecosystem news.
4. Premier League results and upcoming fixtures.
5. Top headlines: Ireland, Bend Oregon, USA, and the world — briefly.
6. Quick, warm sign-off.

Research notes (raw headlines pulled from RSS feeds today — use judgment, skip anything that looks like a duplicate, irrelevant, or a broken/empty feed; do not read out URLs):
"""
${digestText}
"""

Output STRICT JSON only, no markdown fences, no commentary — an array of turn objects:
[{"speaker": "A", "text": "..."}, {"speaker": "B", "text": "..."}, ...]

"speaker" is "A" for ${hostAName} or "B" for ${hostBName}. Each "text" is one natural spoken turn (1-4 sentences). Do not include any text outside the JSON array.`;
}

function extractJsonArray(raw) {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error(`Claude response did not contain a JSON array:\n${raw}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function generateScript(config, digestText) {
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const prompt = buildPrompt({
    digestText,
    hostAName: config.hostAName,
    hostBName: config.hostBName,
    dateLabel,
  });

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.claudeModel,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const raw = (data.content || []).map((block) => block.text || '').join('');
  const turns = extractJsonArray(raw);

  return turns
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .map((t) => ({
      speaker: t.speaker === 'B' ? 'B' : 'A',
      text: t.text.trim(),
    }));
}
