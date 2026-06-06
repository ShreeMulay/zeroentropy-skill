# OpenSpec: ZeroEntropy Agent Skill

## Project Overview

The ZeroEntropy Agent Skill is a universal AI agent skill that enables any compatible agent (OpenCode, Claude Code, Cursor, Copilot, etc.) to effectively use ZeroEntropy's state-of-the-art retrieval infrastructure.

## Scope

### In Scope
- zembed-1 embedding model integration
- zerank-2 reranking model integration
- zsearch end-to-end search engine integration
- Metadata filtering with proper `list:` prefix handling
- RAG pipeline recipes (index → search → rerank → synthesize)
- Python and TypeScript SDK examples
- Cross-platform agent compatibility (OpenCode, Claude Code, Cursor, Copilot, Goose, Codex)

### Out of Scope (Future Versions)
- Custom wrapper/SDK libraries (skill is documentation-first)
- Real-time streaming APIs
- Advanced multi-modal retrieval (images, audio)
- Enterprise SSO/SAML configuration guides

## Tech Stack

- **Documentation**: Markdown (SKILL.md format per Vercel Agent Skills spec)
- **Examples**: Python 3.11+, TypeScript/Node 20+
- **SDK Dependencies**: `zeroentropy` (Python), `zeroentropy` (npm)
- **Testing**: pytest (Python), vitest (TypeScript)
- **CI/CD**: Woodpecker CI on Forgejo primary; GitHub Actions on mirror
- **License**: MIT

## Target Agents

| Agent | Installation Method | Status |
|---|---|---|
| OpenCode | `npx skills add github:ShreeMulay/zeroentropy-skill` | Primary |
| Claude Code | Skills directory or plugin marketplace | Supported |
| Cursor | `.cursor/skills/` directory | Supported |
| GitHub Copilot | `.github/skills/` directory | Supported |
| Goose | `.goose/skills/` directory | Supported |
| Codex CLI | `.codex/skills/` directory | Supported |

## Versioning

- Skill version follows Semantic Versioning (semver)
- Version is independent of ZeroEntropy SDK version
- Version is tracked in `skill.json` and `SKILL.md` header

## Success Criteria

1. Agent can successfully embed text using zembed-1
2. Agent can index documents into zsearch collections
3. Agent can query with metadata filters using correct `list:` prefix
4. Agent can rerank results using zerank-2
5. Agent can build end-to-end RAG pipelines
6. All examples are runnable and tested
7. SKILL.md passes lint validation
8. Integration tests pass against live API
