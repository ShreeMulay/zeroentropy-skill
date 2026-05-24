#!/usr/bin/env python3
"""
Integration tests against the ZeroEntropy API.
Requires ZEROENTROPY_API_KEY environment variable.
"""

import os
import time
import uuid
import pytest

zeroentropy = pytest.importorskip(
    "zeroentropy",
    reason="zeroentropy SDK not installed; install it to run live API contract tests",
)
ZeroEntropy = zeroentropy.ZeroEntropy
ConflictError = zeroentropy.ConflictError

# Skip all tests if no API key
pytestmark = pytest.mark.skipif(
    not os.environ.get("ZEROENTROPY_API_KEY"),
    reason="ZEROENTROPY_API_KEY not set"
)

@pytest.fixture
def client():
    return ZeroEntropy()

@pytest.fixture
def test_collection():
    """Generate a unique test collection name."""
    return f"test_skill_{uuid.uuid4().hex[:8]}"

@pytest.fixture(autouse=True)
def cleanup(client, test_collection):
    """Cleanup test collection after each test."""
    yield
    try:
        client.collections.delete(collection_name=test_collection)
    except Exception:
        pass

class TestCollections:
    def test_create_collection(self, client, test_collection):
        client.collections.add(collection_name=test_collection)
        response = client.collections.get_list()
        assert test_collection in response.collection_names

    def test_conflict_error(self, client, test_collection):
        client.collections.add(collection_name=test_collection)
        with pytest.raises(ConflictError):
            client.collections.add(collection_name=test_collection)

class TestDocuments:
    def test_add_text_document(self, client, test_collection):
        client.collections.add(collection_name=test_collection)
        
        client.documents.add(
            collection_name=test_collection,
            path="test/doc.txt",
            content={"type": "text", "text": "Test document content"},
            metadata={"list:tags": ["test"]},
        )
        
        # Poll until indexed
        for _ in range(30):
            status = client.documents.get_info(
                collection_name=test_collection,
                path="test/doc.txt",
            )
            if status.document.index_status == "indexed":
                break
            time.sleep(1)
        
        assert status.document.index_status == "indexed"

    def test_metadata_filter_list_prefix(self, client, test_collection):
        """Test that list: prefix is required for array metadata filters."""
        client.collections.add(collection_name=test_collection)
        
        client.documents.add(
            collection_name=test_collection,
            path="test/filter.txt",
            content={"type": "text", "text": "Filter test document"},
            metadata={"list:tags": ["test", "filter"]},
        )
        
        # Wait for indexing
        for _ in range(30):
            status = client.status.get_status(collection_name=test_collection)
            if status.num_indexing_documents == 0:
                break
            time.sleep(1)
        
        # Correct filter with list: prefix
        results_correct = client.queries.top_documents(
            collection_name=test_collection,
            query="test",
            k=5,
            filter={"list:tags": {"$in": ["test"]}},
        )
        assert len(results_correct.results) > 0
        
        # Wrong filter without list: prefix should return 0 results
        results_wrong = client.queries.top_documents(
            collection_name=test_collection,
            query="test",
            k=5,
            filter={"tags": {"$in": ["test"]}},
        )
        assert len(results_wrong.results) == 0

class TestModels:
    def test_embed(self, client):
        response = client.models.embed(
            model="zembed-1",
            input_type="query",
            input="Test query",
            dimensions=2560,
        )
        assert len(response.results) == 1
        assert len(response.results[0].embedding) == 2560

    def test_rerank(self, client):
        response = client.models.rerank(
            model="zerank-2",
            query="What is 2+2?",
            documents=["4", "5", "100"],
        )
        assert len(response.results) == 3
        # Results should be sorted by relevance
        assert response.results[0].index == 0  # "4" should be most relevant

class TestQueries:
    def test_top_snippets_with_reranker(self, client, test_collection):
        client.collections.add(collection_name=test_collection)
        
        client.documents.add(
            collection_name=test_collection,
            path="test/rag.txt",
            content={"type": "text", "text": "RAG stands for Retrieval Augmented Generation."},
        )
        
        # Wait for indexing
        for _ in range(30):
            status = client.status.get_status(collection_name=test_collection)
            if status.num_indexing_documents == 0:
                break
            time.sleep(1)
        
        response = client.queries.top_snippets(
            collection_name=test_collection,
            query="What is RAG?",
            k=5,
            reranker="zerank-2",
            precise_responses=True,
        )
        
        assert len(response.results) > 0
        assert response.results[0].content is not None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
