#!/usr/bin/env node
/**
 * Upload chakra music (and optionally screensavers) to a Cloudflare R2
 * bucket attached to https://media.chakraresonance.com.
 *
 * Source layout (audio):
 *   /Users/micah/Desktop/NEW CHAKRA MUSIC SUNO /432Hz/
 *     1st CHAKRA/        → audio/root/...
 *     2nd CHAKRA C#/     → audio/sacral/...
 *     2nd Chakra D/      → audio/sacral/...
 *     3RD CHAKRA E/      → audio/solar_plexus/...
 *     3rd Chakra Eb/     → audio/solar_plexus/...
 *     4th Chakra F/      → audio/heart/...
 *     4th Chakra F#/     → audio/heart/...
 *     5th Chakra G/      → audio/throat/...
 *     5th Chakra G#/     → audio/throat/...
 *     6th Chakra A/      → audio/third_eye/...
 *     6th Chakra A#/     → audio/third_eye/...
 *     7th Chakra/        → audio/crown/...
 *
 * Source layout (screensavers, optional — set R2_SCREENSAVERS_DIR):
 *   <dir>/<filename>.mp4 → screensavers/<filename>.mp4
 *
 * Required env (.env):
 *   R2_ACCOUNT_ID            Cloudflare account ID (R2 dashboard → API → "Use R2 with APIs")
 *   R2_ACCESS_KEY_ID         R2 token's Access Key ID
 *   R2_SECRET_ACCESS_KEY     R2 token's Secret Access Key
 *   R2_BUCKET                Bucket name (e.g. "chakra-media")
 *
 * Optional env:
 *   R2_AUDIO_DIR             Override source folder for music
 *                            (default: /Users/micah/Desktop/NEW CHAKRA MUSIC SUNO /432Hz)
 *   R2_SCREENSAVERS_DIR      Source folder for screensavers (skipped if unset)
 *
 * Flags:
 *   --audio-only             Skip screensavers
 *   --screensavers-only      Skip audio
 *   --wipe-audio             Delete every existing object under audio/ before uploading
 *   --wipe-screensavers      Delete every existing object under screensavers/ before uploading
 *   --concurrency=N          Parallel uploads (default 8)
 *   --dry-run                Plan + count, no network writes
 *
 * Usage:
 *   npm run upload-media                   # audio + screensavers (if dir set)
 *   npm run upload-media -- --wipe-audio   # clean cutover
 *   npm run upload-media -- --dry-run      # plan only
 */
import {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { readdir, stat } from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import { join, relative, posix, extname, basename } from 'node:path'

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_AUDIO_DIR = '/Users/micah/Desktop/NEW CHAKRA MUSIC SUNO /432Hz',
  R2_SCREENSAVERS_DIR,
} = process.env

const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
  .filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`)
  console.error('Add them to .env, then run: npm run upload-media')
  process.exit(1)
}

const ARGS = new Set(process.argv.slice(2))
const AUDIO_ONLY = ARGS.has('--audio-only')
const SCREENSAVERS_ONLY = ARGS.has('--screensavers-only')
const WIPE_AUDIO = ARGS.has('--wipe-audio')
const WIPE_SCREENSAVERS = ARGS.has('--wipe-screensavers')
const DRY_RUN = ARGS.has('--dry-run')
const CONCURRENCY = (() => {
  const flag = process.argv.find((a) => a.startsWith('--concurrency='))
  const n = flag ? parseInt(flag.split('=')[1], 10) : 8
  return Number.isFinite(n) && n > 0 ? n : 8
})()

// Source-folder name → chakra id used by src/data/chakras.ts.
const FOLDER_TO_CHAKRA = {
  '1st CHAKRA':     'root',
  '2nd CHAKRA C#':  'sacral',
  '2nd Chakra D':   'sacral',
  '3RD CHAKRA E':   'solar_plexus',
  '3rd Chakra Eb':  'solar_plexus',
  '4th Chakra F':   'heart',
  '4th Chakra F#':  'heart',
  '5th Chakra G':   'throat',
  '5th Chakra G#':  'throat',
  '6th Chakra A':   'third_eye',
  '6th Chakra A#':  'third_eye',
  '7th Chakra':     'crown',
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

function contentType(name) {
  const ext = name.toLowerCase().split('.').pop()
  return {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  }[ext] || 'application/octet-stream'
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

async function listAllKeys(prefix) {
  const keys = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function wipePrefix(prefix) {
  const keys = await listAllKeys(prefix)
  if (keys.length === 0) {
    console.log(`  nothing to delete under "${prefix}"`)
    return
  }
  console.log(`  deleting ${keys.length} object(s) under "${prefix}"…`)
  if (DRY_RUN) {
    console.log('  (dry-run: skipped)')
    return
  }
  const CHUNK = 1000 // S3 DeleteObjects limit
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK)
    await s3.send(new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
    }))
    console.log(`    removed ${Math.min(i + CHUNK, keys.length)}/${keys.length}`)
  }
}

async function existsAt(key, sizeBytes) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    // Only treat as "exists" if size matches — re-uploads otherwise (e.g. you re-encoded).
    return head.ContentLength === sizeBytes
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false
    throw e
  }
}

async function uploadOne({ srcPath, key, sizeBytes }) {
  const type = contentType(srcPath)
  if (await existsAt(key, sizeBytes)) {
    return 'skip'
  }
  if (DRY_RUN) return 'plan'

  const upload = new Upload({
    client: s3,
    // lib-storage's Upload manages part sizing and parallelism for the body
    // stream; don't set ContentLength here or it conflicts with multipart.
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: createReadStream(srcPath),
      ContentType: type,
      CacheControl: CACHE_CONTROL,
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
    leavePartsOnError: false,
  })
  await upload.done()
  return 'ok'
}

async function buildAudioPlan() {
  if (!existsSync(R2_AUDIO_DIR)) {
    throw new Error(`audio source dir not found: ${R2_AUDIO_DIR}`)
  }
  const plan = []
  for (const d of await readdir(R2_AUDIO_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue
    const chakra = FOLDER_TO_CHAKRA[d.name]
    if (!chakra) {
      throw new Error(
        `unknown source folder "${d.name}" — add it to FOLDER_TO_CHAKRA in scripts/upload-media.mjs`
      )
    }
    const dirAbs = join(R2_AUDIO_DIR, d.name)
    for await (const file of walk(dirAbs)) {
      if (extname(file).toLowerCase() !== '.mp3') continue
      const filename = relative(dirAbs, file)
      const key = posix.join('audio', chakra, ...filename.split(/[\\/]/))
      const { size } = await stat(file)
      plan.push({ srcPath: file, key, sizeBytes: size })
    }
  }
  plan.sort((a, b) => a.key.localeCompare(b.key))
  return plan
}

async function buildScreensaversPlan() {
  if (!R2_SCREENSAVERS_DIR) return null
  if (!existsSync(R2_SCREENSAVERS_DIR)) {
    console.warn(`screensavers source dir not found: ${R2_SCREENSAVERS_DIR} — skipping`)
    return null
  }
  const plan = []
  for await (const file of walk(R2_SCREENSAVERS_DIR)) {
    const ext = extname(file).toLowerCase()
    if (!['.mp4', '.mov', '.webm'].includes(ext)) continue
    const key = posix.join('screensavers', basename(file))
    const { size } = await stat(file)
    plan.push({ srcPath: file, key, sizeBytes: size })
  }
  plan.sort((a, b) => a.key.localeCompare(b.key))
  return plan
}

// Run uploads with bounded concurrency.
async function runPlan(label, plan) {
  if (plan.length === 0) {
    console.log(`${label}: nothing to do`)
    return { ok: 0, skip: 0, err: 0, bytes: 0 }
  }
  console.log(`${label}: ${plan.length} file(s), ${fmtBytes(plan.reduce((a, b) => a + b.sizeBytes, 0))} total`)

  let nextIdx = 0
  let ok = 0, skip = 0, err = 0, bytes = 0

  async function worker(workerId) {
    while (true) {
      const i = nextIdx++
      if (i >= plan.length) return
      const item = plan[i]
      const tag = `[${i + 1}/${plan.length}]`
      try {
        const result = await uploadOne(item)
        if (result === 'ok') {
          ok++
          bytes += item.sizeBytes
          console.log(`${tag} ${item.key} (${fmtBytes(item.sizeBytes)}) ok`)
        } else if (result === 'skip') {
          skip++
          console.log(`${tag} ${item.key} (${fmtBytes(item.sizeBytes)}) exists, skipped`)
        } else if (result === 'plan') {
          console.log(`${tag} ${item.key} (${fmtBytes(item.sizeBytes)}) [dry-run]`)
        }
      } catch (e) {
        err++
        console.log(`${tag} ${item.key} ERR ${e.message || e}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)))
  console.log(`${label} done: ${ok} uploaded, ${skip} skipped, ${err} errors, ${fmtBytes(bytes)}`)
  return { ok, skip, err, bytes }
}

;(async () => {
  console.log(`R2 endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`)
  console.log(`bucket: ${R2_BUCKET}`)
  console.log(`concurrency: ${CONCURRENCY}${DRY_RUN ? '   (dry-run)' : ''}`)

  const audio = !SCREENSAVERS_ONLY ? await buildAudioPlan() : []
  const screens = !AUDIO_ONLY ? (await buildScreensaversPlan()) ?? [] : []

  if (WIPE_AUDIO && !SCREENSAVERS_ONLY) {
    console.log('\n=== wiping audio/ ===')
    await wipePrefix('audio/')
  }
  if (WIPE_SCREENSAVERS && !AUDIO_ONLY) {
    console.log('\n=== wiping screensavers/ ===')
    await wipePrefix('screensavers/')
  }

  let audioRes = { ok: 0, skip: 0, err: 0, bytes: 0 }
  let screensRes = { ok: 0, skip: 0, err: 0, bytes: 0 }

  if (!SCREENSAVERS_ONLY) {
    console.log('\n=== uploading audio ===')
    audioRes = await runPlan('audio', audio)
  }
  if (!AUDIO_ONLY) {
    console.log('\n=== uploading screensavers ===')
    screensRes = await runPlan('screensavers', screens)
  }

  console.log('\n=== summary ===')
  console.log(`audio:        ${audioRes.ok} ok, ${audioRes.skip} skipped, ${audioRes.err} errors, ${fmtBytes(audioRes.bytes)}`)
  console.log(`screensavers: ${screensRes.ok} ok, ${screensRes.skip} skipped, ${screensRes.err} errors, ${fmtBytes(screensRes.bytes)}`)
  process.exit(audioRes.err + screensRes.err > 0 ? 1 : 0)
})().catch((e) => {
  console.error(`\nfatal: ${e.message || e}`)
  if (e.stack) console.error(e.stack)
  process.exit(1)
})
