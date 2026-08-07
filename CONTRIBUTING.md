# Contributing

Thanks for helping improve the MCP Install Risk Scanner.

1. Open an issue describing the missing signal or false positive.
2. Add synthetic positive and benign fixtures before changing a rule.
3. Keep findings deterministic and redact evidence before returning it.
4. Run `npm test`, `npm run check`, and `npm run verify:package`.
5. Explain false-positive tradeoffs in the pull request.

Rules must detect observable command or configuration syntax. Do not add vendor
reputation scores, network lookups, telemetry, remote rules, or claims that a
server is malicious. New permissions require a separate security review and a
clear user-visible need.
