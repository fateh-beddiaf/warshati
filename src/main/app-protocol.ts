import { protocol } from 'electron'
import { readFile } from 'fs/promises'
import { APP_SCHEME, contentTypeOf, resolveAppFile } from './app-url'

/**
 * Declares app:// as a standard, secure scheme (relative URLs, 'self' in the CSP, fetch). Must run before the app
 * is ready.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** Serves the files of `root` (the built UI, inside app.asar once packaged) on app://warshati/. */
export function serveAppFiles(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const file = resolveAppFile(root, request.url)
    if (!file) return new Response('Not found', { status: 404 })
    try {
      return new Response(await readFile(file), { headers: { 'Content-Type': contentTypeOf(file) } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
