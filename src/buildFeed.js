import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const MAX_EPISODES = 60;

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function loadEpisodes(episodesFile) {
  try {
    const raw = await readFile(episodesFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function renderFeedXml(config, episodes) {
  const items = episodes.map((ep) => `
    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <pubDate>${ep.pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(ep.guid)}</guid>
      <enclosure url="${escapeXml(ep.audioUrl)}" length="${ep.fileSizeBytes}" type="audio/mpeg" />
      <itunes:duration>${ep.durationSeconds || ''}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
    </item>`).join('\n');

  const feedUrl = `${config.podcastBaseUrl}/podcast/${config.podcastSlug}/feed.xml`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.podcastTitle)}</title>
    <link>${escapeXml(config.podcastBaseUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <description>${escapeXml(`${config.podcastTitle}: a daily two-host briefing on AI industry news, the Salesforce/Agentforce partner ecosystem, Premier League results, and top headlines.`)}</description>
    <itunes:author>${escapeXml(config.podcastAuthor)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(config.podcastAuthor)}</itunes:name>
      <itunes:email>${escapeXml(config.podcastEmail)}</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="News" />
${items}
  </channel>
</rss>
`;
}

// Appends today's episode to the persisted episode list, then writes the
// public feed.xml and returns the paths that need to be committed/published.
export async function buildFeed(config, { audioFilePath, audioFileSizeBytes, docsDir, episodesFile, description }) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const episodes = await loadEpisodes(episodesFile);

  const audioUrl = `${config.podcastBaseUrl}/podcast/${config.podcastSlug}/audio/${dateStr}.mp3`;

  const newEpisode = {
    title: `${config.podcastTitle} — ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
    description,
    pubDate: today.toUTCString(),
    guid: `${config.podcastSlug}-${dateStr}`,
    audioUrl,
    fileSizeBytes: audioFileSizeBytes,
    durationSeconds: '',
  };

  // Replace any existing entry for today (e.g. a re-run) instead of duplicating.
  const filtered = episodes.filter((ep) => ep.guid !== newEpisode.guid);
  const updated = [newEpisode, ...filtered].slice(0, MAX_EPISODES);

  await mkdir(path.dirname(episodesFile), { recursive: true });
  await writeFile(episodesFile, JSON.stringify(updated, null, 2));

  const feedDir = path.join(docsDir, 'podcast', config.podcastSlug);
  const audioDir = path.join(feedDir, 'audio');
  await mkdir(audioDir, { recursive: true });

  const feedXml = renderFeedXml(config, updated);
  const feedPath = path.join(feedDir, 'feed.xml');
  await writeFile(feedPath, feedXml);

  return { feedPath, audioDestPath: path.join(audioDir, `${dateStr}.mp3`), audioUrl, feedUrl: `${config.podcastBaseUrl}/podcast/${config.podcastSlug}/feed.xml` };
}
