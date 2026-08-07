import { deflateSync } from 'node:zlib'
import { copyFile, cp, mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_TARGET = path.join(ROOT, 'dist', 'extension')
const FIXED_TIME = new Date('2020-01-01T00:00:00Z')

function assertSafeTarget(target) {
  const resolved = path.resolve(target)
  if (resolved === '/' || resolved === ROOT || resolved.length < 12) throw new Error(`Unsafe build target: ${resolved}`)
  return resolved
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function iconPng(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const scale = size / 128
  const set = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = (Math.floor(y) * size + Math.floor(x)) * 4
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
    pixels[offset + 3] = a
  }
  const rect = (x1, y1, x2, y2, color) => {
    for (let y = Math.floor(y1 * scale); y < Math.ceil(y2 * scale); y += 1) {
      for (let x = Math.floor(x1 * scale); x < Math.ceil(x2 * scale); x += 1) set(x, y, color)
    }
  }

  rect(0, 0, 128, 128, [7, 20, 28, 255])
  const coral = [239, 143, 117, 255]
  const teal = [126, 222, 226, 255]
  rect(22, 24, 30, 104, coral)
  rect(22, 24, 43, 32, coral)
  rect(22, 96, 43, 104, coral)
  rect(98, 24, 106, 104, coral)
  rect(85, 24, 106, 32, coral)
  rect(85, 96, 106, 104, coral)
  for (let step = 0; step < 24; step += 1) {
    rect(45 + step, 46 + step, 53 + step, 54 + step, teal)
    rect(45 + step, 82 - step, 53 + step, 90 - step, teal)
  }
  rect(70, 80, 91, 88, teal)

  const scanlines = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const sourceOffset = y * size * 4
    const targetOffset = y * (size * 4 + 1)
    scanlines[targetOffset] = 0
    pixels.copy(scanlines, targetOffset + 1, sourceOffset, sourceOffset + size * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND'),
  ])
}

async function normalizeTimes(directory) {
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) await normalizeTimes(target)
    await utimes(target, FIXED_TIME, FIXED_TIME)
  }
  await utimes(directory, FIXED_TIME, FIXED_TIME)
}

export async function buildExtension(target = DEFAULT_TARGET) {
  const destination = assertSafeTarget(target)
  await rm(destination, { recursive: true, force: true })
  await mkdir(path.join(destination, 'core'), { recursive: true })
  await mkdir(path.join(destination, 'icons'), { recursive: true })

  for (const name of ['manifest.json', 'background.js', 'popup.html', 'popup.css', 'popup.js']) {
    await copyFile(path.join(ROOT, 'extension', name), path.join(destination, name))
  }
  for (const name of ['index.js', 'redact.js', 'rules.js']) {
    await copyFile(path.join(ROOT, 'src', name), path.join(destination, 'core', name))
  }
  for (const size of [16, 32, 48, 128]) {
    await writeFile(path.join(destination, 'icons', `icon-${size}.png`), iconPng(size))
  }

  const manifest = JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8'))
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  if (manifest.version !== packageJson.version) throw new Error('Extension and package versions must match.')
  if (!(await stat(path.join(destination, 'icons', 'icon-128.png'))).size) throw new Error('Extension icon generation failed.')
  await normalizeTimes(destination)
  return destination
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const targetIndex = process.argv.indexOf('--target')
  const target = targetIndex >= 0 ? process.argv[targetIndex + 1] : DEFAULT_TARGET
  await buildExtension(target)
  console.log(path.relative(ROOT, path.resolve(target)))
}
