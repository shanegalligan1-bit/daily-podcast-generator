function googleNews(query, opts = {}) {
  const params = new URLSearchParams({
    q: query,
    hl: opts.hl || 'en-US',
    gl: opts.gl || 'US',
    ceid: opts.ceid || 'US:en',
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

// Each entry: { category, name, url, max } — plain RSS/Atom feeds pulled
// with rss-parser. Google News search feeds require no API key and stay
// reliable even when a given company's own blog RSS moves or disappears.
export const SOURCES = [
  // --- Major AI labs ---
  { category: 'AI Industry', name: 'OpenAI', url: googleNews('OpenAI'), max: 4 },
  { category: 'AI Industry', name: 'Anthropic', url: googleNews('Anthropic AI'), max: 4 },
  { category: 'AI Industry', name: 'Google AI', url: googleNews('Google AI OR "Google DeepMind"'), max: 4 },
  { category: 'AI Industry', name: 'Microsoft AI', url: googleNews('Microsoft AI OR Copilot AI'), max: 4 },

  // --- Salesforce / Agentforce partner ecosystem ---
  { category: 'Salesforce Ecosystem', name: 'Salesforce & Agentforce', url: googleNews('Salesforce Agentforce OR "Salesforce partner ecosystem"'), max: 5 },

  // --- Premier League ---
  { category: 'Premier League', name: 'Premier League results & fixtures', url: googleNews('Premier League results fixtures'), max: 5 },

  // --- Local / national / world news ---
  { category: 'Ireland', name: 'Ireland news', url: googleNews('Ireland', { hl: 'en-IE', gl: 'IE', ceid: 'IE:en' }), max: 4 },
  { category: 'Bend, Oregon', name: 'Bend, Oregon news', url: googleNews('"Bend, Oregon"'), max: 3 },
  { category: 'USA', name: 'US top news', url: googleNews('top news', { hl: 'en-US', gl: 'US', ceid: 'US:en' }), max: 4 },
  { category: 'World', name: 'World top news', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', max: 4 },
];

export const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/PL/matches?status=FINISHED,SCHEDULED';

export function loadRuntimeConfig(env = process.env) {
  const required = [
    'ANTHROPIC_API_KEY',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID_HOST_A',
    'ELEVENLABS_VOICE_ID_HOST_B',
    'PODCAST_SLUG',
  ];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const repo = env.GITHUB_REPOSITORY; // "owner/repo" when running in Actions
  let defaultBaseUrl;
  if (repo) {
    const [owner, name] = repo.split('/');
    defaultBaseUrl = `https://${owner}.github.io/${name}`;
  }

  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    claudeModel: env.CLAUDE_MODEL || 'claude-sonnet-5',
    elevenLabsApiKey: env.ELEVENLABS_API_KEY,
    elevenLabsModelId: env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    voiceHostA: env.ELEVENLABS_VOICE_ID_HOST_A,
    voiceHostB: env.ELEVENLABS_VOICE_ID_HOST_B,
    hostAName: env.HOST_A_NAME || 'Alex',
    hostBName: env.HOST_B_NAME || 'Jordan',
    podcastSlug: env.PODCAST_SLUG,
    podcastBaseUrl: (env.PODCAST_BASE_URL || defaultBaseUrl || '').replace(/\/+$/, ''),
    podcastTitle: env.PODCAST_TITLE || 'Daily Briefing',
    podcastAuthor: env.PODCAST_AUTHOR || 'Daily Briefing',
    podcastEmail: env.PODCAST_EMAIL || 'noreply@example.com',
    footballDataApiKey: env.FOOTBALL_DATA_API_KEY || '',
  };
}
