import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createPackage } from './package-extension.mjs'

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'mcp-install-risk-scanner-'))
try {
  const first = await createPackage(path.join(temporaryRoot, 'first'))
  const second = await createPackage(path.join(temporaryRoot, 'second'))
  if (first.digest !== second.digest) throw new Error(`Extension package is not deterministic: ${first.digest} != ${second.digest}`)
  console.log(`deterministic package ${first.digest}`)
} finally {
  if (!temporaryRoot.startsWith(tmpdir())) throw new Error('Refusing to remove an unexpected temporary path.')
  await rm(temporaryRoot, { recursive: true, force: true })
}
