import { app, session, type WebContents } from 'electron'

/** True when `target` is the page `contents` already shows (same scheme, host and path; query/hash may differ). */
export function isSamePage(currentUrl: string, target: string): boolean {
  try {
    const current = new URL(currentUrl)
    const next = new URL(target)
    return next.protocol === current.protocol && next.host === current.host && next.pathname === current.pathname
  } catch {
    return false
  }
}

function hardenWebContents(contents: WebContents): void {
  // The UI is a single page: never let a link, a drop or injected content navigate the window elsewhere
  contents.on('will-navigate', (event, url) => {
    if (!isSamePage(contents.getURL(), url)) event.preventDefault()
  })
  // The app works offline and its UI has no external links: no new windows, nothing opened in the browser
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

/**
 * Applies the offline-app security policy to every window, including the hidden print window.
 * Call once, before the first window is created.
 */
export function applySecurityPolicy(): void {
  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))
  // Camera, microphone, notifications, geolocation...: the app needs none of them
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
}
