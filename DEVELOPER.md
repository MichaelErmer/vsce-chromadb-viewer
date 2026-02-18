# Developer guide — ChromaDB Viewer (VS Code extension)

This document contains development, testing and release instructions for contributors and maintainers.

## Prerequisites
- Node.js >= 20 (required by `chromadb`)
- npm
- Docker & docker-compose (for integration tests)
- VS Code (for debugging the extension)

## Install
```bash
npm ci
```

## Build & run (development)
- Build webview UI: `npm run build-webview`
- Compile TypeScript: `npm run compile`
- Run extension in VS Code: press **F5** (Extension Development Host)

## Local test environment (integration)
1. Start test Chroma server:
   - `npm run test:docker:up`
2. Seed test data (waits for server readiness):
   - `npm run test:seed`
3. Run integration tests:
   - `npm test`  (uses VS Code Test Runner / `@vscode/test-electron`)
4. Tear down test environment:
   - `npm run test:docker:down`

Notes:
- Tests expect a running Chroma service at the configured `chromadb.host`/`port`.
- CI runs the same start/seed/teardown steps (see `.github/workflows`).

## Seed script
- Script: `scripts/seed-chromadb.ts`
- Creates tenant `test_tenant`, database `test_db` and example collections + records used by tests.

## Quick code map
- Extension entry: `src/extension.ts`
- Client wrapper: `src/client/chromaClient.ts`
- Tree provider: `src/providers/chromaTreeProvider.ts`
- Commands: `src/commands/*`
- Webview UI: `webview-ui/` (React + Vite)
- Tests: `src/test/suite`

## Packaging & publishing
- Create VSIX: `npx vsce package`
- Publish to Marketplace from CI: workflow `release.yml` uses `npx vsce publish` with `VSCE_TOKEN` secret
- Release workflow is triggered by a git tag matching `v*.*.*` (e.g. `v1.2.3`)

## CI notes
- CI requires Node 20, uses `xvfb-run` to run VS Code integration tests headless, and starts a Dockerized Chroma instance for integration tests.
- If release creation fails with 403, check repository Actions permissions (Settings → Actions → Workflow permissions must allow **Read and write**), or provide a PAT secret as a fallback.

## Troubleshooting
- If tests fail with missing embedding function errors, either:
  - Provide embeddings explicitly in tests, or
  - Install `@chroma-core/default-embed` in the runtime environment.
- If UI tests crash with `Missing X server or $DISPLAY`, ensure CI uses `xvfb-run`.
- If VSIX packaging omits `chromadb`, ensure `.vscodeignore` does not exclude `node_modules/chromadb` (use `!node_modules/chromadb/**` to include it).

## Contributing
- Fork → branch → PR. Add tests for any code changes. CI will run integration tests on PRs.

---
