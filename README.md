# Daily Podcast Generator

Generates a daily two-host news podcast and publishes it as a private RSS
feed you can subscribe to in Apple Podcasts (or any podcast app that
supports "Add show by URL").

Each run:
1. **Fetches headlines** — AI industry news (OpenAI, Anthropic, Google,
   Microsoft), Salesforce/Agentforce partner-ecosystem news, Premier League
   results & fixtures, and top headlines for Ireland, Bend OR, the USA, and
   the world. All via free RSS (Google News search feeds), no API key
   required — except Premier League can optionally use
   [football-data.org](https://www.football-data.org) for structured
   scores if you set `FOOTBALL_DATA_API_KEY`.
2. **Writes a script** — sends the day's headlines to the Claude API and
   gets back a two-host conversational script as structured JSON.
3. **Generates audio** — synthesizes each line with ElevenLabs, alternating
   between two configured voices, and stitches the clips into one MP3.
4. **Publishes** — writes the MP3 and an updated `feed.xml` into
   `docs/podcast/<PODCAST_SLUG>/`, which GitHub Pages serves. The workflow
   commits these files back to the repo automatically.

## One-time setup

### 1. Enable GitHub Pages
Repo **Settings → Pages → Source**: deploy from branch `main`, folder
`/docs`. Your feed will then be reachable at
`https://<owner>.github.io/<repo>/podcast/<PODCAST_SLUG>/feed.xml`.

> This makes the *files* publicly fetchable by URL, same as any static
> GitHub Pages site — there's no login. "Private" here means the feed
> lives at a long, unguessable path (`PODCAST_SLUG`) that's never linked
> from anywhere public, rather than being indexed or discoverable. Don't
> share the URL, and treat it like a secret.

### 2. Get API keys
- **Anthropic**: create a key at https://console.anthropic.com/settings/keys
- **ElevenLabs**: create a key at https://elevenlabs.io/app/settings/api-keys,
  then pick/create two voices and copy their Voice IDs (Voice Library or
  your own cloned voices both work).
- **(Optional) football-data.org**: free tier key at
  https://www.football-data.org/client/register

### 3. Generate a private slug
```
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 4. Add repository secrets
**Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `ELEVENLABS_API_KEY` | your ElevenLabs key |
| `ELEVENLABS_VOICE_ID_HOST_A` | voice ID for host A |
| `ELEVENLABS_VOICE_ID_HOST_B` | voice ID for host B |
| `PODCAST_SLUG` | the random string from step 3 |
| `PODCAST_BASE_URL` *(optional)* | defaults to `https://<owner>.github.io/<repo>` |
| `FOOTBALL_DATA_API_KEY` *(optional)* | from football-data.org |

Optional **repository variables** (non-secret, cosmetic): `PODCAST_TITLE`,
`PODCAST_AUTHOR`, `PODCAST_EMAIL`, `HOST_A_NAME`, `HOST_B_NAME`,
`CLAUDE_MODEL`, `ELEVENLABS_MODEL_ID`.

### 5. Run it
The workflow `.github/workflows/daily-podcast.yml` runs daily at 11:00 UTC
and can also be triggered manually from the **Actions** tab
(`Daily Podcast Pipeline → Run workflow`). The first run creates
`docs/podcast/<slug>/feed.xml` and commits it.

### 6. Subscribe in Apple Podcasts
Podcasts app → Library → **⋯ → Follow a Show by URL** → paste
`https://<owner>.github.io/<repo>/podcast/<PODCAST_SLUG>/feed.xml`.

## Local run
```
npm install
cp .env.example .env   # fill in the values
node --env-file=.env src/run.js
```
This writes into `docs/podcast/<slug>/` and `data/episodes.json` in your
working copy — commit and push them yourself if you're not using the
scheduled workflow.

## Notes
- Episode history (used to keep old items in the feed) is kept in
  `data/episodes.json`. The feed keeps the most recent 60 episodes.
- Audio is concatenated with `ffmpeg` when available (GitHub Actions'
  `ubuntu-latest` runners ship it); otherwise clips are concatenated
  directly, which works for playback but won't have a clean cross-fade.
- Google News RSS occasionally rate-limits aggressive polling; the daily
  cadence here is well within safe limits.
