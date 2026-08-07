import { MAX_INPUT_LENGTH, scanMcpInstallText, SUMMARY_LABELS } from './core/index.js'

const root = document.querySelector('.scanner-shell')
const input = document.querySelector('#scanner-input')
const errorNode = document.querySelector('.error-message')
const emptyNode = document.querySelector('[data-empty]')
const summaryNode = document.querySelector('[data-summary]')
const summaryLabel = document.querySelector('[data-summary-label]')
const summaryDetail = document.querySelector('[data-summary-detail]')
const findingsNode = document.querySelector('[data-findings]')
const exportActions = document.querySelector('.export-actions')
let currentReport = null

const SAMPLE = `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@example/mcp-filesystem"],
      "env": { "API_TOKEN": "replace-me" }
    }
  }
}`

function showError(message) {
  errorNode.textContent = message
  errorNode.hidden = false
}

function clearError() {
  errorNode.textContent = ''
  errorNode.hidden = true
}

function element(name, className, text) {
  const node = document.createElement(name)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function renderFinding(finding) {
  const article = element('article', 'finding')
  article.dataset.severity = finding.severity
  const head = element('div', 'finding-head')
  head.append(element('h3', '', `${finding.ruleId} · ${finding.message}`))
  head.append(element('span', 'severity', finding.severity))
  article.append(head)
  article.append(element('code', '', finding.redactedEvidence))
  article.append(element('p', '', finding.remediation))
  return article
}

function renderReport(report) {
  currentReport = report
  emptyNode.hidden = true
  summaryNode.hidden = false
  exportActions.hidden = false
  const level = report.summary === SUMMARY_LABELS.stop ? 'stop' : report.summary === SUMMARY_LABELS.review ? 'review' : 'clear'
  summaryNode.dataset.level = level
  summaryLabel.textContent = report.summary
  summaryDetail.textContent = report.findings.length
    ? `${report.findings.length} static ${report.findings.length === 1 ? 'signal' : 'signals'} · ${report.inputKind}`
    : `0 known patterns · ${report.inputKind}`
  findingsNode.replaceChildren(...report.findings.map(renderFinding))
}

function runScan() {
  clearError()
  try {
    renderReport(scanMcpInstallText(input.value))
  } catch (error) {
    showError(error.message || 'The snippet could not be scanned.')
  }
}

function extractVisibleSetupText() {
  const selected = String(window.getSelection?.() || '').trim()
  if (selected) return { text: selected.slice(0, 100_000), source: 'selection' }

  const signal = /\b(?:mcpServers?|modelcontextprotocol|npx|uvx|docker|podman|powershell|curl|wget|command|args)\b/i
  const seen = new Set()
  const snippets = []
  for (const node of document.querySelectorAll('pre, code')) {
    const style = window.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const text = (node.innerText || node.textContent || '').trim()
    if (!text || !signal.test(text) || seen.has(text)) continue
    seen.add(text)
    snippets.push(text)
    if (snippets.join('\n\n').length >= 100_000) break
  }
  return { text: snippets.join('\n\n').slice(0, 100_000), source: 'visible-code' }
}

async function readCurrentPage() {
  clearError()
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab is available.')
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractVisibleSetupText })
    if (!result?.text) throw new Error('No selected text or visible MCP-like code blocks were found on this page.')
    input.value = result.text.slice(0, MAX_INPUT_LENGTH)
    runScan()
  } catch (error) {
    showError('Chrome cannot read this page, or no visible setup snippet was found. Paste the command into the scanner instead.')
  }
}

function reportMarkdown(report) {
  const findings = report.findings.length
    ? report.findings.map((finding) => `## ${finding.ruleId}: ${finding.message}\n\n- Severity: ${finding.severity}\n- Category: ${finding.category}\n- Evidence: \`${finding.redactedEvidence.replaceAll('`', '\\`')}\`\n- Review step: ${finding.remediation}`).join('\n\n')
    : 'No known static patterns were flagged. This is not a safety verdict.'
  return `# MCP install risk scan\n\n- Scanner: ${report.scannerVersion}\n- Schema: ${report.schemaVersion}\n- Result: ${report.summary}\n- Input kind: ${report.inputKind}\n\n${findings}\n\n## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join('\n')}\n`
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

root.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const action = button.dataset.action
  if (action === 'load-sample') {
    input.value = SAMPLE
    input.focus()
  } else if (action === 'scan') {
    runScan()
  } else if (action === 'read-page') {
    await readCurrentPage()
  } else if (action === 'export-json' && currentReport) {
    download('mcp-install-risk-report.json', `${JSON.stringify(currentReport, null, 2)}\n`, 'application/json')
  } else if (action === 'export-markdown' && currentReport) {
    download('mcp-install-risk-report.md', reportMarkdown(currentReport), 'text/markdown')
  }
})

input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') runScan()
})

chrome.runtime.sendMessage({ type: 'consume-selection' }).then(({ selection } = {}) => {
  if (!selection) return
  input.value = selection.slice(0, MAX_INPUT_LENGTH)
  runScan()
}).catch(() => {})
