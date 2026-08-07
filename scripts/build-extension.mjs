import { copyFile, cp, mkdir, readFile, rm, stat, utimes } from 'node:fs/promises'
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
    await copyFile(
      path.join(ROOT, 'extension', 'icons', `icon-${size}.png`),
      path.join(destination, 'icons', `icon-${size}.png`),
    )
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
