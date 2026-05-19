from zeroentropy import ZeroEntropy, ConflictError
import time

zclient = ZeroEntropy()
COLLECTION_NAME = "rag_knowledge_base"

def setup():
    """Create collection and index documents."""
    try:
        zclient.collections.add(collection_name=COLLECTION_NAME)
    except ConflictError:
        pass

    docs = [
        {
            "path": "ai/rag_overview.txt",
            "content": {"type": "text", "text": "RAG improves LLM accuracy by retrieving relevant documents before generating answers."},
            "metadata": {"list:tags": ["ai", "rag"], "date": "2024-01-15"},
        },
        {
            "path": "ai/embedding_models.txt",
            "content": {"type": "text", "text": "Embedding models convert text into dense vectors for similarity search."},
            "metadata": {"list:tags": ["ai", "embeddings"], "date": "2024-01-20"},
        },
        {
            "path": "ai/vector_databases.txt",
            "content": {"type": "text", "text": "Vector databases store embeddings and enable fast nearest neighbor search."},
            "metadata": {"list:tags": ["ai", "databases"], "date": "2024-01-25"},
        },
    ]

    for doc in docs:
        try:
            zclient.documents.add(
                collection_name=COLLECTION_NAME,
                path=doc["path"],
                content=doc["content"],
                metadata=doc["metadata"],
            )
        except ConflictError:
            pass

    # Poll until ready
    print("Waiting for indexing...")
    for _ in range(30):
        status = zclient.status.get_status(collection_name=COLLECTION_NAME)
        if status.num_indexing_documents == 0:
            print(f"Ready: {status.num_indexed_documents} documents")
            break
        time.sleep(1)

def rag_query(question: str, k: int = 10, top_n: int = 3):
    """Execute RAG query: retrieve, rerank, return context."""
    # Retrieve snippets
    snippets = zclient.queries.top_snippets(
        collection_name=COLLECTION_NAME,
        query=question,
        k=k,
        precise_responses=True,
        reranker="zerank-2",
    )

    # Build context
    contexts = []
    for snippet in snippets.results[:top_n]:
        contexts.append({
            "text": snippet.content,
            "source": snippet.path,
            "score": snippet.score,
        })

    return contexts

def build_prompt(question: str, contexts: list) -> str:
    """Build LLM prompt with retrieved context."""
    context_text = "\n\n".join([
        f"[Source: {c['source']} (relevance: {c['score']:.4f})]\n{c['text']}"
        for c in contexts
    ])

    return f"""Answer the question based on the provided context.

Context:
{context_text}

Question: {question}

Answer:"""

if __name__ == "__main__":
    setup()

    question = "How do embeddings help with search?"
    contexts = rag_query(question)

    print(f"\nQuestion: {question}")
    print(f"Retrieved {len(contexts)} contexts\n")

    for i, ctx in enumerate(contexts, 1):
        print(f"Context {i} (score: {ctx['score']:.4f}):")
        print(f"  Source: {ctx['source']}")
        print(f"  Text: {ctx['text'][:100]}...\n")

    prompt = build_prompt(question, contexts)
    print("=== LLM Prompt ===")
    print(prompt)
