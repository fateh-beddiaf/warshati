#!/usr/bin/env node
// postinstall: leave `npm ci` with a ready-to-run Electron and a better-sqlite3 it can load, WITHOUT a C++ toolchain.
//
//   1. Download the Electron binary. Since Electron 42 the `electron` package no longer does this in its own
//      install script, it downloads on first use instead. Doing it here keeps installs predictable: a failed
//      download fails `npm ci`, not the first test run, and tools that only read `electron/path.txt`
//      (electron-vite) find the binary.
//   2. Check that better-sqlite3 loads inside Electron. Since v13 it is an N-API addon that ships its prebuilt
//      binaries in the npm package itself, and the same binary works in Node and in every Electron version:
//      nothing is downloaded or rebuilt when Electron is upgraded.
//      Only if it does not load (a platform without a bundled prebuild) is it rebuilt from source with
//      electron-builder install-app-deps, which needs Python + Visual Studio Build Tools on Windows.
const { execFileSync } = require('child_process')
const path = require('path')

const ROOT = path.join(__dirname, '..')

function resolveFrom(request) {
  try {
    return require.resolve(request, { paths: [ROOT] })
  } catch {
    return null
  }
}

const electronInstaller = resolveFrom('electron/install.js')
if (!electronInstaller || !resolveFrom('better-sqlite3')) {
  // e.g. `npm ci --omit=dev`: Electron is a dev dependency, nothing to check against
  console.log('[install-native] electron or better-sqlite3 not installed, skipping')
  process.exit(0)
}

execFileSync(process.execPath, [electronInstaller], { cwd: ROOT, stdio: 'inherit' })
const electronBinary = require(resolveFrom('electron'))
const electronVersion = require(resolveFrom('electron/package.json')).version

function sqliteLoadsInElectron() {
  try {
    execFileSync(electronBinary, ['-e', "require('better-sqlite3')(':memory:').prepare('select 1').get()"], {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    return true
  } catch (error) {
    console.warn(`[install-native] better-sqlite3 does not load in Electron: ${String(error.stderr || error.message)}`)
    return false
  }
}

if (!sqliteLoadsInElectron()) {
  console.warn('[install-native] rebuilding better-sqlite3 from source for Electron...')
  const builderCli = resolveFrom('electron-builder/cli.js')
  execFileSync(process.execPath, [builderCli, 'install-app-deps'], { cwd: ROOT, stdio: 'inherit' })
  if (!sqliteLoadsInElectron()) process.exit(1)
}
console.log(`[install-native] Electron ${electronVersion} (${process.arch}) ready, better-sqlite3 loads in it`)
