from zeroentropy import ZeroEntropy

zclient = ZeroEntropy()

# Embed a single query
response = zclient.models.embed(
    model="zembed-1",
    input_type="query",
    input="What is retrieval augmented generation?",
    dimensions=2560,
    encoding_format="float",
    latency="fast",
)

print(f"Embedding dimensions: {len(response.results[0].embedding)}")
print(f"First 5 values: {response.results[0].embedding[:5]}")

# Embed multiple documents
docs = [
    "RAG combines retrieval with generation.",
    "Transformers are a deep learning architecture.",
    "Vector databases store embeddings for similarity search.",
]

doc_response = zclient.models.embed(
    model="zembed-1",
    input_type="document",
    input=docs,
    dimensions=2560,
)

print(f"\nEmbedded {len(doc_response.results)} documents")
for i, result in enumerate(doc_response.results):
    print(f"Doc {i}: {len(result.embedding)} dimensions")
