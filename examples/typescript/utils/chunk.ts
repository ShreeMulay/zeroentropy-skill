/**
 * Text chunking utility for ZeroEntropy document indexing.
 */

export function chunkText(text: string, maxChars: number = 2000, overlap: number = 200): string[] {
    if (text.length <= maxChars) {
        return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        let end = start + maxChars;

        if (end < text.length) {
            // Try to break at sentence boundary
            const sentenceBreak = text.lastIndexOf('. ', end);
            if (sentenceBreak > start + maxChars / 2) {
                end = sentenceBreak + 2;
            } else {
                // Try word boundary
                const wordBreak = text.lastIndexOf(' ', end);
                if (wordBreak > start) {
                    end = wordBreak;
                }
            }
        }

        chunks.push(text.slice(start, end).trim());
        start = end - overlap;
    }

    return chunks;
}

export interface ChunkedDocument {
    path: string;
    content: { type: "text"; text: string };
    metadata: Record<string, any>;
}

export function chunkWithMetadata(
    text: string,
    sourcePath: string,
    maxChars: number = 2000,
    overlap: number = 200,
    baseMetadata: Record<string, any> = {},
): ChunkedDocument[] {
    const chunks = chunkText(text, maxChars, overlap);

    return chunks.map((chunk, i) => ({
        path: `${sourcePath}_chunk_${i.toString().padStart(3, '0')}`,
        content: { type: "text" as const, text: chunk },
        metadata: {
            ...baseMetadata,
            source_path: sourcePath,
            chunk_index: String(i),
            total_chunks: String(chunks.length),
        },
    }));
}
