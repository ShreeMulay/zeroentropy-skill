import { Plugin, tool } from '@opencode-ai/plugin';
import { ZeroEntropy } from 'zeroentropy';

/**
 * ZeroEntropy OpenCode Plugin
 * 
 * Adds native tools for ZeroEntropy operations:
 * - zeroentropy_search: Search indexed collections
 * - zeroentropy_embed: Generate embeddings with zembed-1
 * - zeroentropy_rerank: Rerank documents with zerank-2
 * - zeroentropy_index: Index documents into collections
 */

const z = tool.schema;
const zclient = new ZeroEntropy();

export const ZeroEntropyPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      /**
       * Search indexed documents using zsearch
       */
      zeroentropy_search: tool({
        description: `Search documents in a ZeroEntropy collection. Supports documents, pages, or snippets granularity. Use metadata filters with list: prefix for arrays.`,
        args: {
          collection_name: z.string().describe('Collection name to search'),
          query: z.string().describe('Natural language search query'),
          k: z.number().default(10).describe('Number of results (max: 2048 docs, 1024 pages, 128 snippets)'),
          query_type: z.enum(['documents' as const, 'pages' as const, 'snippets' as const]).default('snippets').describe('Granularity level'),
          filter: z.record(z.string(), z.any()).optional().describe('Metadata filter (MongoDB-style). Use list: prefix for array fields.'),
          reranker: z.enum(['zerank-2' as const, 'zerank-1' as const]).optional().describe('Optional reranker to apply'),
          precise_responses: z.boolean().default(false).describe('For snippets: ~200 chars vs ~2000'),
          include_metadata: z.boolean().default(false).describe('Include document metadata'),
          include_content: z.boolean().default(false).describe('Include document/page content'),
        },
        async execute(args, context) {
          try {
            let response;
            const params = {
              collection_name: args.collection_name,
              query: args.query,
              k: args.k,
              filter: args.filter,
              reranker: args.reranker,
              include_metadata: args.include_metadata,
              include_content: args.include_content,
            };

            switch (args.query_type) {
              case 'documents':
                response = await zclient.queries.topDocuments(params);
                break;
              case 'pages':
                response = await zclient.queries.topPages(params);
                break;
              default: // snippets
                response = await zclient.queries.topSnippets({
                  ...params,
                  precise_responses: args.precise_responses,
                });
            }

            return {
              output: JSON.stringify({
                results: response.results,
                count: response.results.length,
              }, null, 2),
            };
          } catch (error: any) {
            if (error.message?.includes('429')) {
              return {
                output: JSON.stringify({
                  error: 'Rate limited. Retry with exponential backoff.',
                  retry_after: '15 seconds',
                }),
              };
            }
            if (error.message?.includes('Conflict') || error.status === 409) {
              return {
                output: JSON.stringify({
                  error: 'Collection or document already exists.',
                  suggestion: 'Use overwrite=true or check if collection exists first.',
                }),
              };
            }
            throw error;
          }
        },
      }),

      /**
       * Generate embeddings with zembed-1
       */
      zeroentropy_embed: tool({
        description: `Generate embeddings using zembed-1. Use input_type="query" for user questions and "document" for corpus text.`,
        args: {
          texts: z.array(z.string()).describe('Texts to embed (single string or array)'),
          input_type: z.enum(['query' as const, 'document' as const]).describe('Query or document embedding type'),
          dimensions: z.number().default(2560).describe('Embedding dimensions (2560, 1280, 640, 320, 160, 80, 40)'),
          encoding_format: z.enum(['float' as const, 'base64' as const]).default('float').describe('Output format'),
          latency: z.enum(['fast' as const, 'slow' as const]).optional().describe('fast=subsecond, slow=cheaper'),
        },
        async execute(args, context) {
          try {
            const inputTexts = args.texts;
            const response = await zclient.models.embed({
              model: 'zembed-1',
              input: Array.isArray(inputTexts) ? inputTexts : [inputTexts],
              input_type: args.input_type,
              dimensions: args.dimensions,
              encoding_format: args.encoding_format,
              latency: args.latency,
            });

            return {
              output: JSON.stringify({
                embeddings: response.results.map((r: any) => r.embedding),
                count: response.results.length,
                dimensions: args.dimensions,
              }, null, 2),
            };
          } catch (error: any) {
            if (error.message?.includes('429')) {
              return {
                output: JSON.stringify({
                  error: 'Rate limited. Use fewer texts per call or switch to slow latency.',
                }),
              };
            }
            throw error;
          }
        },
      }),

      /**
       * Rerank documents with zerank-2
       */
      zeroentropy_rerank: tool({
        description: `Rerank candidate documents by relevance to a query. Scores are relative (0-1), not absolute probabilities. Use rank ordering, not thresholding.`,
        args: {
          query: z.string().describe('Search query'),
          documents: z.array(z.string()).describe('Candidate documents to rerank'),
          top_n: z.number().optional().describe('Return only top N results'),
        },
        async execute(args, context) {
          try {
            const docs = args.documents;
            const response = await zclient.models.rerank({
              model: 'zerank-2',
              query: args.query,
              documents: Array.isArray(docs) ? docs : [docs],
              top_n: args.top_n,
            });

            return {
              output: JSON.stringify({
                results: response.results.map((r: any) => ({
                  index: r.index,
                  score: r.relevance_score,
                  document: args.documents[r.index],
                })),
                count: response.results.length,
              }, null, 2),
            };
          } catch (error: any) {
            if (error.message?.includes('429')) {
              return {
                output: JSON.stringify({
                  error: 'Rate limited. Batch size too large. Use ≤100 documents per call.',
                }),
              };
            }
            throw error;
          }
        },
      }),

      /**
       * Index a document into a collection
       */
      zeroentropy_index: tool({
        description: `Add a document to a ZeroEntropy collection for indexing. Supports text, pages, and binary content.`,
        args: {
          collection_name: z.string().describe('Target collection'),
          path: z.string().describe('Unique document path (like a filepath)'),
          content_type: z.enum(['text' as const, 'text-pages' as const, 'text-pages-unordered' as const, 'auto' as const]).describe('text=plain text, text-pages=ordered array, text-pages-unordered=independent entries, auto=base64 binary'),
          content: z.string().describe('Text content or base64-encoded binary'),
          pages: z.array(z.string()).optional().describe('For text-pages content type: array of page strings'),
          metadata: z.record(z.string(), z.any()).optional().describe('Metadata dict. Use list: prefix for array fields (e.g., list:tags)'),
          overwrite: z.boolean().default(false).describe('Replace if document already exists'),
        },
        async execute(args, context) {
          try {
            let content: any;
            switch (args.content_type) {
              case 'text':
                content = { type: 'text' as const, text: args.content };
                break;
              case 'text-pages':
                content = { type: 'text-pages' as const, pages: args.pages || [args.content] };
                break;
              case 'text-pages-unordered':
                content = { type: 'text-pages-unordered' as const, pages: args.pages || [args.content] };
                break;
              case 'auto':
                content = { type: 'auto' as const, base64_data: args.content };
                break;
              default:
                content = { type: 'text' as const, text: args.content };
            }

            await zclient.documents.add({
              collection_name: args.collection_name,
              path: args.path,
              content,
              metadata: args.metadata as Record<string, string | string[]> | undefined,
              overwrite: args.overwrite,
            });

            return {
              output: JSON.stringify({
                success: true,
                path: args.path,
                status: 'indexed',
                note: 'Document may take a few seconds to become queryable. Poll status if needed.',
              }, null, 2),
            };
          } catch (error: any) {
            if (error.message?.includes('Conflict') || error.status === 409) {
              return {
                output: JSON.stringify({
                  error: 'Document already exists at this path.',
                  suggestion: 'Set overwrite=true to replace, or use a different path.',
                }),
              };
            }
            throw error;
          }
        },
      }),
    },
  };
};

export default ZeroEntropyPlugin;
