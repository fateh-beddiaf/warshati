#!/usr/bin/env node
// Writes build/license.txt, the plain-text copy of LICENSE shown on the installer's license page (NSIS shows a .txt
// file as is and does not render Markdown). Run by `npm run dist` before electron-builder.
//
// Only the Markdown formatting is removed: heading and quote markers, emphasis, code ticks, the angle brackets of
// autolinks, and link syntax ([text](url) -> "text (url)"; a link to a heading of this same file keeps only its text,
// since an anchor means nothing in a text box). The wording stays word for word: tests/license_txt.test.ts checks it.
//
// Each paragraph is one line with a blank line after it, and lines end in CRLF: the installer's text box wraps long
// lines to its own width, so wrapping them here at a fixed column would only break lines a second time.
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'LICENSE')
const TARGET = path.join(ROOT, 'build', 'license.txt')

/** @param {string} text */
function stripInline(text) {
  return (
    text
      // <https://...> autolinks
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
      // [text](#heading): an anchor inside this file
      .replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1')
      // [text](url)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
      // ***strong emphasis***, **strong**, __strong__, *emphasis*, _emphasis_
      .replace(/\*{3}([^*]+)\*{3}/g, '$1')
      .replace(/\*{2}([^*]+)\*{2}/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?![\w*])/g, '$1$2')
      .replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1$2')
      // `code`
      .replace(/`([^`]+)`/g, '$1')
  )
}

/**
 * Markdown license text -> plain text with CRLF line endings.
 * @param {string} markdown
 * @returns {string}
 */
function licenseToText(markdown) {
  const blocks = markdown
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  const paragraphs = blocks.map((block) => {
    const lines = block.split('\n').map((line) => line.trim())
    if (lines.every((line) => line.startsWith('>'))) {
      // A quote (the example Required Notice) is indented instead
      return '    ' + stripInline(lines.map((line) => line.replace(/^>\s?/, '')).join(' '))
    }
    const heading = /^#{1,6}\s+(.*?)\s*#*$/.exec(block)
    if (heading && lines.length === 1) return stripInline(heading[1])
    return stripInline(lines.join(' '))
  })

  return paragraphs.join('\r\n\r\n') + '\r\n'
}

if (require.main === module) {
  const text = licenseToText(fs.readFileSync(SOURCE, 'utf8'))
  fs.mkdirSync(path.dirname(TARGET), { recursive: true })
  fs.writeFileSync(TARGET, text, 'utf8')
  console.log(`Wrote ${path.relative(ROOT, TARGET)} (${text.length} characters)`)
}

module.exports = { licenseToText }
