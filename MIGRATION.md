# Media hosting: Cloudflare R2 at `media.chakraresonance.com`

All audio and screensaver bytes live in object storage at a custom domain
on Cloudflare R2 — never in the repo, never in the Vercel deployment bundle.
The Vite app on Vercel only ships the small UI; tracks stream straight from
the R2 bucket.

## How the pieces fit

- `src/lib/media.ts` — `mediaUrl()` rewrites a logical `/audio/...` or
  `/screensavers/...` path to the public URL on the configured base. Order:
  1. Already-absolute URL → returned as-is.
  2. `VITE_MEDIA_PUBLIC_BASE` set (e.g. `https://media.chakraresonance.com`)
     → `${BASE}/<path-without-leading-slash>` (segments URL-encoded).
  3. Legacy `VITE_SUPABASE_URL` set → falls back to Supabase Storage URLs.
  4. Otherwise → returns the path unchanged (lets local `public/` work).
- `src/audio/useMusicPlayer.ts` — assigns `audio.src = mediaUrl(url)` while
  keeping `currentSong` as the original logical path so all
  `song.file === currentSong` comparisons in the UI keep working.
- `src/components/ChakraJourney.tsx` + `src/components/ChakraVisualizer.tsx` —
  every screensaver `<video src={...}>` is wrapped with `mediaUrl(...)`.
- `src/data/chakraSongs.ts` / `chakraScreensavers.ts` — keep readable
  `/audio/...` / `/screensavers/...` paths; nothing host-specific.

## Object key layout in R2

The `media.chakraresonance.com` bucket should be organized to mirror the
logical paths (drop the leading slash):

```
audio/
  root/Earth Mountain.mp3
  sacral/Doumbek Dance.mp3
  ...
screensavers/
  root.mp4
  sacral.mp4
  ...
```

So `/audio/root/Earth Mountain.mp3` → `https://media.chakraresonance.com/audio/root/Earth%20Mountain.mp3`.

## One-time Cloudflare R2 setup

1. **Create an R2 bucket** (e.g. `chakra-media`) in your Cloudflare account.
2. **Connect the custom domain.** Bucket → **Settings → Custom Domains → Add**
   → enter `media.chakraresonance.com` → confirm the DNS record Cloudflare
   creates → wait until status is **Active**.
   - The `chakraresonance.com` zone must already exist in the same
     Cloudflare account (full or partial DNS setup).
3. **(Recommended) Disable** the `*.r2.dev` public development URL so the
   bucket is only reachable via your custom domain.

## Uploading the music

`scripts/upload-media.mjs` uploads from the desktop folder straight into the
R2 bucket using the S3-compatible API. It runs concurrently, sets a long
`Cache-Control`, and is idempotent (skips files already present at the same
size).

### One-time setup

1. **R2 → Manage R2 API Tokens → Create API token.** Permissions: **Object Read & Write**, scoped to your bucket. Copy:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (shown in the R2 sidebar / "Use R2 with APIs" panel)

2. **Add to `.env`** (gitignored):

   ```bash
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=chakra-media
   # Optional — defaults shown:
   # R2_AUDIO_DIR=/Users/micah/Desktop/NEW CHAKRA MUSIC SUNO /432Hz
   # R2_SCREENSAVERS_DIR=/path/to/screensavers   # only set if you have one
   ```

3. **Install deps** (idempotent):

   ```bash
   npm install
   ```

### Run it

```bash
# audio (+ screensavers if R2_SCREENSAVERS_DIR is set)
npm run upload-media

# clean cutover — wipe everything under audio/ first, then re-upload
npm run upload-media -- --wipe-audio

# preview the plan without writing to R2
npm run upload-media -- --dry-run

# audio only / screensavers only
npm run upload-media -- --audio-only
npm run upload-media -- --screensavers-only

# tune parallelism (default 8)
npm run upload-media -- --concurrency=16
```

The script:

- Walks `R2_AUDIO_DIR` (defaults to `/Users/micah/Desktop/NEW CHAKRA MUSIC SUNO /432Hz`).
- Maps each chakra subfolder to `audio/<chakra>/<filename>.mp3`.
- HEADs each key first; **skips** if the size already matches (so re-runs
  are cheap and safe).
- For screensavers (when `R2_SCREENSAVERS_DIR` is set), uploads any
  `.mp4 / .mov / .webm` as `screensavers/<filename>`.
- Sets `Cache-Control: public, max-age=31536000, immutable` so repeat plays
  come from Cloudflare's edge cache.

## Vercel configuration

Project → **Settings → Environment Variables**:

```
VITE_MEDIA_PUBLIC_BASE = https://media.chakraresonance.com
```

Add it to **Production** (and **Preview** if you use previews), then
redeploy. Vite inlines `VITE_*` vars at build time.

For local dev, copy the same line into a `.env` file (already gitignored).

## Verification checklist

- `npm run dev` with `.env` populated.
- DevTools → **Network** → play any track → request goes to
  `https://media.chakraresonance.com/audio/<chakra>/<file>.mp3`, returns
  **200** with `Content-Type: audio/mpeg`.
- Open a screensaver → video request hits the same host, returns **200**
  with `video/mp4`.
- Click around the playlist — the active row highlight and "now playing"
  title still match (`currentSong` is the logical path, not the resolved URL).

## Rolling back / changing providers

`mediaUrl()` is the single switch:

- Unset `VITE_MEDIA_PUBLIC_BASE` → falls back to Supabase (if those vars are
  set) or to raw `/audio/...` paths.
- Move to S3 / Bunny / etc. → swap the `VITE_MEDIA_PUBLIC_BASE` value, keep
  the same key layout in the new bucket. No code changes.
