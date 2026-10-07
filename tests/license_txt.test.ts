// The installer's license page (build/license.txt) is LICENSE without its Markdown: same words, same order
import fs from 'fs'
import path from 'path'
import { licenseToText } from '../scripts/build-license-txt.cjs'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

const markdown = fs.readFileSync(path.join(__dirname, '..', 'LICENSE'), 'utf8')
const text = licenseToText(markdown)

console.log('--- No Markdown left ---')
const lines = text.split('\r\n')
assert(!lines.some((line) => /^\s*#/.test(line)), 'no heading markers')
assert(!text.includes('**'), 'no ** emphasis')
assert(!text.includes('__'), 'no __ emphasis')
assert(!text.includes(']('), 'no link syntax')
assert(!text.includes('`'), 'no code ticks')
assert(!lines.some((line) => line.startsWith('>')), 'no quote markers')
assert(!/<https?:/.test(text), 'no autolink brackets')

console.log('--- Plain text the installer shows cleanly ---')
assert(!/[^\r]\n/.test(text) && text.endsWith('\r\n'), 'every line ends in CRLF')
assert(
  ![...text].some((c) => c.charCodeAt(0) > 0x7f),
  'ASCII only (NSIS reads a .txt without a BOM in the system code page)'
)
assert(!text.includes('\r\n\r\n\r\n'), 'paragraphs are separated by exactly one blank line')
assert(
  lines[0] === markdown.split(/\r?\n/)[0] && lines[0].startsWith('Required Notice: Copyright (c) 2026 Fateh Beddiaf'),
  'the Required Notice is the first line, verbatim'
)

console.log('--- The wording is unchanged ---')
// LICENSE's words with only the Markdown markers taken out, worked out independently of licenseToText
const words = (s: string): string[] => s.split(/\s+/).filter(Boolean)
const expected = words(
  markdown
    .replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/^#+\s/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*`]/g, '')
)
const actual = words(text)
const firstDifference = expected.findIndex((word, i) => actual[i] !== word)
assert(
  firstDifference === -1 && actual.length === expected.length,
  `the same ${expected.length} words in the same order` +
    (firstDifference === -1
      ? ''
      : ` (word ${firstDifference}: "${expected[firstDifference]}" vs "${actual[firstDifference]}")`)
)
assert(expected.length > 650, `the whole license is compared (${expected.length} words)`)
for (const sentence of [
  'Any noncommercial purpose is a permitted purpose.',
  'As far as the law allows, the software comes as is, without any warranty or condition,',
  'within 32 days of receiving notice.'
]) {
  assert(text.includes(sentence), `contains "${sentence}"`)
}

console.log('--- Link and emphasis forms ---')
assert(
  licenseToText('See [the site](https://example.com).') === 'See the site (https://example.com).\r\n',
  'a link keeps its URL'
)
assert(
  licenseToText('Under [Patent License](#patent-license).') === 'Under Patent License.\r\n',
  'an anchor keeps its text'
)
assert(
  licenseToText('# Title\n\nOne\nparagraph.') === 'Title\r\n\r\nOne paragraph.\r\n',
  'a wrapped paragraph becomes one line'
)
assert(licenseToText('**Use** and __this__ and *that*') === 'Use and this and that\r\n', 'emphasis markers go')
assert(licenseToText('snake_case_name stays') === 'snake_case_name stays\r\n', 'underscores inside words stay')

process.exit(0)
