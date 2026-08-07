import { findSecretSyntax } from './redact.js'

export const MCP_SECURITY_REFERENCE = 'https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices#local-mcp-server-compromise'
export const MCP_SSRF_REFERENCE = 'https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices#server-side-request-forgery-ssrf'

function firstPatternMatch(text, patterns) {
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (match) return { index: match.index, value: match[0] }
  }
  return null
}

function firstUrlRisk(text) {
  const pattern = /https?:\/\/[^\s"'<>)}]+/gi
  let match
  while ((match = pattern.exec(text))) {
    try {
      const url = new URL(match[0])
      const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
      const loopback = host === 'localhost' || host === '::1' || host.startsWith('127.')
      const privateHost = host === '169.254.169.254'
        || host.startsWith('10.')
        || host.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        || host.startsWith('169.254.')
        || host.startsWith('fc')
        || host.startsWith('fd')
        || host.startsWith('fe8')
        || host.startsWith('fe9')
        || host.startsWith('fea')
        || host.startsWith('feb')
      if (privateHost || (url.protocol === 'http:' && !loopback)) {
        return { index: match.index, value: match[0] }
      }
    } catch {
      return { index: match.index, value: match[0] }
    }
  }
  return null
}

function firstUnpinnedRunner(text) {
  const commandPattern = /\b(npx|uvx)\s+([^\n;|&]+)/gi
  let match
  while ((match = commandPattern.exec(text))) {
    const tokens = match[2].trim().split(/\s+/)
    let candidate = ''
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      if (['-p', '--package'].includes(token)) {
        index += 1
        continue
      }
      if (token.startsWith('-')) continue
      candidate = token.replace(/["',}\]]+$/g, '')
      break
    }
    if (!candidate) continue
    const separator = candidate.lastIndexOf('@')
    const pinned = separator > 0 && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(candidate.slice(separator + 1))
    if (!pinned) return { index: match.index, value: `${match[1]} ${candidate}` }
  }
  return null
}

function firstFloatingContainer(text) {
  const latest = /\b(?:image\s*[:=]\s*["']?|(?:docker|podman)\s+run\b[^\n]*\s)([a-z0-9][a-z0-9._/-]*:latest)\b/i.exec(text)
  if (latest) return { index: latest.index, value: latest[0] }

  const jsonImage = /["']image["']\s*:\s*["']([^"']+)["']/gi
  let match
  while ((match = jsonImage.exec(text))) {
    if (!match[1].includes('@sha256:') && !/:\d+(?:\.\d+){1,3}(?:[-+][\w.-]+)?$/.test(match[1])) {
      return { index: match.index, value: match[0] }
    }
  }

  const dockerRun = /\b(?:docker|podman)\s+run\s+(?:--?[\w-]+(?:[= ]\S+)?\s+)*([a-z0-9][a-z0-9._/-]*)\b/gi
  while ((match = dockerRun.exec(text))) {
    if (!match[1].includes('@sha256:') && !match[1].includes(':')) {
      return { index: match.index, value: match[0] }
    }
  }
  return null
}

function firstMovingGitRef(text) {
  return firstPatternMatch(text, [
    /(?:git\+https?|github):[^\s"']+#(?:main|master|develop|development|head)\b/i,
    /\bgit\s+clone\b(?![^\n]*(?:--branch\s+v?\d|--revision\s+[0-9a-f]{7,40}))[^^\n;]+/i,
  ])
}

export const RULES = Object.freeze([
  {
    id: 'MCP001',
    severity: 'critical',
    category: 'command-execution',
    message: 'Downloaded content is piped directly into a command interpreter.',
    remediation: 'Download the artifact separately, verify its source and contents, then execute a pinned local file only after review.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /\b(?:curl|wget)\b[^\n|]{0,500}\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|pwsh|powershell)\b/i,
      /\b(?:Invoke-WebRequest|iwr|curl|wget)\b[^\n|]{0,500}\|\s*(?:Invoke-Expression|iex)\b/i,
      /\biex\s*\(\s*(?:iwr|Invoke-WebRequest|New-Object\s+Net\.WebClient)\b[^\n)]*/i,
    ]),
  },
  {
    id: 'MCP002',
    severity: 'high',
    category: 'command-execution',
    message: 'The setup delegates execution to a general-purpose shell wrapper.',
    remediation: 'Replace the wrapper with an explicit executable and argument array so the complete startup behavior is inspectable.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /\b(?:sh|bash|zsh|fish)\s+-c\b/i,
      /\b(?:pwsh|powershell)(?:\.exe)?\s+-(?:Command|EncodedCommand)\b/i,
      /\bcmd(?:\.exe)?\s+\/c\b/i,
    ]),
  },
  {
    id: 'MCP003',
    severity: 'critical',
    category: 'privilege',
    message: 'The setup requests elevated operating-system privileges.',
    remediation: 'Run the server as an unprivileged user and grant only the specific filesystem or network access it requires.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [/\b(?:sudo|doas|runas)\b/i]),
  },
  {
    id: 'MCP004',
    severity: 'critical',
    category: 'filesystem',
    message: 'The setup contains a recursive or forced deletion command.',
    remediation: 'Remove destructive setup steps. If cleanup is necessary, constrain it to an explicit application-owned directory and review it separately.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /\brm\s+(?:-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i,
      /\bRemove-Item\b[^\n]*(?:-Recurse[^\n]*-Force|-Force[^\n]*-Recurse)/i,
      /\b(?:del|rmdir)\s+\/(?:s|q)\s+\/(?:q|s)\b/i,
    ]),
  },
  {
    id: 'MCP005',
    severity: 'high',
    category: 'privilege',
    message: 'The setup weakens file permissions or disables a security boundary.',
    remediation: 'Use least-privilege permissions and keep browser, container, and operating-system sandboxes enabled.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /\bchmod\s+(?:-R\s+)?(?:777|666|a\+rw|a\+rwx)\b/i,
      /--(?:no-sandbox|disable-sandbox|security-opt\s+seccomp=unconfined)(?:\s|$)/i,
      /\bsetenforce\s+0\b/i,
    ]),
  },
  {
    id: 'MCP006',
    severity: 'high',
    category: 'filesystem',
    message: 'The setup references a sensitive host path or credential store.',
    remediation: 'Remove the path or replace it with an explicit, read-only, task-specific directory grant.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /(?:~|\$HOME|\/Users\/[^\s/]+|\/home\/[^\s/]+)[\\/]\.(?:ssh|aws|azure|config[\\/]gcloud|kube)\b/i,
      /\b(?:\/root|\/etc\/(?:shadow|sudoers)|\/var\/run\/docker\.sock)\b/i,
      /\\Users\\[^\s\\]+\\\.ssh\b/i,
    ]),
  },
  {
    id: 'MCP007',
    severity: 'high',
    category: 'secrets',
    message: 'The setup appears to contain an inline credential or secret value.',
    remediation: 'Remove the value from the snippet, rotate any real credential, and use a scoped secret store or interactive authorization flow.',
    references: [MCP_SECURITY_REFERENCE],
    detect: findSecretSyntax,
  },
  {
    id: 'MCP008',
    severity: 'medium',
    category: 'supply-chain',
    message: 'A package runner is invoked without an exact package version.',
    remediation: 'Pin the package to an exact version and review the resolved package and publisher before execution.',
    references: [MCP_SECURITY_REFERENCE],
    detect: firstUnpinnedRunner,
  },
  {
    id: 'MCP009',
    severity: 'medium',
    category: 'supply-chain',
    message: 'The setup depends on a moving Git reference.',
    remediation: 'Pin the dependency to an immutable commit or a reviewed release tag with a verified source archive.',
    references: [MCP_SECURITY_REFERENCE],
    detect: firstMovingGitRef,
  },
  {
    id: 'MCP010',
    severity: 'medium',
    category: 'supply-chain',
    message: 'A container image is not pinned to an immutable digest or exact version.',
    remediation: 'Use a reviewed image digest such as `image@sha256:...` and record the source release it represents.',
    references: [MCP_SECURITY_REFERENCE],
    detect: firstFloatingContainer,
  },
  {
    id: 'MCP011',
    severity: 'high',
    category: 'network',
    message: 'The setup references insecure HTTP or a private, link-local, or metadata endpoint.',
    remediation: 'Use HTTPS for remote services and reject private or metadata destinations unless a narrowly reviewed local-development exception applies.',
    references: [MCP_SSRF_REFERENCE],
    detect: firstUrlRisk,
  },
  {
    id: 'MCP012',
    severity: 'medium',
    category: 'environment',
    message: 'The setup appears to inherit or load a broad environment surface.',
    remediation: 'Pass an explicit allowlist of required environment variable names and avoid loading an entire host environment file.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /--env-file(?:=|\s+)/i,
      /\bprocess\.env\b/i,
      /["']env["']\s*:\s*(?:["']\*["']|\[\s*["']\*["']\s*\])/i,
      /\benvFrom\b/i,
    ]),
  },
  {
    id: 'MCP013',
    severity: 'critical',
    category: 'container',
    message: 'The setup grants a container privileged or host-level filesystem access.',
    remediation: 'Remove privileged mode and host-root or Docker-socket mounts. Grant only the minimal read-only paths needed by the server.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /--privileged(?:\s|$)/i,
      /(?:-v|--volume)(?:=|\s+)(?:\/|["']\/)[^\s:]*:\/?(?:host|mnt|workspace)?\b/i,
      /\/var\/run\/docker\.sock\s*:/i,
      /\bprivileged\s*:\s*true\b/i,
    ]),
  },
  {
    id: 'MCP014',
    severity: 'high',
    category: 'network',
    message: 'The setup places a process or container on the host network.',
    remediation: 'Use an isolated network and allow only the specific outbound destinations or local ports the server requires.',
    references: [MCP_SECURITY_REFERENCE],
    detect: (text) => firstPatternMatch(text, [
      /--network(?:=|\s+)host\b/i,
      /\bnetwork_mode\s*:\s*["']?host\b/i,
      /\bhostNetwork\s*:\s*true\b/i,
    ]),
  },
])

export const RULE_CATALOG = Object.freeze(RULES.map(({ detect, ...rule }) => Object.freeze(rule)))
