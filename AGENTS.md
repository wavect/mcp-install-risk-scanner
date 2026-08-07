# Agent guide

This repository owns the MCP Install Risk Scanner core, its Chrome extension,
and release artifacts.

- Preserve unrelated work and check `git status --short` before editing.
- Keep scanning deterministic, synchronous, local-only, and network-free.
- Never add telemetry, remote code, fetched rules, or broad Chrome permissions.
- Redact evidence before it enters a report, UI node, export, or log.
- Do not describe an unflagged input as safe, trusted, or verified.
- Use `apply_patch` for source edits and do not commit `dist/` or `node_modules/`.
- Run `npm test`, `npm run check`, `npm run package`,
  `npm run verify:package`, and `git diff --check` before handoff.
- Do not use em dashes in prose, documentation, or comments.

For long-running work, maintain the ExecPlan in `docs/plans/`.
