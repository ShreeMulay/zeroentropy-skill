# Recipe: RAG Pipeline

Build a complete Retrieval-Augmented Generation pipeline with ZeroEntropy.

## Pipeline Overview

```
User Query → Embed Query → Search Collection → Rerank Results → Build Context → Send to LLM
```

## When to Use

- Building a chatbot that answers questions from your documents
- Creating an AI assistant for internal knowledge bases
- Implementing grounded generation to reduce hallucinations

## Complete Python Example

```python
from zeroentropy import ZeroEntropy, ConflictError
import time
import random

zclient = ZeroEntropy()
COLLECTION_NAME = "knowledge_base"

# ============================================================================
# Step 1: Create Collection (Idempotent)
# ============================================================================
try:
    zclient.collections.add(collection_name=COLLECTION_NAME)
    print(f"Collection '{COLLECTION_NAME}' created")
except ConflictError:
    print(f"Collection '{COLLECTION_NAME}' already exists")

# ============================================================================
# Step 2: Index Documents
# ============================================================================
documents = [
    {
        "path": "docs/rag-overview.txt",
        "content": {"type": "text", "text": "RAG combines retrieval with generation..."},
        "metadata": {
            "source": "documentation",
            "list:tags": ["ai", "rag"],
            "date": "2024-01-15",
        },
    },
    {
        "path": "docs/embedding-guide.txt",
        "content": {"type": "text", "text": "Embeddings convert text into dense vectors..."},
        "metadata": {
            "source": "documentation",
            "list:tags": ["ai", "embeddings"],
            "date": "2024-01-20",
        },
    },
]

for doc in documents:
    try:
        zclient.documents.add(
            collection_name=COLLECTION_NAME,
            path=doc["path"],
            content=doc["content"],
            metadata=doc["metadata"],
        )
    except ConflictError:
        print(f"Document {doc['path']} already exists, skipping")

# ============================================================================
# Step 3: Poll Until Indexed
# ============================================================================
print("Waiting for indexing to complete...")
max_wait = 60  # seconds
start = time.time()
while time.time() - start < max_wait:
    status = zclient.status.get_status(collection_name=COLLECTION_NAME)
    if status.num_indexing_documents == 0 and status.num_parsing_documents == 0:
        print(f"Indexing complete: {status.num_indexed_documents} documents ready")
        break
    time.sleep(1)
else:
    raise TimeoutError("Indexing did not complete in time")

# ============================================================================
# Step 4: Query with Reranking
# ============================================================================
def rag_query(user_question, k=20, top_n=5):
    # Retrieve candidates
    candidates = zclient.queries.top_snippets(
        collection_name=COLLECTION_NAME,
        query=user_question,
        k=k,
        precise_responses=True,
        reranker="zerank-2",
        include_document_metadata=True,
    )
    
    # Build context from top results
    contexts = []
    for snippet in candidates.results[:top_n]:
        contexts.append({
            "text": snippet.content,
            "source": snippet.path,
            "score": snippet.score,
            "pages": snippet.page_span,
        })
    
    return contexts

# ============================================================================
# Step 5: Use in LLM Prompt
# ============================================================================
user_question = "How does RAG improve factual accuracy?"
contexts = rag_query(user_question)

context_text = "\n\n".join([
    f"[Source: {c['source']} (pages {c['pages']}, score: {c['score']:.4f})]\n{c['text']}"
    for c in contexts
])

prompt = f"""Answer the following question based on the provided context.

Context:
{context_text}

Question: {user_question}

Answer:"""

print(prompt)
# Send prompt to your LLM of choice
```

## Complete TypeScript Example

```typescript
import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();
const COLLECTION_NAME = "knowledge_base";

async function setupCollection() {
    try {
        await zclient.collections.add({ collection_name: COLLECTION_NAME });
        console.log(`Collection '${COLLECTION_NAME}' created`);
    } catch (e: any) {
        if (e.message?.includes("Conflict")) {
            console.log(`Collection '${COLLECTION_NAME}' already exists`);
        } else {
            throw e;
        }
    }
}

async function indexDocuments(docs: any[]) {
    for (const doc of docs) {
        try {
            await zclient.documents.add({
                collection_name: COLLECTION_NAME,
                path: doc.path,
                content: doc.content,
                metadata: doc.metadata,
            });
        } catch (e: any) {
            if (e.message?.includes("Conflict")) {
                console.log(`Document ${doc.path} already exists, skipping`);
            } else {
                throw e;
            }
        }
    }
}

async function waitForIndexing(timeoutSeconds = 60) {
    const start = Date.now();
    while (Date.now() - start < timeoutSeconds * 1000) {
        const status = await zclient.status.getStatus({ collection_name: COLLECTION_NAME });
        if (status.num_indexing_documents === 0 && status.num_parsing_documents === 0) {
            console.log(`Indexing complete: ${status.num_indexed_documents} documents ready`);
            return;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Indexing timeout");
}

async function ragQuery(userQuestion: string, k = 20, topN = 5) {
    const candidates = await zclient.queries.topSnippets({
        collection_name: COLLECTION_NAME,
        query: userQuestion,
        k,
        precise_responses: true,
        reranker: "zerank-2",
        include_document_metadata: true,
    });
    
    return candidates.results.slice(0, topN).map(snippet => ({
        text: snippet.content,
        source: snippet.path,
        score: snippet.score,
        pages: snippet.page_span,
    }));
}

// Usage
async function main() {
    await setupCollection();
    
    const docs = [
        {
            path: "docs/rag-overview.txt",
            content: { type: "text" as const, text: "RAG combines retrieval with generation..." },
            metadata: { source: "documentation", "list:tags": ["ai", "rag"], date: "2024-01-15" },
        },
    ];
    
    await indexDocuments(docs);
    await waitForIndexing();
    
    const contexts = await ragQuery("How does RAG improve factual accuracy?");
    
    const contextText = contexts.map(c => 
        `[Source: ${c.source} (pages ${c.pages}, score: ${c.score.toFixed(4)})]\n${c.text}`
    ).join("\n\n");
    
    const prompt = `Answer the following question based on the provided context.\n\nContext:\n${contextText}\n\nQuestion: How does RAG improve factual accuracy?\n\nAnswer:`;
    
    console.log(prompt);
}

main().catch(console.error);
```

## Best Practices

1. **Use metadata filters** to scope queries (e.g., by tenant, date, tags)
2. **Poll for indexing** — never assume documents are queryable immediately after upload
3. **Rerank in two stages** — retrieve 50-200 candidates, rerank top subset
4. **Include source citations** — always show document paths/page numbers in responses
5. **Handle ConflictError** — use deterministic IDs for idempotent indexing
6. **Implement backoff** — respect rate limits with exponential backoff + jitter

## See Also

- [01-embedding.md](01-embedding.md) — Embedding details
- [02-indexing.md](02-indexing.md) — Indexing details
- [03-searching.md](03-searching.md) — Search query details
- [04-reranking.md](04-reranking.md) — Reranking details
