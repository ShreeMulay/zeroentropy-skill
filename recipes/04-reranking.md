# Recipe: Reranking with zerank-2

Use `zerank-2` to reorder candidate documents by semantic relevance to a query.

## When to Use

- You have a candidate set from BM25, vector search, or hybrid retrieval
- You need to boost precision before sending results to an LLM
- You want deterministic, interpretable relevance scores

## How Reranking Works

`zerank-2` is a cross-encoder reranker. It takes a query and a list of candidate documents, then returns them sorted by relevance score (0.0–1.0).

## Basic Usage

### Python

```python
query = "What is Retrieval Augmented Generation?"
documents = [
    "RAG combines retrieval with generation by conditioning the LLM on external documents.",
    "Retrieval-Augmented Generation is a machine learning technique introduced by Meta AI in 2020.",
    "It uses reinforcement learning to generate music sequences.",
    "RAG can improve factual accuracy by grounding answers in retrieved evidence.",
    "Transformers are a type of deep learning architecture.",
]

response = zclient.models.rerank(
    model="zerank-2",
    query=query,
    documents=documents,
)

for result in response.results:
    print(f"Index {result.index}: score {result.relevance_score:.4f}")
    print(f"  {documents[result.index][:80]}...")
```

### TypeScript

```typescript
const query = "What is Retrieval Augmented Generation?";
const documents = [
    "RAG combines retrieval with generation by conditioning the LLM on external documents.",
    "Retrieval-Augmented Generation is a machine learning technique introduced by Meta AI in 2020.",
    "It uses reinforcement learning to generate music sequences.",
    "RAG can improve factual accuracy by grounding answers in retrieved evidence.",
    "Transformers are a type of deep learning architecture.",
];

const response = await zclient.models.rerank({
    model: "zerank-2",
    query,
    documents,
});

for (const result of response.results) {
    console.log(`Index ${result.index}: score ${result.relevance_score.toFixed(4)}`);
    console.log(`  ${documents[result.index].slice(0, 80)}...`);
}
```

## Top N Results

Return only the top N most relevant documents:

```python
response = zclient.models.rerank(
    model="zerank-2",
    query=query,
    documents=documents,
    top_n=3,  # Only return top 3
)
```

## Integration with zsearch

You can also apply reranking directly in `top_snippets` queries:

```python
response = zclient.queries.top_snippets(
    collection_name="pdfs",
    query="What is Retrieval Augmented Generation?",
    k=20,
    reranker="zerank-2",  # All K results will be reranked
    precise_responses=True,
)
```

## Critical Rules

### 1. Scores Are Relative, Not Absolute

`zerank-2` scores are **rank scores**, not calibrated probabilities or cosine similarities.

```python
# WRONG — don't threshold globally
if result.relevance_score > 0.5:
    include_in_context(result)

# CORRECT — use rank ordering
top_results = response.results[:5]  # Take top 5 by rank
```

### 2. Scores Are Not Comparable Across Queries

A score of 0.9 for query A does not mean the same relevance as 0.9 for query B. Always rank within a single query.

### 3. Never Rerank the Entire Corpus

Reranking is computationally expensive. Use a two-stage pipeline:

1. **Retrieve** 50–200 candidates with `zsearch` (fast, approximate)
2. **Rerank** the top candidates with `zerank-2` (slow, precise)
3. **Send** top 5–20 to the LLM

```python
# Stage 1: Fast retrieval
candidates = zclient.queries.top_snippets(
    collection_name="knowledge_base",
    query=user_question,
    k=100,
    latency_mode="low",
)

# Stage 2: Precise reranking
doc_texts = [c.content for c in candidates.results]
reranked = zclient.models.rerank(
    model="zerank-2",
    query=user_question,
    documents=doc_texts,
    top_n=10,
)

# Stage 3: Send top 5 to LLM
top_contexts = [doc_texts[r.index] for r in reranked.results[:5]]
```

## Rate Limits

Reranking consumes bytes based on:
```
Total bytes = 150 + len(query) + sum(len(doc) for doc in documents)
```

Free tier: 500k bytes/min (fast), 5M (slow). Batch ≤100 documents per call.

## See Also

- [03-searching.md](03-searching.md) — How to retrieve candidate documents
- [05-rag-pipeline.md](05-rag-pipeline.md) — End-to-end RAG workflow
