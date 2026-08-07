import { redactEvidence } from './redact.js'
import { RULES, RULE_CATALOG } from './rules.js'

export const SCANNER_VERSION = '0.1.1'
export const SCHEMA_VERSION = '1.0.0'
export const MAX_INPUT_LENGTH = 100_000

export const SUMMARY_LABELS = Object.freeze({
  stop: 'Stop and review',
  review: 'Review recommended',
  clear: 'No known patterns flagged',
})

const LIMITATIONS = Object.freeze([
  'Static pattern matching cannot verify publisher identity, package contents, or runtime behavior.',
  'Obfuscated, encoded, generated, or remotely loaded behavior may not be visible in the supplied text.',
  'No known patterns flagged is not a statement that the command, package, or server is safe.',
])

function inferInputKind(text) {
  const trimmed = text.trim()
  if (/^[{[]/.test(trimmed)) return 'mcp-config'
  if (/\b(?:docker|podman)\s+(?:run|compose)\b|\bimage\s*:/.test(trimmed)) return 'container-config'
  return 'install-command'
}

function evidenceLine(text, index) {
  const safeIndex = Number.isInteger(index) && index >= 0 ? Math.min(index, text.length) : 0
  const start = Math.max(0, text.lastIndexOf('\n', safeIndex - 1) + 1)
  const nextBreak = text.indexOf('\n', safeIndex)
  const end = nextBreak === -1 ? text.length : nextBreak
  const line = text.slice(start, end).trim() || text.slice(0, 240).trim()
  const clipped = line.length > 240 ? `${line.slice(0, 237)}...` : line
  return redactEvidence(clipped)
}

function summaryFor(findings) {
  if (findings.some(({ severity }) => severity === 'critical' || severity === 'high')) return SUMMARY_LABELS.stop
  if (findings.length) return SUMMARY_LABELS.review
  return SUMMARY_LABELS.clear
}

export function scanMcpInstallText(input, options = {}) {
  const text = String(input ?? '').replace(/\r\n?/g, '\n')
  if (!text.trim()) throw new TypeError('Input must contain an MCP install command or configuration snippet.')
  if (text.length > MAX_INPUT_LENGTH) throw new RangeError(`Input exceeds the ${MAX_INPUT_LENGTH}-character local scan limit.`)

  const findings = []
  for (const rule of RULES) {
    const match = rule.detect(text)
    if (!match) continue
    findings.push({
      ruleId: rule.id,
      severity: rule.severity,
      category: rule.category,
      message: rule.message,
      redactedEvidence: evidenceLine(text, match.index),
      remediation: rule.remediation,
      references: [...rule.references],
    })
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    scannerVersion: SCANNER_VERSION,
    inputKind: options.inputKind || inferInputKind(text),
    summary: summaryFor(findings),
    findings,
    limitations: [...LIMITATIONS],
  }
}

export { redactEvidence, RULE_CATALOG }
