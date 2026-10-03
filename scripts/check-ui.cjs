#!/usr/bin/env node
// Design-system guard for src/renderer (T003):
//   1. no raw palette colours / hex / rgb / hsl literals (use the tokens from index.css)
//   2. no Tailwind v4-only classes (this project is on Tailwind 3.4)
//   3. no physical ml-/mr-/pl-/pr-/left-/right-/text-left/text-right (use ms-/me-/ps-/pe-/start-/end-/text-start/text-end)
//   4. no file over 400 lines (i18n.ts and locales are exempt)
// A line that is intentionally exempt (the printed label surface) carries the marker: allow-raw-color
// Usage: node scripts/check-ui.cjs [--rtl] [--size]   (no flags = colours + v4 + size; --rtl adds the RTL check)
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src', 'renderer')
const MAX_LINES = 400
const SIZE_EXEMPT = new Set(['i18n.ts'])
const SIZE_EXEMPT_DIRS = ['locales']
// The printed label is always black on white, whatever the theme
const COLOR_EXEMPT_FILES = new Set(['BarcodeLabel.tsx', 'barcode-svg.ts'])

const PALETTE =
  '(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
const COLOR_UTIL = new RegExp(
  String.raw`(?<![\w-])(?:[a-z-]+:)*(bg|text|border|ring|ring-offset|from|to|via|divide|placeholder|fill|stroke|shadow|outline|decoration|accent|caret)-${PALETTE}(-\d{2,3})?(?![\w-])`
)
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\((?!var)/
const V4 = /(?<![\w-])(z-60|z-70|z-80|backdrop-blur-xs|shadow-xs|shadow-2xs|rounded-xs|blur-xs|drop-shadow-xs|outline-hidden|ring-3|bg-linear-[\w-]+|inset-shadow-[\w-]+)(?![\w-])/
const PHYSICAL = /(?<![\w-])(?:[a-z-]+:)*(-?)(ml|mr|pl|pr|left|right|rounded-l|rounded-r|border-l|border-r)-(\d|\[|px|auto|full)|(?<![\w-])text-(left|right)(?![\w-])/

const wantRtl = process.argv.includes('--rtl')
const problems = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(tsx?|css|html)$/.test(entry.name)) check(full)
  }
}

function check(file) {
  const rel = path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/')
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const isFont = rel.endsWith('index.css') // token definitions live here
  const sizeExempt = SIZE_EXEMPT.has(path.basename(file)) || SIZE_EXEMPT_DIRS.some((d) => rel.includes(`/${d}/`))

  if (!sizeExempt && lines.length > MAX_LINES) problems.push(`${rel}: ${lines.length} lines (max ${MAX_LINES})`)
  if (isFont) return
  const colorExempt = COLOR_EXEMPT_FILES.has(path.basename(file))

  lines.forEach((line, i) => {
    if (line.includes('allow-raw-color')) return
    const where = `${rel}:${i + 1}`
    const color = colorExempt ? null : line.match(COLOR_UTIL)
    if (color) problems.push(`${where}: raw colour class "${color[0]}"`)
    const raw = colorExempt ? null : line.match(RAW_COLOR)
    if (raw && !/^\s*(\/\/|\*|\/\*)/.test(line)) problems.push(`${where}: raw colour literal "${raw[0]}"`)
    const v4 = line.match(V4)
    if (v4) problems.push(`${where}: Tailwind v4-only class "${v4[0]}"`)
    if (wantRtl) {
      const phys = line.match(PHYSICAL)
      if (phys) problems.push(`${where}: physical direction class "${phys[0]}"`)
    }
  })
}

walk(ROOT)
if (problems.length) {
  console.log(problems.join('\n'))
  console.log(`\n${problems.length} problem(s)`)
  process.exit(1)
}
console.log('check-ui: OK')
