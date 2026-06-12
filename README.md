<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="https://avatars.githubusercontent.com/u/177883875?v=4" alt="ZeroEntropy logo" width="96" height="96">

# 🌀 ZeroEntropy Agent Skill

<p align="center">
  <strong>Universal AI agent skill for ZeroEntropy — state-of-the-art embeddings, reranking, and end-to-end search.</strong>
</p>

<p align="center">
  <a href="https://github.com/ShreeMulay/zeroentropy-skill/releases"><img src="https://img.shields.io/github/v/release/ShreeMulay/zeroentropy-skill?color=blue&label=Release" alt="GitHub release"></a>
  <a href="https://github.com/ShreeMulay/zeroentropy-skill/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/ShreeMulay/zeroentropy-skill/ci.yml?branch=main&label=CI" alt="CI Status"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/agents-6%20platforms-orange" alt="Agents Supported">
  <img src="https://img.shields.io/badge/tools-9%20native-success" alt="Native Tools">
</p>

---

[ZeroEntropy](https://zeroentropy.dev) provides blazing-fast, industry-leading search and retrieval tools. This repository houses the universal agent skill and the OpenCode plugin, empowering your favorite AI coding assistants (OpenCode, Claude Code, Cursor, GitHub Copilot, Goose, Codex) with 9 native high-performance tools.

</div>

## 🧠 Why ZeroEntropy?

Most RAG stacks bolt a generalist embedding API onto a generalist LLM and hope for the best. ZeroEntropy ([YC W25](https://www.ycombinator.com/companies/zeroentropy), $4.2M seed led by Initialized Capital[^1]) makes the opposite bet: **small, retrieval-specialized models beat giant generalist ones at search** — and the receipts back it up:

- 🏆 **Top-ranked reranking** — `zerank-2` scores **NDCG@10 of 0.78 across 29 datasets**[^2], and in Agentset's independent head-to-head it posts **ELO 1638 vs Cohere Rerank 3.5's 1451**, winning **57.2%** of matchups[^3]
- ⚡ **Built for production latency** — mean rerank latency **265ms vs Cohere's 392ms**, with only **2.7%** of requests over 500ms (vs 14.3% for Cohere, 70.8% for Jina)[^2][^3]
- 🌍 **Best-in-class embeddings** — `zembed-1` beats OpenAI Large, Cohere v4, Voyage, BGE-M3, and Gemini Embeddings by **up to +7% Recall@100**, with majority-non-English training data for true multilingual RAG[^4]
- 🔓 **Open weights, no lock-in** — both models are released on [Hugging Face](https://huggingface.co/zeroentropy) and AWS Marketplace; `zembed-1` scales from 2560 down to 40 dimensions with int8/binary quantization[^4]
- 💰 **Half the price** — $0.025/1M tokens vs $0.050 for Cohere reranking[^5], and Assembled measured a **2.8x cost reduction** after moving 100% of reranking traffic over[^6]
- 🩺 **Proven in high-stakes domains** — Vera Health retrieves across **60M+ medical papers** with ZeroEntropy and hit **97.5% on USMLE Steps 1–3** while cutting irrelevant citations by >90%[^7]; Mem0, Sendbird, and Profound run it in production[^8]

| Metric | zerank-2 | Cohere Rerank 3.5 |
|---|---|---|
| Head-to-head ELO[^3] | **1638** | 1451 |
| Win rate[^3] | **57.2%** | 40.9% |
| Mean latency[^3] | **265ms** | 392ms |
| Requests >500ms[^2] | **2.7%** | 14.3% |
| Price / 1M tokens[^5] | **$0.025** | $0.050 |

[^1]: [ZeroEntropy Raises $4.2M Seed Round to Make AI Retrieval Truly Intelligent](https://zeroentropy.dev/articles/zeroentropy-raises-4-2m-seed-round-to-make-ai-retrieval-truly-intelligent)
[^2]: [ZeroEntropy Rerankers — benchmarks and tail-latency data](https://zeroentropy.dev/rerankers)
[^3]: [Agentset (independent): zerank-2 vs Cohere Rerank 3.5](https://agentset.ai/rerankers/compare/zerank-2-vs-cohere-rerank-35)
[^4]: [Introducing zembed-1 — multilingual embedding benchmarks and open weights](https://zeroentropy.dev/articles/introducing-zembed-1-the-worlds-best-multilingual-text-embedding-model)
[^5]: [ZeroEntropy Pricing](https://zeroentropy.dev/pricing/)
[^6]: [How Assembled Powers High-Quality AI Customer Support with ZeroEntropy](https://zeroentropy.dev/articles/how-assembled-powers-high-quality-ai-customer-support-with-zeroentropy)
[^7]: [How Vera Health Achieved State-of-the-Art Clinical Accuracy](https://zeroentropy.dev/articles/how-vera-health-achieved-state-of-the-art-clinical-accuracy-using-zeroentropy/)
[^8]: [zeroentropy.dev — trusted in production by Assembled, Profound, Sendbird, Mem0](https://www.zeroentropy.dev)

---

## ✨ What You Get

ZeroEntropy's powerful engine is built for deep developer integrations, providing:

- **zembed-1** — Multilingual embedding model (2560-dim default, configurable down to 40)
- **zerank-2** — Cross-encoder reranker for boosting search precision
- **zsearch** — End-to-end search engine with OCR, chunking, embedding, and querying
- **Metadata filtering** — MongoDB-style filters with array prefix rules
- **RAG pipelines** — Complete index &rarr; search &rarr; rerank &rarr; synthesize workflows
- **Collection management** — Create, delete, and list collections
- **Batch operations** — Index multiple documents in one call
- **Status polling** — Check document indexing status

---

## 🚀 Quick Start

Get up and running with ZeroEntropy in under 60 seconds:

### 1. Install the Skill
Install the skill into your preferred AI agent:
```bash
npx skills add github:ShreeMulay/zeroentropy-skill
```

### 2. Configure Your API Key
Get your API key at [dashboard.zeroentropy.dev](https://dashboard.zeroentropy.dev) and set it in your environment:
```bash
export ZEROENTROPY_API_KEY="your_api_key"
```

### 3. Ask Your Agent
Ask your agent to perform search, embedding, or RAG tasks:
> *"Search my knowledge base for RAG best practices"*

---

## 🔌 OpenCode Plugin

If you are using **OpenCode**, you can activate the **native plugin** to unlock direct tool execution for maximum performance.

### Configuration
Edit your `~/.opencode/config.json` to include the plugin:

```json
{
  "plugin": [
    "zeroentropy-opencode-plugin"
  ]
}
```

### Installation Options
The plugin will be built locally from source after your skill is installed, or loaded from our packaged release tarball.

---

## 🤖 Supported Agents

This universal skill is fully compatible with any agent that supports the [Vercel Agent Skills specification](https://github.com/vercel-labs/skills).

### OpenCode (Recommended)
**Full native plugin support with 9 built-in tools.**
```bash
# 1. Install the skill
npx skills add github:ShreeMulay/zeroentropy-skill

# 2. Activate the native plugin in ~/.opencode/config.json
# (See the config snippet in the OpenCode Plugin section above)

# 3. Set your API key
export ZEROENTROPY_API_KEY="your_api_key"
```
**Benefits:** Direct execution of the 9 native tools with automatic retry, error handling, and type-safe parameters.

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

## 🧰 Tools

When using the OpenCode plugin, the agent has direct access to these 9 native, type-safe tools:

| Tool | Icon | Description |
| :--- | :---: | :--- |
| `zeroentropy_search` | 🔍 | Search with filters, reranking, snippets/pages/documents |
| `zeroentropy_embed` | 🧬 | Generate embeddings (2560&rarr;40 dimensions) |
| `zeroentropy_rerank` | 📊 | Reorder results by relevance |
| `zeroentropy_index` | 📄 | Index single document |
| `zeroentropy_create_collection` | 📁 | Create collection |
| `zeroentropy_delete_collection` | 🗑️ | Delete collection |
| `zeroentropy_list_collections` | 📋 | List all collections |
| `zeroentropy_status` | ⏳ | Check if document is indexed |
| `zeroentropy_batch` | 📦 | Index up to 100 documents at once |

---

## 🍳 Workflows

The skill guides agents through optimized, multi-step orchestration workflows depending on your request:

### 1. Full RAG Pipeline
```
Create collection ──> Batch index documents ──> Check status ──> Search ──> Rerank ──> Synthesize answer
```
*Ask:* "Search my knowledge base for RAG best practices"
*Execution:* The agent calls `zeroentropy_search` automatically, or writes custom retrieval-augmented code.

### 2. Embedding for Clustering
```
Generate embeddings (zembed-1) ──> Use in your own clustering algorithm
```
*Ask:* "Generate embeddings for these sentences and cluster them"
*Execution:* The agent handles the high-dimensional vectors with `zembed-1` automatically.

### 3. Two-Stage Retrieval
```
Fast search (zsearch) ──> Rerank top results (zerank-2) ──> Return best matches
```
*Ask:* "Perform a two-stage search across my documents"
*Execution:* Combining initial keyword/vector search with precision cross-encoder reranking.

---

### 💡 Example Interactions

#### With the OpenCode Plugin (Native Tools)
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

#### Without the Plugin (SDK Mode)
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

---

## 🏗️ Plugin Architecture

Why use the OpenCode plugin instead of raw SDK code-generation?

| Feature | SDK Mode (No Plugin) | Plugin Mode |
| :--- | :--- | :--- |
| **Setup** | Agent writes code | Native tools, zero setup |
| **Speed** | Slow (code generation) | Instant (direct API calls) |
| **Error Handling** | Manual | Automatic retry + backoff |
| **Context Window** | Uses tokens for code | Zero impact |
| **Type Safety** | Runtime | Compile-time (Zod schemas) |

For deeper technical implementation details, please see [plugin/README.md](plugin/README.md).

---

## 📂 Repository Structure

The project is structured logically for ease of use, extension, and testing:

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

---

## Releases & Packages

This is a documentation-first skill that agents can discover directly from `SKILL.md`, with tagged release artifacts available for pinned installs and human review.

- **Skill distribution:** Via `git clone` or `npx skills add`
- **Plugin distribution:** Built locally from source after skill install, or from the packaged release tarball
- **Versioning:** Semantic versioning in `skill.json` and `CHANGELOG.md`
- **Release assets:** `SKILL.md`, `skill.json`, `README.md`, and `zeroentropy-skill-v1.1.6.tar.gz`

To create the next release:
```bash
# Tag the current version after quality gates pass
git tag v1.1.6

# Push Forgejo first, then the GitHub mirror
git push forgejo v1.1.6
git push origin v1.1.6

# GitHub release artifacts are created by .github/workflows/release.yml
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding new recipes, updating API coverage, and submitting pull requests.

---

## 📄 License

MIT © 2025 Shree Mulay
