// Renders build/icon.svg into the app icons: build/icon.png (512px, window icon and docs) and build/icon.ico
// (16 to 256px, the installer and the .exe). Runs inside Electron so it needs no image library:
//   npm run icons
// The output is committed; run it again only after editing the SVG.
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')

const BUILD = path.join(__dirname, '..', 'build')
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const PNG_SIZE = 512

/** An .ico file whose images are stored as PNG (supported by Windows since Vista). */
function toIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + 16 * images.length
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2) // no palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(entry)
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)])
}

app
  .whenReady()
  .then(async () => {
    const svg = readFileSync(path.join(BUILD, 'icon.svg'), 'utf8')
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    await win.loadURL('data:text/html,<!doctype html><title>icons</title>')
    // Each size is drawn from the vector source (not downscaled from a big bitmap), so small icons stay sharp
    const dataUrls = await win.webContents.executeJavaScript(`(async () => {
    const image = new Image()
    image.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))}
    await image.decode()
    const render = (size) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, size, size)
      return canvas.toDataURL('image/png')
    }
    return ${JSON.stringify([...ICO_SIZES, PNG_SIZE])}.map(render)
  })()`)
    const pngs = dataUrls.map((url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))

    writeFileSync(path.join(BUILD, 'icon.png'), pngs[pngs.length - 1])
    writeFileSync(path.join(BUILD, 'icon.ico'), toIco(ICO_SIZES.map((size, i) => ({ size, png: pngs[i] }))))
    console.log(`[icons] build/icon.png (${PNG_SIZE}px) and build/icon.ico (${ICO_SIZES.join(', ')}px)`)
    app.quit()
  })
  .catch((error) => {
    console.error('[icons] failed:', error)
    app.exit(1)
  })
