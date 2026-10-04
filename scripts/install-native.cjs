#!/usr/bin/env node
// postinstall: make better-sqlite3 loadable inside Electron WITHOUT a C++ toolchain.
//
//   1. Download the prebuilt binary that matches the installed Electron version (prebuild-install).
//   2. Only if that fails, rebuild from source with electron-builder install-app-deps
//      (needs Python + Visual Studio Build Tools "Desktop development with C++" on Windows).
//
// better-sqlite3's own install step runs before this one. `.prebuild-installrc` at the repo root points it at
// the Electron runtime too, so it does not fall back to node-gyp when no prebuild exists for the local Node.
// This script re-checks the binary against the Electron version actually installed, so the pinned target in
// `.prebuild-installrc` drifting after an Electron upgrade is caught (warning) and repaired (download).
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function resolvePackageDir(name, from = ROOT) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [from] }))
  } catch {
    return null
  }
}

function pinnedTarget() {
  const rc = path.join(ROOT, '.prebuild-installrc')
  if (!fs.existsSync(rc)) return null
  const match = /^\s*target\s*=\s*(\S+)/m.exec(fs.readFileSync(rc, 'utf8'))
  return match ? match[1] : null
}

const electronDir = resolvePackageDir('electron')
const sqliteDir = resolvePackageDir('better-sqlite3')
if (!electronDir || !sqliteDir) {
  // e.g. `npm ci --omit=dev`: Electron is a dev dependency, nothing to match against
  console.log('[install-native] electron or better-sqlite3 not installed, skipping')
  process.exit(0)
}

const electronVersion = readJson(path.join(electronDir, 'package.json')).version
const pinned = pinnedTarget()
if (pinned && pinned !== electronVersion) {
  console.warn(
    `[install-native] .prebuild-installrc targets Electron ${pinned} but ${electronVersion} is installed: update it`
  )
}

try {
  const prebuildBin = require.resolve('prebuild-install/bin.js', { paths: [sqliteDir] })
  execFileSync(
    process.execPath,
    [prebuildBin, '--runtime=electron', `--target=${electronVersion}`, `--arch=${process.arch}`, '--verbose'],
    { cwd: sqliteDir, stdio: 'inherit' }
  )
  console.log(`[install-native] better-sqlite3 prebuilt binary for Electron ${electronVersion} (${process.arch}) ready`)
} catch {
  console.warn('[install-native] no prebuilt binary could be downloaded, rebuilding better-sqlite3 from source...')
  const builderCli = require.resolve('electron-builder/cli.js', { paths: [ROOT] })
  execFileSync(process.execPath, [builderCli, 'install-app-deps'], { cwd: ROOT, stdio: 'inherit' })
}
