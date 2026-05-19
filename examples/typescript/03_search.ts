import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();
const COLLECTION_NAME = "example_contracts";

async function main() {
    // Query for top documents
    console.log("=== Top Documents ===");
    const docResponse = await zclient.queries.topDocuments({
        collection_name: COLLECTION_NAME,
        query: "What are the payment terms?",
        k: 5,
        include_metadata: true,
    });

    for (const doc of docResponse.results) {
        console.log(`${doc.path} (score: ${doc.score.toFixed(4)})`);
        if (doc.metadata) {
            console.log(`  Tags: ${doc.metadata["list:tags"] || []}`);
        }
    }

    // Query for snippets with metadata filter
    console.log("\n=== Top Snippets (filtered) ===");
    const snippetResponse = await zclient.queries.topSnippets({
        collection_name: COLLECTION_NAME,
        query: "confidential information requirements",
        k: 3,
        precise_responses: true,
        filter: {
            "list:tags": { "$in": ["nda", "confidential"] },
        },
    });

    for (const snippet of snippetResponse.results) {
        console.log(`\n${snippet.path} [pages ${snippet.page_span}] (score: ${snippet.score.toFixed(4)})`);
        console.log(snippet.content?.slice(0, 200) + "...");
    }
}

main().catch(console.error);
