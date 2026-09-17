import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function ttsUrl(voiceId) {
  return `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
}

async function synthesizeTurn(config, turn, index, dir) {
  const voiceId = turn.speaker === 'B' ? config.voiceHostB : config.voiceHostA;
  const res = await fetch(ttsUrl(voiceId), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'audio/mpeg',
      'xi-api-key': config.elevenLabsApiKey,
    },
    body: JSON.stringify({
      text: turn.text,
      model_id: config.elevenLabsModelId,
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs API error ${res.status} (turn ${index}): ${body}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(dir, `turn-${String(index).padStart(3, '0')}.mp3`);
  await writeFile(filePath, buffer);
  return filePath;
}

function which(cmd) {
  return new Promise((resolve) => {
    const proc = spawn('which', [cmd]);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

function runFfmpegConcat(listFile, outFile) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c', 'copy', outFile,
    ]);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

// Synthesizes each dialogue turn with the appropriate ElevenLabs voice, then
// stitches the clips into a single MP3 (via ffmpeg when available, otherwise
// a plain buffer concatenation which most players still handle fine for CBR
// MP3 clips from the same source).
export async function generateAudio(config, turns, outFile) {
  const dir = await mkdtemp(path.join(tmpdir(), 'podcast-'));
  try {
    const files = [];
    for (let i = 0; i < turns.length; i++) {
      // Sequential to respect ElevenLabs rate limits and keep turn order simple.
      // eslint-disable-next-line no-await-in-loop
      files.push(await synthesizeTurn(config, turns[i], i, dir));
    }

    const hasFfmpeg = await which('ffmpeg');
    if (hasFfmpeg) {
      const listFile = path.join(dir, 'list.txt');
      const listContent = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
      await writeFile(listFile, listContent);
      await runFfmpegConcat(listFile, outFile);
    } else {
      const buffers = await Promise.all(files.map((f) => readFile(f)));
      await writeFile(outFile, Buffer.concat(buffers));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
