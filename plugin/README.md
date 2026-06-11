# ZeroEntropy OpenCode Plugin

Native OpenCode plugin that adds ZeroEntropy tools directly to your agent.

## Why Use This?

- **No context rot**: Tools are native OpenCode primitives, not MCP servers
- **Zero overhead**: Direct SDK calls, no extra process management
- **Smart defaults**: Handles rate limits, retries, and common errors automatically
- **Type-safe**: Full TypeScript support with inline documentation

## Installation

### Option 1: npm (when published)

```bash
npm install zeroentropy-opencode-plugin
```

Then add to your `opencode.json`:

```json
{
  "plugin": [
    "zeroentropy-opencode-plugin"
  ]
}
```

### Option 2: Local Development

```bash
cd /path/to/zeroentropy-skill/plugin
npm install
npm run build
```

Then add to `opencode.json`:

```json
{
  "plugin": [
    "/path/to/zeroentropy-skill/plugin"
  ]
}
```

## Tools Added

### `zeroentropy_search`

Search indexed collections with natural language queries.

```typescript
// Example: Search for snippets about payment terms
{
  collection_name: "contracts",
  query: "What are the payment terms?",
  k: 10,
  query_type: "snippets",  // or "documents" or "pages"
  reranker: "zerank-2",
  filter: {
    "list:tags": { "$in": ["legal"] },
    "date": { "$gte": "2024-01-01" }
  }
}
```

### `zeroentropy_embed`

Generate embeddings with zembed-1.

```typescript
// Example: Embed a query for similarity search
{
  texts: ["What is RAG?"],
  input_type: "query",
  dimensions: 2560,
  encoding_format: "float"
}
```

### `zeroentropy_rerank`

Rerank candidate documents by relevance.

```typescript
// Example: Reorder search results
{
  query: "What is 2+2?",
  documents: ["4", "5", "100"],
  top_n: 3
}
```

### `zeroentropy_index`

Add a single document to a collection for indexing.

```typescript
// Example: Index a text document
{
  collection_name: "contracts",
  path: "nda/acme-2024.txt",
  content_type: "text",
  content: "This NDA covers...",
  metadata: {
    tags: ["legal", "nda"],   // plugin-only: arrays auto-normalized to list:tags
    date: "2024-01-15"
  }
}
```

### `zeroentropy_create_collection`

Create a new collection.

```typescript
{ collection_name: "contracts" }
```

### `zeroentropy_delete_collection`

Delete an existing collection.

```typescript
{ collection_name: "contracts" }
```

### `zeroentropy_list_collections`

List all collections available to the configured API key.

```typescript
{}
```

### `zeroentropy_status`

Check a document's indexing status (`indexed` | `pending` | `failed`).

```typescript
{ collection_name: "contracts", path: "nda/acme-2024.txt" }
```

### `zeroentropy_batch`

Batch index up to 100 documents in one call. Supports `pages[]` for `text-pages` content.

```typescript
{
  collection_name: "contracts",
  documents: [
    { path: "a.txt", content: "First doc", content_type: "text" },
    {
      path: "b.txt",
      content: "fallback",
      content_type: "text-pages",
      pages: ["page one", "page two"],
      metadata: { tags: ["batch"] }
    }
  ]
}
```

## Error Handling

- **Reads retry automatically**: search/embed/rerank/list/status retry 429, 5xx, and transient network errors with exponential backoff + jitter
- **Mutations fail fast**: index/batch adds and collection create/delete are not retried after ambiguous failures — check remote state before retrying manually
- **Conflict errors (409)**: Suggests skip, delete/recreate, or deterministic path changes
- **Cancellation-aware**: OpenCode abort signals stop pending retries, backoff waits, and in-flight requests
- **Destructive guard**: `zeroentropy_delete_collection` requires an OpenCode permission prompt before contacting the API

> Note: search `filter` objects are passed to the API as-is. Remember the `list:` prefix for
> array metadata fields — the plugin normalizes index-time metadata arrays into `list:` keys,
> but it does not rewrite query filters.

## Configuration

Set your API key as an environment variable:

```bash
export ZEROENTROPY_API_KEY="your_key_here"
```

For EU endpoints, set in your environment:

```bash
export ZEROENTROPY_BASE_URL="https://eu-api.zeroentropy.dev/v1"
```

## Development

```bash
npm install
npm run dev  # Watch mode
npm run build  # Production build
```

## License

MIT
