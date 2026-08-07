import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
const popup = await readFile(new URL('../extension/popup.html', import.meta.url), 'utf8')
const styles = await readFile(new URL('../extension/popup.css', import.meta.url), 'utf8')
const background = await readFile(new URL('../extension/background.js', import.meta.url), 'utf8')

test('manifest has the minimal permission surface', () => {
  assert.equal(manifest.manifest_version, 3)
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'contextMenus', 'scripting'])
  assert.equal('host_permissions' in manifest, false)
  assert.equal('optional_permissions' in manifest, false)
  assert.equal(manifest.background.type, 'module')
})

test('popup has labels, status announcements, explicit exports, and source links', () => {
  assert.match(popup, /<label[^>]+for="scanner-input"/)
  assert.match(popup, /aria-live="polite"/)
  assert.match(popup, /data-action="export-json"/)
  assert.match(popup, /data-action="export-markdown"/)
  assert.match(popup, /wavect\.io\/tools\/mcp-install-risk-scanner/)
  assert.match(popup, /github\.com\/wavect\/mcp-install-risk-scanner/)
})

test('extension respects focus, touch, and reduced-motion guidance', () => {
  assert.match(styles, /min-height:\s*44px/)
  assert.match(styles, /:focus-visible/)
  assert.match(styles, /prefers-reduced-motion:\s*reduce/)
  assert.match(styles, /@media \(max-width: 400px\)/)
})

test('context menu is limited to selected text', () => {
  assert.match(background, /contexts:\s*\['selection'\]/)
  assert.doesNotMatch(background, /chrome\.storage/)
})
