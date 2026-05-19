import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();

async function main() {
    const query = "What is Retrieval Augmented Generation?";
    const documents = [
        "RAG combines retrieval with generation by conditioning the LLM on external documents.",
        "Retrieval-Augmented Generation is a machine learning technique introduced by Meta AI in 2020.",
        "It uses reinforcement learning to generate music sequences.",
        "RAG can improve factual accuracy by grounding answers in retrieved evidence.",
        "Transformers are a type of deep learning architecture.",
    ];

    console.log(`Query: ${query}\n`);
    console.log("Documents to rerank:");
    documents.forEach((doc, i) => {
        console.log(`  [${i}] ${doc.slice(0, 60)}...`);
    });

    const response = await zclient.models.rerank({
        model: "zerank-2",
        query,
        documents,
    });

    console.log("\n=== Reranked Results ===");
    for (const result of response.results) {
        console.log(`Rank ${result.index}: score ${result.relevance_score.toFixed(4)}`);
        console.log(`  ${documents[result.index].slice(0, 80)}...`);
    }

    // Top N only
    console.log("\n=== Top 3 Only ===");
    const top3 = await zclient.models.rerank({
        model: "zerank-2",
        query,
        documents,
        top_n: 3,
    });

    for (const result of top3.results) {
        console.log(`[${result.index}] ${result.relevance_score.toFixed(4)}: ${documents[result.index].slice(0, 60)}...`);
    }
}

main().catch(console.error);
