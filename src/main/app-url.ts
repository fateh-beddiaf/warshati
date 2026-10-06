import { extname, isAbsolute, join, normalize, relative } from 'path'

// The built UI is served from app://warshati/ (see app-protocol.ts) instead of file://: a page on file:// may read
// any other local file, a page on its own scheme reaches only the UI's files.

export const APP_SCHEME = 'app'
export const APP_HOST = 'warshati'
export const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
}

/**
 * The file inside `root` an app:// URL asks for, or null when it is not one of ours: another scheme or host, an
 * undecodable path, or a path that leads out of `root` (`..`, encoded or not).
 */
export function resolveAppFile(root: string, url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${APP_SCHEME}:` || parsed.host !== APP_HOST) return null
  let pathname: string
  try {
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  if (pathname.includes('\0')) return null
  const file = join(root, normalize(pathname))
  const inside = relative(root, file)
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return null
  return file
}

/** The Content-Type a UI file is served with */
export function contentTypeOf(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}
