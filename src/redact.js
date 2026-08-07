const SECRET_NAME = String.raw`(?:api[_-]?key|[a-z0-9]+(?:[_-][a-z0-9]+)*[_-](?:token|key|secret|password|passwd|credential)(?:[_-][a-z0-9]+)*|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|credential|secret)`

const REDACTORS = [
  {
    pattern: new RegExp(`(["']?${SECRET_NAME}["']?\\s*[:=]\\s*["']?)([^\\s"',}]+)`, 'gi'),
    replace: '$1[REDACTED]',
  },
  {
    pattern: new RegExp(`(--(?:${SECRET_NAME})\\s+)([^\\s]+)`, 'gi'),
    replace: '$1[REDACTED]',
  },
  {
    pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
    replace: '$1[REDACTED]',
  },
  {
    pattern: /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b/g,
    replace: '[REDACTED]',
  },
  {
    pattern: /(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi,
    replace: '$1[REDACTED]:[REDACTED]@',
  },
]

export function redactEvidence(value) {
  let redacted = String(value ?? '')
  for (const { pattern, replace } of REDACTORS) {
    pattern.lastIndex = 0
    redacted = redacted.replace(pattern, replace)
  }
  return redacted
}

export function findSecretSyntax(value) {
  const text = String(value ?? '')
  for (const pattern of [
    new RegExp(`["']?${SECRET_NAME}["']?\\s*[:=]\\s*["']?[^\\s"',}]+`, 'i'),
    new RegExp(`--(?:${SECRET_NAME})\\s+[^\\s]+`, 'i'),
    /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
    /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b/,
    /https?:\/\/[^\s/@:]+:[^\s/@]+@/i,
  ]) {
    const match = pattern.exec(text)
    if (match) return { index: match.index, value: match[0] }
  }
  return null
}

export function containsSecretSyntax(value) {
  return Boolean(findSecretSyntax(value))
}
