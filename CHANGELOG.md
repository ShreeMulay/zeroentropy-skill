# Changelog

All notable changes to this skill will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.5] - 2026-06-06

### Fixed
- **Plugin cancellation safety**: plugin tools now respect OpenCode abort signals before attempts, during retry backoff, and in SDK request options.
- **Mutation retry semantics**: non-idempotent create/delete/index operations no longer blindly retry after ambiguous retryable failures.
- **Local input validation**: empty embed arrays, empty page arrays, and unsupported metadata values are rejected locally with structured errors.
- **CI coverage**: Forgejo/Woodpecker and GitHub CI now run the full root pytest regression suite.
- **Release packaging**: release artifacts now build and include `plugin/dist`, and version validation covers `plugin/package-lock.json`.

### Changed
- Version metadata aligned to 1.1.5 across skill/package manifests and lockfiles.
- Root hygiene improved with broader `.gitignore`, archived stale OpenSpec changes, and Forgejo-first release instructions.

## [1.1.4] - 2026-06-02

### Fixed
- **Plugin startup safety**: the OpenCode plugin no longer instantiates the ZeroEntropy SDK at module import time; missing `ZEROENTROPY_API_KEY` now returns a structured tool error instead of breaking plugin load.
- **Retry configuration**: invalid `ZEROENTROPY_MAX_RETRIES` values now default safely instead of skipping API calls.
- **Search API contract**: plugin search now sends endpoint-specific params, including `include_document_metadata` for snippets, forwards `latency_mode` for document/page searches, and preserves `document_results` in page/snippet responses.
- **Async indexing semantics**: `zeroentropy_index` now reports accepted/pending semantics instead of claiming documents are immediately indexed.
- **OpenCode config docs**: plugin installation examples now use the singular `plugin` key.
- **Standalone indexing examples**: Python and TypeScript examples now poll document status before claiming query readiness.

### Added
- Permission prompt via `context.ask` before `zeroentropy_delete_collection` deletes a remote collection.
- Real-schema and repository validation tests for version drift, plugin lockfile presence, metadata filter numeric comparisons, OpenCode config examples, and async-indexing docs.

### Changed
- Version metadata aligned to 1.1.4 across skill/package manifests and lockfiles.
- Woodpecker plugin CI now uses `npm ci`; release workflow validates all version sources and packages full skill assets.

## [1.1.3] - 2026-05-30

### Fixed
- **Robust transient-error detection**: `withRetry` now identifies transient failures via the SDK's `APIConnectionError`/`APIConnectionTimeoutError` classes (instanceof) plus Node socket `code`, instead of a broad message regex. A non-network error whose message merely contains "timed out"/"network" no longer triggers spurious retries.
- **Status mis-extraction**: `getErrorStatus` message fallback now only matches a LEADING 3-digit code (e.g. the SDK's `"400 {detail}"` format), so arbitrary numbers in an error body (e.g. "search returned 404 results") are no longer mistaken for an HTTP status.

### Added
- **Real-Zod schema tests** (`tests/schema.test.ts`): 14 tests asserting the `.max(128/100/500_000)` input limits, `.min(1)` non-empty checks, and `.enum()` content_type validation actually reject bad input (the plugin mock previously stubbed Zod away).
- Retry edge-case tests for `APIConnectionError`/timeout (retry) and the "timed out waiting for user input" false-positive (fail fast). Suite now 54 tests.

## [1.1.2] - 2026-05-30

### Fixed
- **Retry semantics narrowed**: `withRetry` no longer retries every status-less error. It now retries only genuine transient network errors (by `code`: ECONNRESET, ETIMEDOUT, ECONNREFUSED, ENOTFOUND, EAI_AGAIN, etc., or matching message patterns) plus 429/5xx. Programmer errors (TypeError) and other unexpected failures now fail fast instead of wasting ~15s on retries that mask the real error.
- **SDK method-probe order**: `list_collections` now calls the real `getList` first (was probing non-existent `get_list` first).

### Changed
- Extracted shared `buildContent()` helper used by `zeroentropy_index` and `zeroentropy_batch`, removing duplicated content-switch logic and divergence risk.

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
