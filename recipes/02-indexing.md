# Recipe: Indexing Documents

Upload documents to a zsearch collection for semantic search.

## When to Use

- Building a searchable knowledge base
- Ingesting PDFs, DOCX, or text files for RAG
- Creating multi-tenant document collections

## Collections

Collections are independent datastores. Create one per project or tenant:

```python
from zeroentropy import ZeroEntropy, ConflictError

zclient = ZeroEntropy()

# Create collection (handle if already exists)
try:
    zclient.collections.add(collection_name="contracts")
except ConflictError:
    pass

# List collections
response = zclient.collections.get_list()
print(response.collection_names)
```

## Document Upload

### Text Documents

```python
zclient.documents.add(
    collection_name="contracts",
    path="nda/acme-2024.txt",
    content={"type": "text", "text": "This NDA covers..."},
    metadata={
        "tenant_id": "acme",
        "date": "2024-01-15",
        "list:tags": ["legal", "nda"],  # MUST use list: prefix for arrays
    },
)
```

### PDF / Binary Files

```python
import base64

with open("document.pdf", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

zclient.documents.add(
    collection_name="contracts",
    path="docs/document.pdf",
    content={"type": "auto", "base64_data": b64},
    metadata={"source": "upload", "list:tags": ["pdf"]},
)
```

### Multi-Page Documents

```python
zclient.documents.add(
    collection_name="conversations",
    path="slack/general-2024.txt",
    content={
        "type": "text-pages",
        "pages": [
            "Alice: Hello team!",
            "Bob: Hi Alice, what's the status?",
            "Alice: We're on track for launch.",
        ],
    },
    metadata={"channel": "general", "date": "2024-01-15"},
)
```

### Unordered Pages (CSV rows, FAQ entries)

```python
zclient.documents.add(
    collection_name="faq",
    path="faq/entries.txt",
    content={
        "type": "text-pages-unordered",
        "pages": [
            "Q: How do I reset my password? A: Click 'Forgot Password'.",
            "Q: What are your hours? A: 9-5 EST.",
        ],
    },
    metadata={"list:tags": ["faq", "support"]},
)
```

## Metadata Rules

- Metadata must be `dict[str, str | list[str]]`
- **Array fields MUST use `list:` prefix** (e.g., `list:tags`, `list:authors`)
- Attribute names: alphanumeric, hyphens, underscores allowed
- Max 1024 bytes for collection names

## Polling for Index Status

Documents are not immediately queryable after upload:

```python
import time

while True:
    status = zclient.documents.get_info(
        collection_name="contracts",
        path="nda/acme-2024.txt",
    )
    if status.document.index_status == "indexed":
        print("Document ready for querying")
        break
    elif status.document.index_status in ("parsing_failed", "indexing_failed"):
        raise Exception(f"Indexing failed: {status.document.index_status}")
    time.sleep(1)
```

## Bulk Indexing with Backoff

```python
import time
import random

def bulk_index_with_backoff(zclient, collection_name, documents, max_retries=3):
    for doc in documents:
        for attempt in range(max_retries):
            try:
                zclient.documents.add(
                    collection_name=collection_name,
                    path=doc["path"],
                    content=doc["content"],
                    metadata=doc.get("metadata", {}),
                )
                break
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    sleep_time = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(sleep_time)
                else:
                    raise
```

## See Also

- [03-searching.md](03-searching.md) — How to query indexed documents
- [05-rag-pipeline.md](05-rag-pipeline.md) — End-to-end RAG workflow
