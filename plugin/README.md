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
  "plugins": [
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
  "plugins": [
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

Add documents to a collection for indexing.

```typescript
// Example: Index a text document
{
  collection_name: "contracts",
  path: "nda/acme-2024.txt",
  content_type: "text",
  content: "This NDA covers...",
  metadata: {
    "list:tags": ["legal", "nda"],
    "date": "2024-01-15"
  }
}
```

## Error Handling

The plugin automatically handles:

- **Rate limits (429)**: Returns retry guidance with backoff timing
- **Conflict errors (409)**: Suggests overwrite or path changes
- **Invalid filters**: Validates `list:` prefix for array metadata

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
