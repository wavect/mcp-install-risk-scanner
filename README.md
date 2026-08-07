# MCP Install Risk Scanner

MCP Install Risk Scanner is a deterministic, local-only static analyzer for
Model Context Protocol installation commands and configuration snippets. It
highlights command execution, privilege, secret, filesystem, network, pinning,
environment, and container signals before a user runs the setup.

It powers two interfaces:

- The open-source Manifest V3 Chrome extension in this repository.
- The browser scanner and methodology at
  <https://wavect.io/tools/mcp-install-risk-scanner/>.

The scanner does not execute input, upload input, fetch reputation data, or
claim that an unflagged command is safe.

## Try the core

```js
import { scanMcpInstallText } from '@wavect/mcp-install-risk-core'

const report = scanMcpInstallText('npx @example/mcp-server')
console.log(report.summary)
```

The public report contract is documented in
[`schema/scan-report.schema.json`](schema/scan-report.schema.json), and the
human-readable catalog is available in [`schema/rules.json`](schema/rules.json).

## Load the extension locally

```bash
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select `dist/extension`.

The extension requests only `activeTab`, `scripting`, and `contextMenus`. Page
access is temporary and follows an explicit user action. It has no host
permissions, telemetry, remote code, or fetched rules.

## Build a store package

```bash
npm test
npm run check
npm run package
npm run verify:package
```

The package command writes an ignored ZIP and SHA-256 checksum under `dist/`.
The verification command performs two clean builds and requires identical ZIP
hashes.

## Interpreting results

Reports use three labels only:

- **Stop and review**: one or more high-impact signals need inspection.
- **Review recommended**: lower-impact or supply-chain ambiguity was found.
- **No known patterns flagged**: the current static rules did not match.

The third result is deliberately not called safe. Static analysis cannot prove
publisher identity, package contents, runtime behavior, authorization design,
or the absence of obfuscated behavior.

## Security basis

The official MCP security guidance describes local servers as code running with
the client's privileges. It recommends showing exact startup commands and
highlighting signals such as `sudo`, destructive deletion, network operations,
and sensitive paths:

<https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices#local-mcp-server-compromise>

## License

GPL-3.0-only. See [LICENSE](LICENSE).
