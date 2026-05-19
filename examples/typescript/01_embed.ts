import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();

async function main() {
    // Embed a single query
    const queryResponse = await zclient.models.embed({
        model: "zembed-1",
        input_type: "query",
        input: "What is retrieval augmented generation?",
        dimensions: 2560,
        encoding_format: "float",
        latency: "fast",
    });

    console.log(`Embedding dimensions: ${(queryResponse.results[0].embedding as number[]).length}`);
    console.log(`First 5 values: ${(queryResponse.results[0].embedding as number[]).slice(0, 5)}`);

    // Embed multiple documents
    const docResponse = await zclient.models.embed({
        model: "zembed-1",
        input_type: "document",
        input: [
            "RAG combines retrieval with generation.",
            "Transformers are a deep learning architecture.",
            "Vector databases store embeddings for similarity search.",
        ],
        dimensions: 2560,
    });

    console.log(`\nEmbedded ${docResponse.results.length} documents`);
    docResponse.results.forEach((result, i) => {
        console.log(`Doc ${i}: ${(result.embedding as number[]).length} dimensions`);
    });
}

main().catch(console.error);
