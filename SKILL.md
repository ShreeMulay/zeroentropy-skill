---
name: zeroentropy
description: ZeroEntropy integration for AI agents — embeddings (zembed-1), reranking (zerank-2), and end-to-end search (zsearch). Provides recipes for indexing documents, querying with metadata filters, and building production RAG pipelines.
license: MIT
compatibility: opencode, claude-code, cursor, copilot, goose, codex
metadata:
  category: data
  domain: search
  tools: zeroentropy, zembed, zerank, zsearch
  version: "1.1.6"
---

> ZeroEntropy Skill v1.1.6 — API: v1 — Last verified: 2026-06-11

# ZeroEntropy Agent Skill

## Quick Routing

**What are you trying to do?**

| Goal | Use | Go To |
|---|---|---|
| Get vector embeddings for my own vector DB | `zembed-1` standalone | [§1 Embedding](#1-embedding-zembed-1) |
| Reorder search results I already have | `zerank-2` standalone | [§2 Reranking](#2-reranking-zerank-2) |
| Search documents I've already indexed | `zsearch` queries | [§3 Searching](#3-indexing--search-zsearch) |
| Upload documents and make them searchable | `zsearch` indexing | [§3 Indexing](#3-indexing--search-zsearch) |
| Build a complete Q&A system over documents | Full RAG pipeline | [§4 RAG Pipeline](#4-rag-pipeline-recipe) |
| Something broke silently | Pitfalls guide | [§5 ⚠️ Pitfalls](#5-pitfalls)

**Decision Tree:**

```text
Do you have documents indexed in ZeroEntropy?
├── YES → Do you need to search them?
│   ├── YES → Use zsearch queries (§3)
│   └── NO  → Check status/polling (§3)
└── NO  → Do you have a vector database already?
    ├── YES → Use zembed-1 to generate embeddings (§1)
    └── NO  → Use zsearch to index + search (§3 → §4)

Do you have candidate results that need better ranking?
├── YES → Use zerank-2 reranking (§2)
└── NO  → Retrieve candidates first with zsearch (§3)
```

## Setup

1. Install the official SDK:
   - Python: `pip install zeroentropy`
   - Node: `npm install zeroentropy`
2. Set your API key: `export ZEROENTROPY_API_KEY="your_key"`
3. (Optional) Use EU endpoints: set `base_url` to `https://eu-api.zeroentropy.dev/v1`

## When to Use What

### Use `zembed-1` (Embeddings) When:
- You have your own vector database (Pinecone, Weaviate, Qdrant, etc.)
- You need embeddings for clustering, classification, or similarity tasks
- You're building a custom retrieval pipeline
- **Don't use if**: You want end-to-end search with indexing included

### Use `zerank-2` (Reranking) When:
- You already have candidate documents from another search system
- You need to boost precision of existing results
- You're doing two-stage retrieval (fast retrieval → precise reranking)
- **Don't use if**: You don't have candidate documents yet (use zsearch first)

### Use `zsearch` (Full Search) When:
- You want document indexing + search in one platform
- You need OCR for PDFs/DOCX files
- You want metadata filtering built-in
- You need snippet-level retrieval
- **Don't use if**: You already have a vector DB and just need embeddings

### Use Full RAG Pipeline When:
- You're building a question-answering system
- You need grounded generation (reduce hallucinations)
- You want automatic context injection into LLM prompts
- **Always includes**: zsearch indexing → querying → reranking → synthesis

## Plugin Integration (OpenCode)

If you're using OpenCode, you can install this skill alongside a lightweight plugin that adds native tools:

```bash
# Install the skill (teaches the agent how to use ZeroEntropy)
npx skills add github:ShreeMulay/zeroentropy-skill

# Optional: Install the OpenCode plugin (adds native zeroentropy tools)
# Add to your opencode.json plugin array:
# "zeroentropy-opencode-plugin"
```

**With the plugin installed**, OpenCode gains these native tools:
- `zeroentropy_search` — Search indexed collections
- `zeroentropy_embed` — Generate embeddings
- `zeroentropy_rerank` — Rerank candidate documents
- `zeroentropy_index` — Add documents to collections
- `zeroentropy_create_collection` — Create collections
- `zeroentropy_delete_collection` — Delete collections
- `zeroentropy_list_collections` — List collections
- `zeroentropy_status` — Check document indexing status
- `zeroentropy_batch` — Batch index multiple documents

**Without the plugin**, the agent uses the SDK directly following the recipes below.

## 1. Embedding (zembed-1)

Use `zembed-1` to generate dense vector representations for queries or documents.

### Key Parameters
- `model`: `"zembed-1"`
- `input_type`: `"query"` or `"document"` (asymmetrical retrieval)
- `dimensions`: `2560` (default), `1280`, `640`, `320`, `160`, `80`, `40`
- `encoding_format`: `"float"` (default) or `"base64"` (more efficient)
- `latency`: `"fast"` (subsecond, lower quota) or `"slow"` (higher quota, 2–20s)

### Python Example
```python
from zeroentropy import ZeroEntropy
zclient = ZeroEntropy()

response = zclient.models.embed(
    model="zembed-1",
    input_type="query",
    input="What is retrieval augmented generation?",
    dimensions=2560,
    encoding_format="float",
    latency="fast",
)
# response.results[0].embedding is a List[float]
```

### TypeScript Example
```typescript
import { ZeroEntropy } from 'zeroentropy';
const zclient = new ZeroEntropy();

const response = await zclient.models.embed({
    model: "zembed-1",
    input_type: "query",
    input: "What is retrieval augmented generation?",
    dimensions: 2560,
    encoding_format: "float",
    latency: "fast",
});
// response.results[0].embedding is number[]
```

### Best Practices
- Use `base64` encoding for large batches to reduce payload size.
- Match `dimensions` between indexing and querying or retrieval quality degrades silently.
- Use `"document"` input_type for corpus chunks and `"query"` for user questions.

## 2. Reranking (zerank-2)

Use `zerank-2` to reorder a candidate set of documents by semantic relevance to a query.

### Key Parameters
- `model`: `"zerank-2"` (flagship), `"zerank-1"`, or `"zerank-1-small"`
- `query`: the user question
- `documents`: array of candidate strings
- `top_n`: (optional) return only top N results

### Python Example
```python
response = zclient.models.rerank(
    model="zerank-2",
    query="What is 2+2?",
    documents=["4", "The answer is definitely 1 million."],
)
# Results sorted by descending relevance_score (0.0–1.0)
for doc in response.results:
    print(doc.index, doc.relevance_score)
```

### Critical Rules
- **Scores are relative, not absolute.** Do NOT threshold globally (e.g., at 0.5). Use rank ordering.
- **Scores are NOT comparable across queries.** A score of 0.9 in query A does not mean the same relevance as 0.9 in query B.
- **Never rerank the entire corpus.** Retrieve 50–200 candidates with zsearch, then rerank the top subset.

## 3. Indexing & Search (zsearch)

zsearch is ZeroEntropy's end-to-end search engine: ingestion → embedding → storage → querying.

### Collections & Documents
- **Collection**: a logical datastore (like a database). Names are strings up to 1024 bytes.
- **Document**: a unit of indexing. Each has a unique `path` (like a filepath) and optional metadata.
- **Pages**: ordered segments within a document (e.g., PDF pages, conversation messages).

### Document Upload
```python
zclient.documents.add(
    collection_name="contracts",
    path="nda/acme-2024.txt",
    content={"type": "text", "text": "This NDA covers..."},
    metadata={
        "tenant_id": "acme",
        "list:tags": ["legal", "nda"],  # MUST use list: prefix for arrays
        "date": "2024-01-15",
    },
)
```

Content types:
- `"text"`: plain text
- `"text-pages"`: array of strings (ordered pages)
- `"text-pages-unordered"`: array of strings (independent entries, e.g., CSV rows)
- `"auto"`: base64-encoded binary (PDF, DOCX, PPT — OCR handled automatically)

### Query Granularity
| Endpoint | Use When | Max K |
|---|---|---|
| `top_documents` | Find relevant documents | 2048 |
| `top_pages` | Find relevant pages within docs | 1024 |
| `top_snippets` | Find precise text snippets | 128 |

### Query Example
```python
response = zclient.queries.top_snippets(
    collection_name="contracts",
    query="What are the payment terms?",
    k=10,
    reranker="zerank-2",          # optional: boosts precision
    precise_responses=True,       # ~200 char snippets vs ~2000 default
    filter={
        "list:tags": {"$in": ["legal"]},
        "date": {"$gte": "2024-01-01"},
    },
)
```

### Metadata Filtering
Filters use MongoDB-style operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$and`, `$or`.

**CRITICAL**: Array-valued metadata fields MUST use the `list:` prefix in filters:
```python
# CORRECT
{"list:tags": {"$in": ["security", "policy"]}}

# WRONG — silently returns zero results
{"tags": {"$in": ["security", "policy"]}}
```

## 4. RAG Pipeline Recipe

End-to-end: index documents → query → rerank → synthesize.

```python
from zeroentropy import ZeroEntropy, ConflictError
import time

zclient = ZeroEntropy()

# 1. Create collection (idempotent)
try:
    zclient.collections.add(collection_name="knowledge_base")
except ConflictError:
    pass

# 2. Index documents with metadata
for doc in documents:
    zclient.documents.add(
        collection_name="knowledge_base",
        path=doc["path"],
        content={"type": "text", "text": doc["text"]},
        metadata=doc["metadata"],
    )

# 3. Poll until indexed
while True:
    status = zclient.status.get_status(collection_name="knowledge_base")
    if status.num_indexing_documents == 0:
        break
    time.sleep(1)

# 4. Query with reranking
snippets = zclient.queries.top_snippets(
    collection_name="knowledge_base",
    query=user_question,
    k=20,
    reranker="zerank-2",
    precise_responses=True,
)

# 5. Send top 5 snippets to LLM context
top_snippets = snippets.results[:5]
context = "\n\n".join([s.content for s in top_snippets])
# ... feed context + user_question to LLM
```

## 5. Pitfalls

### 🔴 Silent Failures (wrong answers, no error)

| Pitfall | Rule |
|---|---|
| **`list:` metadata prefix** | Array metadata fields MUST be keyed with `list:` prefix at index time AND in filters. Omitting it silently returns zero results. |
| **Embedding dimension lock** | Index dimension is immutable. Always use the same `dimensions` value for indexing and querying. Mixing values silently corrupts retrieval. |
| **Rerank score semantics** | `zerank-2` scores are relative rank scores (0–1), NOT cosine similarities or calibrated probabilities. Do NOT threshold globally. Use rank ordering only. |
| **Async indexing** | `documents.add` returns before the document is queryable. Poll `documents.get_info` for `index_status == "indexed"` before querying. Do NOT assume immediate consistency. |

### 🟡 Hard Failures (visible, recoverable)

| Pitfall | Rule |
|---|---|
| **`ConflictError` (409)** | Re-indexing the same `path` raises 409. The current live API reports `overwrite` as unavailable, so handle explicitly: skip, delete/recreate intentionally, or use a different deterministic path. |
| **Rate limits (429)** | Free tier: 500k bytes/min (fast), 5M (slow). Implement exponential backoff with jitter. Batch: ≤128 embed, ≤100 rerank per call. |
| **Embedding/rerank latency** | `latency` uses `"fast"` or `"slow"`. `"fast"` is subsecond with lower quota; `"slow"` has higher quota and higher latency. |
| **Search latency mode** | Search `latency_mode` uses `"low"` (default, faster) or `"high"` (more accurate, slower). Interactive UI → `"low"`; batch eval → `"high"`. |
| **Token truncation** | Inputs exceeding max token limits are silently truncated. Log lengths before submission. |
| **Filter syntax** | Wrong operators return empty results, not errors. Validate against the metadata filter schema before querying. |

### 🟢 Quality of Life

- Collection names are case-sensitive and immutable.
- Pagination cursor tokens expire — do not persist them.
- Never hardcode `ZEROENTROPY_API_KEY`; always use env vars.
- Use `base64` encoding format for large embedding payloads.
- Batch delete up to 64 paths at once.

## Plugin Tool Reference

When using the OpenCode plugin, these tools are available natively:

### Collection Management

```typescript
// Create a collection
zeroentropy_create_collection({ collection_name: "my-kb" })

// Delete a collection
zeroentropy_delete_collection({ collection_name: "my-kb" })

// List all collections
zeroentropy_list_collections({})
```

### `zeroentropy_status` — Check Document Status

```typescript
// Check if a document is indexed and ready to query
{ collection_name: "my-kb", path: "doc.txt" }
// Returns: { status: "indexed" | "pending" | "failed", last_updated, ... }
```

### `zeroentropy_batch` — Batch Index Documents

```typescript
// Index multiple documents at once
{
  collection_name: "my-kb",
  documents: [
    { path: "doc1.txt", content: "...", content_type: "text" },
    { path: "doc2.txt", content: "...", content_type: "text", metadata: { tags: ["important"] } }
  ]
}
// Returns: { success_count, failed_count, errors: [...] }
```

### Error Handling

Plugin error behavior depends on whether the operation can be safely repeated:

- **Reads retry automatically** (`search`, `embed`, `rerank`, `list_collections`, `status`): 429, 5xx, and transient network failures retry up to 4 times with exponential backoff + jitter (1s, 2s, 4s, 8s).
- **Mutations fail fast** (`index`, `batch` document adds, `create_collection`, `delete_collection`): they are never retried automatically, because a failed-looking attempt may already have changed remote state. The structured error suggests checking ZeroEntropy before retrying manually.
- **409 (Conflict)** / **400 (Bad Request)**: structured error with a suggestion, no retry.
- **Cancellation**: OpenCode abort signals are honored before attempts, during backoff waits, and inside in-flight SDK requests.
- **Destructive guard**: `zeroentropy_delete_collection` requires an OpenCode permission prompt (`context.ask`) and fails closed if the prompt is denied or unavailable.

## Reference Tables

### Endpoints
| SDK Path | HTTP Endpoint | Purpose |
|---|---|---|
| `collections.add` | POST /collections | Create collection |
| `collections.get_list` | GET /collections | List collections |
| `documents.add` | POST /documents | Add document |
| `documents.get_info` | GET /documents/info | Check document status |
| `documents.delete` | DELETE /documents | Delete document(s) |
| `queries.top_documents` | POST /queries/top-documents | Document retrieval |
| `queries.top_pages` | POST /queries/top-pages | Page retrieval |
| `queries.top_snippets` | POST /queries/top-snippets | Snippet retrieval |
| `models.embed` | POST /models/embed | Embedding |
| `models.rerank` | POST /models/rerank | Reranking |
| `status.get_status` | GET /status | Indexing status |

### Rate Limits (Free Tier)
| Mode | Bytes/min | Requests/min |
|---|---|---|
| fast | 500,000 | 100 |
| slow | 5,000,000 | 100 |

### Pricing
| Model | Price per 1M tokens |
|---|---|
| zembed-1 | $0.050 |
| zerank-2 | $0.025 |
| zerank-1 | $0.025 |
| zerank-1-small | $0.025 |

## Changelog

- **v1.1.6** (2026-06-11): Corrects error-handling docs (read-retry vs mutation fail-fast), adds Woodpecker lint/typecheck parity, fixes retry-backoff abort-listener cleanup, reports skipped documents on aborted batches, and removes dead SDK fallbacks.
- **v1.1.5** (2026-06-06): Hardens OpenCode plugin cancellation, mutation retry semantics, metadata/page/embed validation, CI regression coverage, release packaging, and project hygiene.
- **v1.1.0** (2026-05-25): OpenCode plugin with 9 native tools (search, embed, rerank, index, create/delete/list collection, status, batch), retry with backoff + jitter, metadata `list:` auto-normalization, and live-API hardening.
- **v1.0.0** (2025-05-19): Initial release. Covers zembed-1, zerank-2, zsearch, metadata filtering, and RAG pipeline recipe.
