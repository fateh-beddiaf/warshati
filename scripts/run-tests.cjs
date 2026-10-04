#!/usr/bin/env node
// Unit/integration test runner: every tests/*.test.ts, one process per file, with a per-file timeout.
//
// Each file runs in Electron's bundled Node (ELECTRON_RUN_AS_NODE=1) so better-sqlite3 uses the same
// Electron-ABI binary as the app. Running as plain Node also means:
//   - a file exits by itself when its work is done (no `process.exit(0)` needed to stop an Electron app),
//   - an uncaught error exits with code 1 instead of opening Electron's blocking error dialog.
// A file that still does not finish within the timeout is killed and reported as TIMEOUT.
//
// Usage: node scripts/run-tests.cjs [name-filter ...]   (env TEST_TIMEOUT_MS, default 120000)
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const TESTS_DIR = path.join(ROOT, 'tests')
const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS) || 120_000
const electronBinary = require('electron')

const filters = process.argv.slice(2)
const files = fs
  .readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith('.test.ts'))
  .filter((name) => filters.length === 0 || filters.some((f) => name.includes(f)))
  .sort()

if (files.length === 0) {
  console.error(`No test files matched in tests/ (filters: ${filters.join(', ') || 'none'})`)
  process.exit(1)
}

function runFile(name) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(electronBinary, ['-r', 'tsx', path.join('tests', name)], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, TIMEOUT_MS)
    const finish = (status) => {
      clearTimeout(timer)
      resolve({ name, status, seconds: ((Date.now() - started) / 1000).toFixed(1) })
    }
    child.on('error', (error) => {
      console.error(`Failed to start ${name}:`, error)
      finish('ERROR')
    })
    child.on('exit', (code, signal) => {
      if (timedOut) finish('TIMEOUT')
      else finish(code === 0 ? 'PASS' : `FAIL (exit ${code ?? signal})`)
    })
  })
}

async function main() {
  const results = []
  for (const name of files) {
    console.log(`\n▶ ${name}`)
    const result = await runFile(name)
    if (result.status === 'TIMEOUT') {
      console.error(`✖ ${name} did not finish within ${TIMEOUT_MS / 1000}s and was killed`)
    }
    results.push(result)
  }

  console.log('\n─── Test summary ───')
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? '✔' : '✖'} ${r.name.padEnd(36)} ${r.status} (${r.seconds}s)`)
  }
  const failed = results.filter((r) => r.status !== 'PASS')
  console.log(`\n${results.length - failed.length}/${results.length} files passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
