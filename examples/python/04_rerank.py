from zeroentropy import ZeroEntropy

zclient = ZeroEntropy()

query = "What is Retrieval Augmented Generation?"
documents = [
    "RAG combines retrieval with generation by conditioning the LLM on external documents.",
    "Retrieval-Augmented Generation is a machine learning technique introduced by Meta AI in 2020.",
    "It uses reinforcement learning to generate music sequences.",
    "RAG can improve factual accuracy by grounding answers in retrieved evidence.",
    "Transformers are a type of deep learning architecture.",
]

print(f"Query: {query}\n")
print("Documents to rerank:")
for i, doc in enumerate(documents):
    print(f"  [{i}] {doc[:60]}...")

response = zclient.models.rerank(
    model="zerank-2",
    query=query,
    documents=documents,
)

print("\n=== Reranked Results ===")
for result in response.results:
    print(f"Rank {result.index}: score {result.relevance_score:.4f}")
    print(f"  {documents[result.index][:80]}...")

# Top N only
print("\n=== Top 3 Only ===")
top3 = zclient.models.rerank(
    model="zerank-2",
    query=query,
    documents=documents,
    top_n=3,
)

for result in top3.results:
    print(f"[{result.index}] {result.relevance_score:.4f}: {documents[result.index][:60]}...")
