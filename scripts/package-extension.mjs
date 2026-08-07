import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildExtension } from './build-extension.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUTPUT = path.join(ROOT, 'dist')
async function fileList(directory, prefix = '') {
  const entries = await readdir(path.join(directory, prefix), { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...await fileList(directory, relative))
    else files.push(relative)
  }
  return files
}

export async function createPackage(outputDirectory = DEFAULT_OUTPUT) {
  const output = path.resolve(outputDirectory)
  if (output === '/' || output === ROOT || output.length < 12) throw new Error(`Unsafe package output: ${output}`)
  await mkdir(output, { recursive: true })
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const zipName = `mcp-install-risk-scanner-chrome-v${packageJson.version}.zip`
  const extension = path.join(output, 'extension')
  const zipPath = path.join(output, zipName)
  await buildExtension(extension)
  await rm(zipPath, { force: true })
  const files = await fileList(extension)
  const zip = spawnSync('zip', ['-X', '-q', zipPath, ...files], { cwd: extension, encoding: 'utf8' })
  if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr || zip.stdout}`)
  const digest = createHash('sha256').update(await readFile(zipPath)).digest('hex')
  const checksumPath = `${zipPath}.sha256`
  await writeFile(checksumPath, `${digest}  ${zipName}\n`)
  return { zipPath, checksumPath, digest }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output')
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT
  const result = await createPackage(output)
  console.log(path.relative(ROOT, result.zipPath))
  console.log(result.digest)
}
