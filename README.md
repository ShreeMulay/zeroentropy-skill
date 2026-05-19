# ZeroEntropy Agent Skill

> Universal AI agent skill for [ZeroEntropy](https://zeroentropy.dev) — state-of-the-art embeddings, reranking, and end-to-end search.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What This Skill Covers

- **zembed-1** — Multilingual embedding model (2560-dim default, configurable down to 40)
- **zerank-2** — Cross-encoder reranker for boosting search precision
- **zsearch** — End-to-end search engine with OCR, chunking, embedding, and querying
- **Metadata filtering** — MongoDB-style filters with array prefix rules
- **RAG pipelines** — Complete index → search → rerank → synthesize workflows

## Installation

Install this skill into any AI agent that supports the [Vercel Agent Skills specification](https://github.com/vercel-labs/skills):

```bash
# OpenCode
npx skills add github:ShreeMulay/zeroentropy-skill

# Claude Code (if supported)
/plugin marketplace add github:ShreeMulay/zeroentropy-skill
```

The skill will be discovered automatically by OpenCode, Claude Code, Cursor, GitHub Copilot, and other compatible agents.

## Quick Start

1. Get an API key at [dashboard.zeroentropy.dev](https://dashboard.zeroentropy.dev)
2. Set your environment variable:
   ```bash
   export ZEROENTROPY_API_KEY="your_api_key"
   ```
3. Install the SDK:
   ```bash
   pip install zeroentropy        # Python
   npm install zeroentropy        # Node/TypeScript
   ```
4. Ask your agent to use the ZeroEntropy skill for embedding, search, or RAG tasks.

## Repository Structure

```
zeroentropy-skill/
├── SKILL.md                 # Agent contract — the core skill file
├── README.md                # This file
├── skill.json               # Skill metadata for discovery
├── recipes/                 # Detailed recipe guides
│   ├── 01-embedding.md
│   ├── 02-indexing.md
│   ├── 03-searching.md
│   ├── 04-reranking.md
│   └── 05-rag-pipeline.md
├── examples/                # Runnable code examples
│   ├── python/
│   ├── typescript/
│   └── utils/               # Copy-paste helpers (retry, chunking)
├── schemas/                 # JSON schemas for validation
│   ├── metadata-filter.json
│   └── index-config.json
├── tests/                   # Test suite
└── .github/workflows/       # CI/CD
```

## Supported Agents

| Agent | Installation | Status |
|---|---|---|
| OpenCode | `npx skills add github:ShreeMulay/zeroentropy-skill` | ✅ Supported |
| Claude Code | `/plugin marketplace add` or skills dir | ✅ Supported |
| Cursor | Copy to `.cursor/skills/` | ✅ Supported |
| GitHub Copilot | Copy to `.github/skills/` | ✅ Supported |
| Goose | Copy to `.goose/skills/` | ✅ Supported |
| Codex CLI | Copy to `.codex/skills/` | ✅ Supported |

## OpenCode Plugin (Optional)

For OpenCode users, an optional native plugin adds ZeroEntropy tools directly:

```bash
# Install the skill (required - teaches the agent)
npx skills add github:ShreeMulay/zeroentropy-skill

# Optional: Add the plugin to opencode.json for native tools
{
  "plugins": [
    "zeroentropy-opencode-plugin"
  ]
}
```

**Why use the plugin?**
- Native OpenCode tools (no MCP server overhead)
- Automatic error handling and retry guidance
- Type-safe parameters with inline documentation
- Zero context window impact vs external MCP servers

See [plugin/README.md](plugin/README.md) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding new recipes, updating API coverage, and submitting pull requests.

## License

MIT © 2025 Shree Mulay
