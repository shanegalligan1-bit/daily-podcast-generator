import { copyFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuntimeConfig } from './config.js';
import { fetchAllNews, digestToText } from './fetchNews.js';
import { generateScript } from './generateScript.js';
import { generateAudio } from './generateAudio.js';
import { buildFeed } from './buildFeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
const EPISODES_FILE = path.join(REPO_ROOT, 'data', 'episodes.json');
const TMP_AUDIO = path.join(REPO_ROOT, 'data', '.tmp-episode.mp3');

async function main() {
  const config = loadRuntimeConfig();
  if (!config.podcastBaseUrl) {
    throw new Error('PODCAST_BASE_URL not set and GITHUB_REPOSITORY not available to infer it.');
  }

  console.log('[1/4] Fetching headlines...');
  const digest = await fetchAllNews(config);
  const digestText = digestToText(digest);
  console.log(digestText.split('\n').length, 'lines of source material gathered.');

  console.log('[2/4] Generating script with Claude...');
  const turns = await generateScript(config, digestText);
  console.log(`Script has ${turns.length} turns.`);
  if (!turns.length) throw new Error('Claude returned an empty script.');

  console.log('[3/4] Synthesizing audio with ElevenLabs...');
  await mkdir(path.dirname(TMP_AUDIO), { recursive: true });
  await generateAudio(config, turns, TMP_AUDIO);
  const { size } = await stat(TMP_AUDIO);
  console.log(`Audio generated: ${(size / 1024 / 1024).toFixed(2)} MB`);

  console.log('[4/4] Publishing to RSS feed...');
  const description = turns.slice(0, 2).map((t) => t.text).join(' ').slice(0, 500);
  const { feedPath, audioDestPath, audioUrl, feedUrl } = await buildFeed(config, {
    audioFilePath: TMP_AUDIO,
    audioFileSizeBytes: size,
    docsDir: DOCS_DIR,
    episodesFile: EPISODES_FILE,
    description,
  });
  await copyFile(TMP_AUDIO, audioDestPath);

  console.log('Done.');
  console.log('Feed file:', feedPath);
  console.log('Feed URL: ', feedUrl);
  console.log('Audio URL:', audioUrl);
}

main().catch((err) => {
  console.error('Pipeline failed:', err.message);
  process.exitCode = 1;
});
