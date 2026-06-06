# ZeroEntropy Agent Skill

> Universal AI agent skill for [ZeroEntropy](https://zeroentropy.dev) — state-of-the-art embeddings, reranking, and end-to-end search.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What This Skill Covers

- **zembed-1** — Multilingual embedding model (2560-dim default, configurable down to 40)
- **zerank-2** — Cross-encoder reranker for boosting search precision
- **zsearch** — End-to-end search engine with OCR, chunking, embedding, and querying
- **Metadata filtering** — MongoDB-style filters with array prefix rules
- **RAG pipelines** — Complete index → search → rerank → synthesize workflows
- **Collection management** — Create, delete, and list collections
- **Batch operations** — Index multiple documents in one call
- **Status polling** — Check document indexing status

## Installation

Install this skill into any AI agent that supports the [Vercel Agent Skills specification](https://github.com/vercel-labs/skills):

```bash
# OpenCode
npx skills add github:ShreeMulay/zeroentropy-skill

# Claude Code / compatible agents
git clone https://github.com/ShreeMulay/zeroentropy-skill.git ~/.claude/skills/zeroentropy
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

### OpenCode (Recommended)

**Full native plugin support with 9 built-in tools.**

```bash
# 1. Install the skill (teaches the agent how to use ZeroEntropy)
npx skills add github:ShreeMulay/zeroentropy-skill

# 2. Activate the native plugin (adds zeroentropy_* tools directly)
# Edit ~/.opencode/config.json:
{
  "plugin": [
    "zeroentropy-opencode-plugin"
  ]
}

# 3. Set your API key
export ZEROENTROPY_API_KEY="your_api_key"
```

**What you get:** 9 native tools (`zeroentropy_search`, `zeroentropy_embed`, `zeroentropy_rerank`, `zeroentropy_index`, `zeroentropy_create_collection`, `zeroentropy_delete_collection`, `zeroentropy_list_collections`, `zeroentropy_status`, `zeroentropy_batch`) with automatic retry, error handling, and type-safe parameters.

### Claude Code

```bash
# Copy to the skills directory:
git clone https://github.com/ShreeMulay/zeroentropy-skill.git ~/.claude/skills/zeroentropy
```

Claude Code will read `SKILL.md` and learn how to use ZeroEntropy's Python/TypeScript SDKs.

### Cursor

```bash
# Copy the skill to Cursor's skills directory
git clone https://github.com/ShreeMulay/zeroentropy-skill.git ~/.cursor/skills/zeroentropy
```

Cursor will discover `SKILL.md` automatically. The agent will use the SDK examples in `examples/` and `recipes/`.

### GitHub Copilot (Chat / VS Code)

```bash
# Copy to the GitHub Copilot skills directory
git clone https://github.com/ShreeMulay/zeroentropy-skill.git ~/.github/skills/zeroentropy
```

Copilot Chat will reference `SKILL.md` when you ask about ZeroEntropy, embeddings, or RAG pipelines.

### Goose

```bash
# Copy to Goose's skills directory
git clone https://github.com/ShreeMulay/zeroentropy-skill.git ~/.goose/skills/zeroentropy
```

Goose will load `SKILL.md` and use the recipes for indexing, searching, and reranking.

### Codex CLI

```bash
# Copy to Codex's skills directory
git clone https://github.com/ShreeMulay/zeroentropy-skill.git ~/.codex/skills/zeroentropy
```

Codex will read `SKILL.md` and follow the decision trees for when to use embed vs search vs rerank.

### Other Agents

Any agent that reads Markdown files from a skills directory:

```bash
# Generic installation — just clone to the agent's skills folder
git clone https://github.com/ShreeMulay/zeroentropy-skill.git <AGENT_SKILLS_DIR>/zeroentropy
```

The agent will automatically discover `SKILL.md` and learn ZeroEntropy patterns.

---

## How to Use

### With the OpenCode Plugin (Native Tools)

Once installed, just ask your agent naturally:

> **"Search my knowledge base for RAG best practices"**

The agent calls `zeroentropy_search` automatically and returns:
```json
{
  "results": [
    { "path": "docs/rag-guide.md", "score": 0.95, "snippet": "..." }
  ],
  "count": 5
}
```

> **"Index these 10 documents into my collection"**

The agent calls `zeroentropy_batch` with all documents at once.

> **"Create a new collection called 'research-papers'"**

The agent calls `zeroentropy_create_collection`.

### Without the Plugin (SDK Mode)

The agent reads `SKILL.md` and writes code using the ZeroEntropy SDK:

```python
from zeroentropy import ZeroEntropy
zclient = ZeroEntropy()

# The agent knows to use zembed-1 for embeddings
response = zclient.models.embed(
    model="zembed-1",
    input_type="query",
    input="What is RAG?",
    dimensions=2560
)
```

### Common Workflows

**1. Full RAG Pipeline:**
```
Create collection → Batch index documents → Check status → Search → Rerank → Synthesize answer
```

**2. Embedding for Clustering:**
```
Generate embeddings (zembed-1) → Use in your own clustering algorithm
```

**3. Two-Stage Retrieval:**
```
Fast search (zsearch) → Rerank top results (zerank-2) → Return best matches
```

---

## Releases & Packages

**No releases or packages needed.** This is a documentation-first skill that agents discover by reading `SKILL.md`.

- **Skill distribution:** Via `git clone` or `npx skills add`
- **Plugin distribution:** Built locally from source after skill install
- **Versioning:** Semantic versioning in `skill.json` and `CHANGELOG.md`

To create a release (optional, for human visibility):
```bash
# Tag the current version after quality gates pass
git tag v1.1.5

# Push Forgejo first, then the GitHub mirror
git push forgejo v1.1.5
git push origin v1.1.5

# GitHub release artifacts are created by .github/workflows/release.yml
```

---

## Plugin Architecture

**Why use the OpenCode plugin?**

| Feature | SDK Mode (No Plugin) | Plugin Mode |
|---------|---------------------|-------------|
| Setup | Agent writes code | Native tools, zero setup |
| Speed | Slow (code generation) | Instant (direct API calls) |
| Error handling | Manual | Automatic retry + backoff |
| Context window | Uses tokens for code | Zero impact |
| Type safety | Runtime | Compile-time (Zod schemas) |

**Plugin tools:**
- `zeroentropy_search` — Search with filters, reranking, snippets/pages/documents
- `zeroentropy_embed` — Generate embeddings (2560→40 dimensions)
- `zeroentropy_rerank` — Reorder results by relevance
- `zeroentropy_index` — Index single document
- `zeroentropy_create_collection` — Create collection
- `zeroentropy_delete_collection` — Delete collection
- `zeroentropy_list_collections` — List all collections
- `zeroentropy_status` — Check if document is indexed
- `zeroentropy_batch` — Index up to 100 documents at once

See [plugin/README.md](plugin/README.md) for technical details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding new recipes, updating API coverage, and submitting pull requests.

## License

MIT © 2025 Shree Mulay
