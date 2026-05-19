import time
import random
from typing import Callable, Any

def exponential_backoff_retry(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple = (Exception,),
) -> Any:
    """Execute a function with exponential backoff retry.
    
    Args:
        func: Function to execute
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        exceptions: Tuple of exception types to catch
    
    Returns:
        Result of func()
    
    Raises:
        Last exception if all retries exhausted
    """
    for attempt in range(max_retries):
        try:
            return func()
        except exceptions as e:
            if attempt == max_retries - 1:
                raise
            
            # Check for 429 rate limit
            if "429" in str(e):
                delay = min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
                time.sleep(delay)
            else:
                raise

def bulk_index_with_backoff(
    client,
    collection_name: str,
    documents: list,
    max_retries: int = 3,
) -> None:
    """Index multiple documents with automatic retry on rate limits.
    
    Args:
        client: ZeroEntropy client instance
        collection_name: Target collection name
        documents: List of document dicts with path, content, metadata
        max_retries: Maximum retries per document
    """
    for doc in documents:
        def index_doc():
            client.documents.add(
                collection_name=collection_name,
                path=doc["path"],
                content=doc["content"],
                metadata=doc.get("metadata", {}),
            )
        
        exponential_backoff_retry(
            index_doc,
            max_retries=max_retries,
            exceptions=(Exception,),
        )
