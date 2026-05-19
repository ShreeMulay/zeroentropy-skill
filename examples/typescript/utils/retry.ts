/**
 * Exponential backoff retry utility for ZeroEntropy API calls.
 */

export async function exponentialBackoffRetry<T>(
    func: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1.0,
    maxDelay: number = 60.0,
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await func();
        } catch (e: any) {
            if (attempt === maxRetries - 1) {
                throw e;
            }

            // Check for 429 rate limit
            if (e.message?.includes("429") || e.status === 429) {
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt) + Math.random(),
                    maxDelay
                );
                await new Promise(r => setTimeout(r, delay * 1000));
            } else {
                throw e;
            }
        }
    }
    throw new Error("Retry loop exhausted");
}

/**
 * Bulk index documents with automatic retry on rate limits.
 */
export async function bulkIndexWithBackoff(
    client: any,
    collectionName: string,
    documents: Array<{
        path: string;
        content: { type: string; text?: string; base64_data?: string };
        metadata?: Record<string, any>;
    }>,
    maxRetries: number = 3,
): Promise<void> {
    for (const doc of documents) {
        await exponentialBackoffRetry(
            () => client.documents.add({
                collection_name: collectionName,
                path: doc.path,
                content: doc.content,
                metadata: doc.metadata,
            }),
            maxRetries
        );
    }
}
