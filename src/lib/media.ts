/**
 * Resolve logical media paths to a public URL on the configured CDN/bucket.
 *
 *   /audio/root/Earth Mountain.mp3
 *     → https://media.chakraresonance.com/audio/root/Earth%20Mountain.mp3
 *
 *   /screensavers/root.mp4
 *     → https://media.chakraresonance.com/screensavers/root.mp4
 *
 * Resolution order (first match wins):
 *   1. Already absolute (http/https) → returned as-is.
 *   2. VITE_MEDIA_PUBLIC_BASE set (e.g. Cloudflare R2 custom domain) →
 *      `${BASE}/<path>`. Object keys in the bucket should mirror the path
 *      (drop the leading slash), so upload as e.g. `audio/root/Foo.mp3` and
 *      `screensavers/root.mp4`.
 *   3. VITE_SUPABASE_URL set → legacy Supabase Storage URL using separate
 *      `chakra-audio` / `chakra-screensavers` public buckets.
 *   4. Fall through → original path (works locally if `public/audio` exists).
 *
 * Path segments are URL-encoded so spaces, '#', accents, etc. are safe.
 */

const MEDIA_PUBLIC_BASE: string | undefined = import.meta.env.VITE_MEDIA_PUBLIC_BASE
const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL

const SUPABASE_PREFIX_MAP: Array<{ prefix: string; bucket: string }> = [
  { prefix: '/audio/', bucket: 'chakra-audio' },
  { prefix: '/screensavers/', bucket: 'chakra-screensavers' },
]

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}

function encodePath(rest: string): string {
  return rest.split('/').map(encodeURIComponent).join('/')
}

export function mediaUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path

  if (MEDIA_PUBLIC_BASE && (path.startsWith('/audio/') || path.startsWith('/screensavers/'))) {
    // Drop the leading slash, encode each segment, prepend the public base.
    // Bucket key layout mirrors the logical path: `audio/...` and `screensavers/...`.
    return `${stripTrailingSlash(MEDIA_PUBLIC_BASE)}/${encodePath(path.slice(1))}`
  }

  if (SUPABASE_URL) {
    for (const { prefix, bucket } of SUPABASE_PREFIX_MAP) {
      if (path.startsWith(prefix)) {
        const encoded = encodePath(path.slice(prefix.length))
        return `${stripTrailingSlash(SUPABASE_URL)}/storage/v1/object/public/${bucket}/${encoded}`
      }
    }
  }

  return path
}
