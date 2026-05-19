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

const zclient = new ZeroEntropy();

export const ZeroEntropyPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      /**
       * Search indexed documents using zsearch
       */
      zeroentropy_search: tool({
        description: `Search documents in a ZeroEntropy collection. Supports documents, pages, or snippets granularity. Use metadata filters with list: prefix for arrays.`,
        parameters: {
          collection_name: {
            type: 'string',
            description: 'Collection name to search',
          },
          query: {
            type: 'string',
            description: 'Natural language search query',
          },
          k: {
            type: 'number',
            description: 'Number of results (max: 2048 docs, 1024 pages, 128 snippets)',
            default: 10,
          },
          query_type: {
            type: 'string',
            enum: ['documents', 'pages', 'snippets'],
            description: 'Granularity level',
            default: 'snippets',
          },
          filter: {
            type: 'object',
            description: 'Metadata filter (MongoDB-style). Use list: prefix for array fields.',
            optional: true,
          },
          reranker: {
            type: 'string',
            enum: ['zerank-2', 'zerank-1'],
            description: 'Optional reranker to apply',
            optional: true,
          },
          precise_responses: {
            type: 'boolean',
            description: 'For snippets: ~200 chars vs ~2000',
            default: false,
          },
          include_metadata: {
            type: 'boolean',
            description: 'Include document metadata',
            default: false,
          },
          include_content: {
            type: 'boolean',
            description: 'Include document/page content',
            default: false,
          },
        },
        async execute(args) {
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
              results: response.results,
              count: response.results.length,
            };
          } catch (error: any) {
            if (error.message?.includes('429')) {
              return {
                error: 'Rate limited. Retry with exponential backoff.',
                retry_after: '15 seconds',
              };
            }
            if (error.message?.includes('Conflict') || error.status === 409) {
              return {
                error: 'Collection or document already exists.',
                suggestion: 'Use overwrite=true or check if collection exists first.',
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
        parameters: {
          texts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Texts to embed (single string or array)',
          },
          input_type: {
            type: 'string',
            enum: ['query', 'document'],
            description: 'Query or document embedding type',
          },
          dimensions: {
            type: 'number',
            enum: [2560, 1280, 640, 320, 160, 80, 40],
            description: 'Embedding dimensions',
            default: 2560,
          },
          encoding_format: {
            type: 'string',
            enum: ['float', 'base64'],
            description: 'Output format',
            default: 'float',
          },
          latency: {
            type: 'string',
            enum: ['fast', 'slow'],
            description: 'fast=subsecond, slow=cheaper',
            optional: true,
          },
        },
        async execute(args) {
          try {
            const response = await zclient.models.embed({
              model: 'zembed-1',
              input: Array.isArray(args.texts) ? args.texts : [args.texts],
              input_type: args.input_type,
              dimensions: args.dimensions,
              encoding_format: args.encoding_format,
              latency: args.latency,
            });

            return {
              embeddings: response.results.map(r => r.embedding),
              count: response.results.length,
              dimensions: args.dimensions,
            };
          } catch (error: any) {
            if (error.message?.includes('429')) {
              return {
                error: 'Rate limited. Use fewer texts per call or switch to slow latency.',
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
        parameters: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          documents: {
            type: 'array',
            items: { type: 'string' },
            description: 'Candidate documents to rerank',
          },
          top_n: {
            type: 'number',
            description: 'Return only top N results',
            optional: true,
          },
        },
        async execute(args) {
          try {
            const response = await zclient.models.rerank({
              model: 'zerank-2',
              query: args.query,
              documents: args.documents,
              top_n: args.top_n,
            });

            return {
              results: response.results.map(r => ({
                index: r.index,
                score: r.relevance_score,
                document: args.documents[r.index],
              })),
              count: response.results.length,
            };
          } catch (error: any) {
            if (error.message?.includes('429')) {
              return {
                error: 'Rate limited. Batch size too large. Use ≤100 documents per call.',
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
        parameters: {
          collection_name: {
            type: 'string',
            description: 'Target collection',
          },
          path: {
            type: 'string',
            description: 'Unique document path (like a filepath)',
          },
          content_type: {
            type: 'string',
            enum: ['text', 'text-pages', 'text-pages-unordered', 'auto'],
            description: 'text=plain text, text-pages=ordered array, text-pages-unordered=independent entries, auto=base64 binary',
          },
          content: {
            type: 'string',
            description: 'Text content or base64-encoded binary',
          },
          pages: {
            type: 'array',
            items: { type: 'string' },
            description: 'For text-pages content type: array of page strings',
            optional: true,
          },
          metadata: {
            type: 'object',
            description: 'Metadata dict. Use list: prefix for array fields (e.g., list:tags)',
            optional: true,
          },
          overwrite: {
            type: 'boolean',
            description: 'Replace if document already exists',
            default: false,
          },
        },
        async execute(args) {
          try {
            let content;
            switch (args.content_type) {
              case 'text':
                content = { type: 'text', text: args.content };
                break;
              case 'text-pages':
                content = { type: 'text-pages', pages: args.pages || [args.content] };
                break;
              case 'text-pages-unordered':
                content = { type: 'text-pages-unordered', pages: args.pages || [args.content] };
                break;
              case 'auto':
                content = { type: 'auto', base64_data: args.content };
                break;
              default:
                content = { type: 'text', text: args.content };
            }

            await zclient.documents.add({
              collection_name: args.collection_name,
              path: args.path,
              content,
              metadata: args.metadata,
              overwrite: args.overwrite,
            });

            return {
              success: true,
              path: args.path,
              status: 'indexed',
              note: 'Document may take a few seconds to become queryable. Poll status if needed.',
            };
          } catch (error: any) {
            if (error.message?.includes('Conflict') || error.status === 409) {
              return {
                error: 'Document already exists at this path.',
                suggestion: 'Set overwrite=true to replace, or use a different path.',
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
