# Recipe: Searching Documents

Query your indexed collections at three granularity levels.

## When to Use

- Finding relevant documents for a user question
- Retrieving specific pages from PDFs
- Extracting precise text snippets for RAG context

## Query Granularity

| Endpoint | Returns | Max K | Use When |
|---|---|---|---|
| `top_documents` | Document paths + scores | 2048 | You need to identify which documents are relevant |
| `top_pages` | Pages within documents | 1024 | You need page-level retrieval (PDFs, multi-page docs) |
| `top_snippets` | Precise text snippets | 128 | You need fine-grained, high-precision results |

## Top Documents

```python
response = zclient.queries.top_documents(
    collection_name="contracts",
    query="What are the payment terms?",
    k=5,
    include_metadata=True,
    latency_mode="low",  # "low" = faster, "high" = more accurate
)

for doc in response.results:
    print(f"{doc.path} (score: {doc.score})")
    if doc.metadata:
        print(f"  Tags: {doc.metadata.get('list:tags', [])}")
```

## Top Pages

```python
response = zclient.queries.top_pages(
    collection_name="contracts",
    query="What are the payment terms?",
    k=3,
    include_content=True,  # Returns full page text + image URL for PDFs
)

for page in response.results:
    print(f"{page.path} page {page.page_index} (score: {page.score})")
    print(page.content)
```

## Top Snippets

```python
response = zclient.queries.top_snippets(
    collection_name="contracts",
    query="What are the payment terms?",
    k=10,
    precise_responses=True,  # ~200 char snippets vs ~2000 default
    reranker="zerank-2",     # Optional: boosts precision
    include_document_metadata=True,
)

for snippet in response.results:
    print(f"{snippet.path} [pages {snippet.page_span}] (score: {snippet.score})")
    print(snippet.content)
    print(f"  Character range: {snippet.start_index}-{snippet.end_index}")
```

## Metadata Filtering

Filters use MongoDB-style operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$and`, `$or`.

### Basic Filters

```python
# Exact match
filter={"tenant_id": {"$eq": "acme"}}

# Range
filter={"date": {"$gte": "2024-01-01", "$lt": "2024-02-01"}}

# Array containment (REQUIRES list: prefix)
filter={"list:tags": {"$in": ["legal", "nda"]}}

# Array exclusion
filter={"list:tags": {"$nin": ["draft", "archived"]}}
```

### Combined Filters

```python
filter={
    "$and": [
        {"tenant_id": {"$eq": "acme"}},
        {"date": {"$gte": "2024-01-01"}},
        {"list:tags": {"$in": ["legal"]}},
    ]
}
```

### ⚠️ Critical: The `list:` Prefix

**Array-valued metadata fields MUST use the `list:` prefix in filters.**

```python
# CORRECT — returns documents tagged with "security" or "policy"
{"list:tags": {"$in": ["security", "policy"]}}

# WRONG — silently returns zero results, no error
{"tags": {"$in": ["security", "policy"]}}
```

## Latency Modes

- `"low"` (default): Faster response, suitable for interactive UI
- `"high"`: Higher accuracy, better for batch evaluation or critical queries

## See Also

- [04-reranking.md](04-reranking.md) — How to rerank search results
- [05-rag-pipeline.md](05-rag-pipeline.md) — End-to-end RAG workflow
