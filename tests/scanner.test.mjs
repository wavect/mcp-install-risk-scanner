import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  MAX_INPUT_LENGTH,
  RULE_CATALOG,
  SCANNER_VERSION,
  SCHEMA_VERSION,
  scanMcpInstallText,
  SUMMARY_LABELS,
} from '@wavect/mcp-install-risk-core'

const fixtures = JSON.parse(await readFile(new URL('./fixtures/dangerous.json', import.meta.url), 'utf8'))

for (const fixture of fixtures) {
  test(`detects ${fixture.name}`, () => {
    const report = scanMcpInstallText(fixture.input)
    assert.equal(report.findings.some(({ ruleId }) => ruleId === fixture.ruleId), true)
  })
}

test('returns the stable public contract and deterministic output', () => {
  const input = '{"mcpServers":{"docs":{"command":"npx","args":["@example/docs@1.2.3"]}}}'
  const first = scanMcpInstallText(input)
  const second = scanMcpInstallText(input)
  assert.deepEqual(first, second)
  assert.equal(first.schemaVersion, SCHEMA_VERSION)
  assert.equal(first.scannerVersion, SCANNER_VERSION)
  assert.equal(first.inputKind, 'mcp-config')
  assert.equal(first.summary, SUMMARY_LABELS.clear)
  assert.deepEqual(first.findings, [])
  assert.match(first.limitations.join(' '), /not a statement.*safe/i)
})

test('uses only the three honest summary labels', () => {
  const reports = [
    scanMcpInstallText('sudo true'),
    scanMcpInstallText('npx @example/server'),
    scanMcpInstallText('npx @example/server@1.2.3'),
  ]
  assert.deepEqual(reports.map(({ summary }) => summary), [SUMMARY_LABELS.stop, SUMMARY_LABELS.review, SUMMARY_LABELS.clear])
})

test('redacts secrets before evidence enters the report', () => {
  const values = [
    ['API_TOKEN=super-secret-value npx @example/server', 'super-secret-value'],
    ['--api-key sk-abcdefghijklmnopqrstuv', 'sk-abcdefghijklmnopqrstuv'],
    ['Authorization: Bearer abc.def.ghi', 'abc.def.ghi'],
    ['https://alice:secret@example.com/mcp', 'alice:secret'],
  ]
  for (const [input, secret] of values) {
    const report = scanMcpInstallText(input)
    assert.equal(report.findings.some(({ ruleId }) => ruleId === 'MCP007'), true)
    assert.doesNotMatch(JSON.stringify(report), new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(JSON.stringify(report), /\[REDACTED\]/)
  }
})

test('allows loopback HTTP for explicit local development', () => {
  for (const input of ['http://localhost:3000/mcp', 'http://127.0.0.1:8787/mcp', 'http://[::1]:3000/mcp']) {
    const report = scanMcpInstallText(input)
    assert.equal(report.findings.some(({ ruleId }) => ruleId === 'MCP011'), false)
  }
})

test('distinguishes exact runner versions from moving versions', () => {
  assert.equal(scanMcpInstallText('npx -y @scope/server@1.2.3').findings.some(({ ruleId }) => ruleId === 'MCP008'), false)
  assert.equal(scanMcpInstallText('uvx example-server@2.4.0').findings.some(({ ruleId }) => ruleId === 'MCP008'), false)
  assert.equal(scanMcpInstallText('npx @scope/server@latest').findings.some(({ ruleId }) => ruleId === 'MCP008'), true)
})

test('rejects empty and oversized input without including it in an error', () => {
  assert.throws(() => scanMcpInstallText('  '), /must contain/i)
  assert.throws(() => scanMcpInstallText('x'.repeat(MAX_INPUT_LENGTH + 1)), /100000-character/)
})

test('catalog rule identifiers are unique and ordered', () => {
  const ids = RULE_CATALOG.map(({ id }) => id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids, Array.from({ length: 14 }, (_, index) => `MCP${String(index + 1).padStart(3, '0')}`))
})
