import { createHash } from 'crypto'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev server only: the React Fast Refresh preamble is an inline <script>, which the strict CSP in index.html
 * (`script-src 'self'`) blocks. Allow exactly those inline scripts by hash; the production build has none.
 */
function allowDevInlineScriptsInCsp(): Plugin {
  return {
    name: 'warshati:csp-dev-inline-scripts',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
          .map((match) => match[1])
          .filter((code) => code.trim() !== '')
          .map((code) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`)
        return hashes.length === 0 ? html : html.replace("script-src 'self'", `script-src 'self' ${hashes.join(' ')}`)
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
        '@database': resolve('src/database')
      }
    },
    plugins: [react(), allowDevInlineScriptsInCsp()]
  }
})
