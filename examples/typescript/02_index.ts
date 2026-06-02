import { ZeroEntropy } from 'zeroentropy';

const zclient = new ZeroEntropy();
const COLLECTION_NAME = "example_contracts";

async function waitForDocument(path: string, timeoutSeconds = 30) {
    const start = Date.now();
    while (Date.now() - start < timeoutSeconds * 1000) {
        const status = await zclient.documents.getInfo({
            collection_name: COLLECTION_NAME,
            path,
        });
        const indexStatus = status.document.index_status;

        if (indexStatus === "indexed") {
            console.log(`Ready: ${path}`);
            return;
        }
        if (indexStatus === "parsing_failed" || indexStatus === "indexing_failed") {
            throw new Error(`Indexing failed for ${path}: ${indexStatus}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Timed out waiting for ${path} to index`);
}

async function main() {
    // Create collection (handle if already exists)
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

    // Index text documents
    const documents = [
        {
            path: "contracts/nda_acme_2024.txt",
            content: { type: "text" as const, text: "This Non-Disclosure Agreement covers confidential information..." },
            metadata: {
                tenant_id: "acme",
                date: "2024-01-15",
                "list:tags": ["legal", "nda", "confidential"],
            },
        },
        {
            path: "contracts/sla_service_2024.txt",
            content: { type: "text" as const, text: "This Service Level Agreement guarantees 99.9% uptime..." },
            metadata: {
                tenant_id: "acme",
                date: "2024-02-01",
                "list:tags": ["legal", "sla", "service"],
            },
        },
    ];

    for (const doc of documents) {
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

    console.log("\nWaiting for documents to finish indexing...");
    for (const doc of documents) {
        await waitForDocument(doc.path);
    }

    console.log("\nIndexing complete. Documents are indexed and queryable.");
}

main().catch(console.error);
