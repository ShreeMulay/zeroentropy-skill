# Recipe: Embedding with zembed-1

Use `zembed-1` to generate dense vector representations for queries or documents.

## When to Use

- Building a custom vector database with ZeroEntropy embeddings
- Pre-computing document embeddings for offline search
- Generating query embeddings for similarity search

## Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `model` | string | Yes | `"zembed-1"` | Model identifier |
| `input_type` | string | Yes | — | `"query"` or `"document"` |
| `input` | string or string[] | Yes | — | Text to embed |
| `dimensions` | int | No | 2560 | Output dimension: 2560, 1280, 640, 320, 160, 80, 40 |
| `encoding_format` | string | No | `"float"` | `"float"` or `"base64"` |
| `latency` | string | No | auto | `"fast"` (subsecond, lower quota) or `"slow"` (higher quota, 2–20s) |

## Python Example

```python
from zeroentropy import ZeroEntropy

zclient = ZeroEntropy()

# Embed a single query
query_embedding = zclient.models.embed(
    model="zembed-1",
    input_type="query",
    input="What is retrieval augmented generation?",
    dimensions=2560,
    encoding_format="float",
    latency="fast",
)

# Embed multiple documents
docs = [
    "RAG combines retrieval with generation.",
    "Transformers are a deep learning architecture.",
]
doc_embeddings = zclient.models.embed(
    model="zembed-1",
    input_type="document",
    input=docs,
    dimensions=2560,
)
```

## TypeScript Example

```typescript
import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();

const queryEmbedding = await zclient.models.embed({
    model: "zembed-1",
    input_type: "query",
    input: "What is retrieval augmented generation?",
    dimensions: 2560,
    encoding_format: "float",
    latency: "fast",
});

const docEmbeddings = await zclient.models.embed({
    model: "zembed-1",
    input_type: "document",
    input: [
        "RAG combines retrieval with generation.",
        "Transformers are a deep learning architecture.",
    ],
    dimensions: 2560,
});
```

## Best Practices

1. **Use `base64` for large batches** — Reduces payload size significantly vs float arrays
2. **Match dimensions** — Index and query must use the same `dimensions` value or retrieval quality degrades silently
3. **Use correct `input_type`** — `"document"` for corpus chunks, `"query"` for user questions (asymmetrical retrieval)
4. **Batch efficiently** — Embed multiple documents in one call when possible

## Common Pitfalls

- **Dimension mismatch**: Creating an index with 2560-dim embeddings and querying with 1280-dim silently corrupts results
- **Latency mode confusion**: `"fast"` has lower quotas; if exceeded, falls back to `"slow"` unless explicitly set
- **Token truncation**: Inputs exceeding max token limits are silently truncated

## See Also

- [02-indexing.md](02-indexing.md) — How to index documents with embeddings
- [04-reranking.md](04-reranking.md) — How to rerank search results
