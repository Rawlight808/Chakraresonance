#!/usr/bin/env node
/**
 * One-off cleanup for individual objects in the Cloudflare R2 bucket backing
 * https://media.chakraresonance.com.
 *
 * Pass any number of R2 keys (or full media.chakraresonance.com URLs, which
 * get normalised to keys) as positional args. Each key is HEAD'd first so we
 * can show the size before deleting, and skipped cleanly if it doesn't exist.
 *
 * Required env (.env):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET
 *
 * Flags:
 *   --dry-run    Show what would be deleted, don't touch the bucket
 *
 * Usage:
 *   npm run delete-media -- "audio/third_eye/Abstract Math.mp3"
 *   npm run delete-media -- --dry-run "audio/third_eye/Abstract Math.mp3"
 *   npm run delete-media -- https://media.chakraresonance.com/audio/third_eye/Abstract%20Math.mp3
 */
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
} = process.env

const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
  .filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`)
  console.error('Add them to .env, then run: npm run delete-media -- <key> [<key>...]')
  process.exit(1)
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const rawKeys = args.filter((a) => !a.startsWith('--'))

if (rawKeys.length === 0) {
  console.error('No keys provided.')
  console.error('Example: npm run delete-media -- "audio/third_eye/Abstract Math.mp3"')
  process.exit(1)
}

// Accept either a bare key (audio/foo/bar.mp3) or a full media URL — strip
// scheme/host and decode any percent-encoding so the key matches what R2 stores.
function normaliseKey(input) {
  let key = input.trim()
  try {
    if (/^https?:\/\//i.test(key)) {
      const u = new URL(key)
      key = u.pathname
    }
  } catch {
    // fall through and treat as a literal key
  }
  if (key.startsWith('/')) key = key.slice(1)
  try {
    key = decodeURIComponent(key)
  } catch {
    // leave as-is if it wasn't valid percent-encoding
  }
  return key
}

const keys = rawKeys.map(normaliseKey)

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

function fmtBytes(n) {
  if (n == null) return '?'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

console.log(`R2 endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`)
console.log(`bucket: ${R2_BUCKET}`)
console.log(`mode: ${DRY_RUN ? 'dry-run' : 'delete'}`)
console.log(`targets: ${keys.length}`)

let removed = 0
let missingCount = 0
let errors = 0

for (const key of keys) {
  let size = null
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    size = head.ContentLength ?? null
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') {
      console.log(`  ${key}  not found`)
      missingCount++
      continue
    }
    console.log(`  ${key}  HEAD failed: ${e.message || e}`)
    errors++
    continue
  }

  if (DRY_RUN) {
    console.log(`  ${key}  (${fmtBytes(size)})  [dry-run]`)
    continue
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    console.log(`  ${key}  (${fmtBytes(size)})  deleted`)
    removed++
  } catch (e) {
    console.log(`  ${key}  DELETE failed: ${e.message || e}`)
    errors++
  }
}

console.log('')
console.log(`summary: ${removed} deleted, ${missingCount} missing, ${errors} errors`)
process.exit(errors > 0 ? 1 : 0)
