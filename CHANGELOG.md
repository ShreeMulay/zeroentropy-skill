# Changelog

All notable changes to this skill will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-05-25

### Fixed
- **`zeroentropy_status`**: removed dead `documents.status` fallback (not in SDK); now uses real `documents.getInfo` with `{ document: { index_status } }` envelope. Tests updated to mock the real method.
- **`normalizeIndexStatus`**: handles `not_indexed` (→ pending) and `failed` states.
- **`zeroentropy_index`**: removed misleading `overwrite` parameter that was silently dropped (live API does not support overwrite).
- **409 error suggestion**: updated to recommend delete/recreate instead of unavailable overwrite.

### Added
- **`zeroentropy_batch`**: optional `pages[]` support for `text-pages` content, matching `zeroentropy_index`.
- Tests for `not_indexed`/`indexing_failed` status normalization and batch pages forwarding.

### Changed
- Version bumped to 1.1.0 across `plugin/package.json`, `skill.json`, `package.json`, and `SKILL.md`.
- `plugin/README.md` now documents all 9 tools.

## [1.1.0] - 2026-05-20

### Added
- **3 new plugin tools**: collection management, status polling, batch operations
- **Robust error handling**: automatic retry with exponential backoff (1s, 2s, 4s, 8s) for 429/5xx errors
- **Comprehensive test suite**: 23 Vitest tests covering all 7 plugin tools with mocked client
- **Plugin activation guide**: `~/.opencode/config.json` setup instructions

### Fixed
- TypeScript compilation errors with Zod v4 syntax (`z.record(keyType, valueType)`)
- ESM module configuration for proper exports
- Dependency versions aligned with actual npm packages

## [1.0.0] - 2025-05-19

### Added
- Initial release of the ZeroEntropy agent skill
- Coverage for zembed-1 embeddings, zerank-2 reranking, and zsearch
- 5 recipe guides: embedding, indexing, searching, reranking, RAG pipeline
- Python and TypeScript examples for all recipes
- Metadata filter JSON schema
- Index configuration JSON schema
- Comprehensive pitfalls documentation ranked by severity
- CI/CD workflows for linting, testing, and release

### Notes
- Skill targets ZeroEntropy API v1
- Tested with zeroentropy Python SDK and Node SDK
