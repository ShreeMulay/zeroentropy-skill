# Change: Plugin v1.1.0 - Tests, Error Handling, New Tools

## Status
completed

## Description
Major plugin enhancement adding comprehensive test coverage, robust error handling with retry logic, and three new tools for collection management, status polling, and batch operations.

## Impact
- `plugin/src/index.ts` - Add new tools, improve error handling
- `plugin/package.json` - Add vitest dependency
- `plugin/tests/` - New test suite
- `SKILL.md` - Document new tools and patterns
- `README.md` - Update with new capabilities

## Acceptance Criteria
- [x] Vitest test suite covers all plugin tools with mocked client
- [x] Error handling includes retry with exponential backoff for 429s
- [x] New tools: collection management, status polling, batch index
- [x] All tests pass (`npm test`)
- [x] Plugin builds without errors (`npm run build`)
- [x] Documentation updated with new tool examples
