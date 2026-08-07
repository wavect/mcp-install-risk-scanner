import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULE_CATALOG, SCANNER_VERSION, SCHEMA_VERSION } from '../src/index.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'))
const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
const schema = JSON.parse(await readFile(path.join(ROOT, 'schema', 'scan-report.schema.json'), 'utf8'))
const catalog = JSON.parse(await readFile(path.join(ROOT, 'schema', 'rules.json'), 'utf8'))

assert.equal(manifest.manifest_version, 3)
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'contextMenus', 'scripting'])
assert.equal('host_permissions' in manifest, false)
assert.equal('optional_host_permissions' in manifest, false)
assert.equal(manifest.version, packageJson.version)
assert.equal(packageJson.version, SCANNER_VERSION)
assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION)
assert.equal(catalog.schemaVersion, SCHEMA_VERSION)
assert.equal(catalog.scannerVersion, SCANNER_VERSION)
assert.deepEqual(catalog.rules.map(({ id }) => id), RULE_CATALOG.map(({ id }) => id))

const extensionSources = await Promise.all(['background.js', 'popup.js', 'popup.html'].map(async (name) => [name, await readFile(path.join(ROOT, 'extension', name), 'utf8')]))
const forbidden = [
  [/\beval\s*\(/, 'eval'],
  [/\bnew\s+Function\b/, 'new Function'],
  [/\bfetch\s*\(/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/<script[^>]+src=["']https?:/i, 'remote script'],
]
for (const [name, source] of extensionSources) {
  for (const [pattern, label] of forbidden) assert.doesNotMatch(source, pattern, `${name} must not use ${label}`)
}

console.log(`source policy passed for ${RULE_CATALOG.length} rules`)
