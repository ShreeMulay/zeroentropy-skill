import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();
const COLLECTION_NAME = "rag_knowledge_base";

interface Document {
    path: string;
    content: { type: "text"; text: string };
    metadata: Record<string, any>;
}

interface Context {
    text: string;
    source: string;
    score: number;
}

async function setupCollection() {
    try {
        await zclient.collections.add({ collection_name: COLLECTION_NAME });
        console.log(`Created collection: ${COLLECTION_NAME}`);
    } catch (e: any) {
        if (e.message?.includes("Conflict")) {
            console.log(`Collection already exists: ${COLLECTION_NAME}`);
        } else {
            throw e;
        }
    }
}

async function indexDocuments(docs: Document[]) {
    for (const doc of docs) {
        try {
            await zclient.documents.add({
                collection_name: COLLECTION_NAME,
                path: doc.path,
                content: doc.content,
                metadata: doc.metadata,
            });
            console.log(`Indexed: ${doc.path}`);
        } catch (e: any) {
            if (e.message?.includes("Conflict")) {
                console.log(`Already exists: ${doc.path}`);
            } else {
                throw e;
            }
        }
    }
}

async function waitForIndexing(timeoutSeconds = 30) {
    console.log("Waiting for indexing...");
    const start = Date.now();
    while (Date.now() - start < timeoutSeconds * 1000) {
        const status = await zclient.status.getStatus({ collection_name: COLLECTION_NAME });
        if (status.num_indexing_documents === 0 && status.num_parsing_documents === 0) {
            console.log(`Ready: ${status.num_indexed_documents} documents`);
            return;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Indexing timeout");
}

async function ragQuery(question: string, k = 10, topN = 3): Promise<Context[]> {
    const snippets = await zclient.queries.topSnippets({
        collection_name: COLLECTION_NAME,
        query: question,
        k,
        precise_responses: true,
        reranker: "zerank-2",
    });

    return snippets.results.slice(0, topN).map(snippet => ({
        text: snippet.content || "",
        source: snippet.path,
        score: snippet.score,
    }));
}

function buildPrompt(question: string, contexts: Context[]): string {
    const contextText = contexts.map(c =>
        `[Source: ${c.source} (relevance: ${c.score.toFixed(4)})]\n${c.text}`
    ).join("\n\n");

    return `Answer the question based on the provided context.\n\nContext:\n${contextText}\n\nQuestion: ${question}\n\nAnswer:`;
}

async function main() {
    await setupCollection();

    const docs: Document[] = [
        {
            path: "ai/rag_overview.txt",
            content: { type: "text", text: "RAG improves LLM accuracy by retrieving relevant documents before generating answers." },
            metadata: { "list:tags": ["ai", "rag"], date: "2024-01-15" },
        },
        {
            path: "ai/embedding_models.txt",
            content: { type: "text", text: "Embedding models convert text into dense vectors for similarity search." },
            metadata: { "list:tags": ["ai", "embeddings"], date: "2024-01-20" },
        },
        {
            path: "ai/vector_databases.txt",
            content: { type: "text", text: "Vector databases store embeddings and enable fast nearest neighbor search." },
            metadata: { "list:tags": ["ai", "databases"], date: "2024-01-25" },
        },
    ];

    await indexDocuments(docs);
    await waitForIndexing();

    const question = "How do embeddings help with search?";
    const contexts = await ragQuery(question);

    console.log(`\nQuestion: ${question}`);
    console.log(`Retrieved ${contexts.length} contexts\n`);

    contexts.forEach((ctx, i) => {
        console.log(`Context ${i + 1} (score: ${ctx.score.toFixed(4)}):`);
        console.log(`  Source: ${ctx.source}`);
        console.log(`  Text: ${ctx.text.slice(0, 100)}...\n`);
    });

    const prompt = buildPrompt(question, contexts);
    console.log("=== LLM Prompt ===");
    console.log(prompt);
}

main().catch(console.error);
