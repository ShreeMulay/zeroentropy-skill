def chunk_text(text: str, max_chars: int = 2000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks.
    
    Args:
        text: Input text to chunk
        max_chars: Maximum characters per chunk
        overlap: Number of characters to overlap between chunks
    
    Returns:
        List of text chunks
    """
    if len(text) <= max_chars:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + max_chars
        
        # Try to break at a sentence or word boundary
        if end < len(text):
            # Look for sentence boundary
            sentence_break = text.rfind('. ', start, end)
            if sentence_break > start + max_chars // 2:
                end = sentence_break + 2
            else:
                # Look for word boundary
                word_break = text.rfind(' ', start, end)
                if word_break > start:
                    end = word_break
        
        chunks.append(text[start:end].strip())
        start = end - overlap
    
    return chunks

def chunk_with_metadata(
    text: str,
    source_path: str,
    max_chars: int = 2000,
    overlap: int = 200,
    base_metadata: dict = None,
) -> list[dict]:
    """Chunk text and prepare documents with metadata for indexing.
    
    Args:
        text: Input text
        source_path: Original document path
        max_chars: Maximum characters per chunk
        overlap: Overlap between chunks
        base_metadata: Base metadata to include in all chunks
    
    Returns:
        List of document dicts ready for indexing
    """
    chunks = chunk_text(text, max_chars, overlap)
    base = base_metadata or {}
    
    documents = []
    for i, chunk in enumerate(chunks):
        doc = {
            "path": f"{source_path}_chunk_{i:03d}",
            "content": {"type": "text", "text": chunk},
            "metadata": {
                **base,
                "source_path": source_path,
                "chunk_index": str(i),
                "total_chunks": str(len(chunks)),
            },
        }
        documents.append(doc)
    
    return documents
