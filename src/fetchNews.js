import Parser from 'rss-parser';
import { SOURCES, FOOTBALL_DATA_URL } from './config.js';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'daily-podcast-pipeline/1.0' },
});

function stripHtml(str = '') {
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, source.max).map((item) => ({
      title: stripHtml(item.title || ''),
      summary: stripHtml(item.contentSnippet || item.summary || '').slice(0, 300),
      link: item.link,
      pubDate: item.pubDate,
    }));
    return { category: source.category, name: source.name, items, error: null };
  } catch (err) {
    return { category: source.category, name: source.name, items: [], error: err.message };
  }
}

async function fetchFootballData(apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch(FOOTBALL_DATA_URL, {
      headers: { 'X-Auth-Token': apiKey },
    });
    if (!res.ok) throw new Error(`football-data.org HTTP ${res.status}`);
    const data = await res.json();
    const matches = (data.matches || []).slice(0, 10).map((m) => {
      const home = m.homeTeam?.name;
      const away = m.awayTeam?.name;
      if (m.status === 'FINISHED') {
        return `${home} ${m.score.fullTime.home} - ${m.score.fullTime.away} ${away}`;
      }
      const date = new Date(m.utcDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `Upcoming: ${home} vs ${away} (${date})`;
    });
    return matches;
  } catch (err) {
    return null;
  }
}

export async function fetchAllNews(config) {
  const results = await Promise.all(SOURCES.map(fetchSource));
  const footballMatches = await fetchFootballData(config.footballDataApiKey);

  const byCategory = new Map();
  for (const result of results) {
    if (!byCategory.has(result.category)) byCategory.set(result.category, []);
    byCategory.get(result.category).push(result);
  }

  if (footballMatches && footballMatches.length) {
    byCategory.set('Premier League', [
      { name: 'Official fixtures & results (football-data.org)', items: footballMatches.map((m) => ({ title: m })), error: null },
      ...(byCategory.get('Premier League') || []),
    ]);
  }

  return Array.from(byCategory.entries()).map(([category, sources]) => ({ category, sources }));
}

export function digestToText(digest) {
  const lines = [];
  for (const { category, sources } of digest) {
    lines.push(`## ${category}`);
    for (const source of sources) {
      if (source.error) {
        lines.push(`- (${source.name}: feed unavailable — ${source.error})`);
        continue;
      }
      if (!source.items.length) {
        lines.push(`- (${source.name}: no items today)`);
        continue;
      }
      for (const item of source.items) {
        const bits = [item.title];
        if (item.summary) bits.push(`— ${item.summary}`);
        lines.push(`- ${bits.join(' ')}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}
