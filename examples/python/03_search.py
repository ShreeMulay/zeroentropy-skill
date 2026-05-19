from zeroentropy import ZeroEntropy

zclient = ZeroEntropy()
COLLECTION_NAME = "example_contracts"

# Query for top documents
print("=== Top Documents ===")
response = zclient.queries.top_documents(
    collection_name=COLLECTION_NAME,
    query="What are the payment terms?",
    k=5,
    include_metadata=True,
)

for doc in response.results:
    print(f"{doc.path} (score: {doc.score:.4f})")
    if doc.metadata:
        print(f"  Tags: {doc.metadata.get('list:tags', [])}")

# Query for snippets with metadata filter
print("\n=== Top Snippets (filtered) ===")
response = zclient.queries.top_snippets(
    collection_name=COLLECTION_NAME,
    query="confidential information requirements",
    k=3,
    precise_responses=True,
    filter={
        "list:tags": {"$in": ["nda", "confidential"]},
    },
)

for snippet in response.results:
    print(f"\n{snippet.path} [pages {snippet.page_span}] (score: {snippet.score:.4f})")
    print(snippet.content[:200] + "...")
