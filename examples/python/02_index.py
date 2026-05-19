from zeroentropy import ZeroEntropy, ConflictError

zclient = ZeroEntropy()
COLLECTION_NAME = "example_contracts"

# Create collection (idempotent)
try:
    zclient.collections.add(collection_name=COLLECTION_NAME)
    print(f"Created collection: {COLLECTION_NAME}")
except ConflictError:
    print(f"Collection already exists: {COLLECTION_NAME}")

# Index text documents
documents = [
    {
        "path": "contracts/nda_acme_2024.txt",
        "content": {"type": "text", "text": "This Non-Disclosure Agreement covers confidential information..."},
        "metadata": {
            "tenant_id": "acme",
            "date": "2024-01-15",
            "list:tags": ["legal", "nda", "confidential"],
        },
    },
    {
        "path": "contracts/sla_service_2024.txt",
        "content": {"type": "text", "text": "This Service Level Agreement guarantees 99.9% uptime..."},
        "metadata": {
            "tenant_id": "acme",
            "date": "2024-02-01",
            "list:tags": ["legal", "sla", "service"],
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
        print(f"Indexed: {doc['path']}")
    except ConflictError:
        print(f"Already exists: {doc['path']}")

print("\nIndexing complete. Documents ready for querying.")
