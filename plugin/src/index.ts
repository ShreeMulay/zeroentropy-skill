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

const MAX_RETRIES = 4;

interface StructuredError {
  error: string;
  status?: number;
  retryable: boolean;
  attempts: number;
  suggestion?: string;
}

type RetryResult<T> =
  | { ok: true; data: T; attempts: number }
  | { ok: false; error: StructuredError };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: any): number | undefined {
  if (typeof error?.status === 'number') return error.status;
  if (typeof error?.statusCode === 'number') return error.statusCode;
  if (typeof error?.response?.status === 'number') return error.response.status;

  const message = String(error?.message ?? '');
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  return statusMatch ? Number(statusMatch[1]) : undefined;
}

function isRetryableError(error: any): boolean {
  const status = getErrorStatus(error);
  return status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
}

function getErrorMessage(error: any): string {
  if (typeof error?.message === 'string' && error.message.length > 0) return error.message;
  if (typeof error === 'string') return error;
  return 'ZeroEntropy API request failed';
}

function getErrorSuggestion(status?: number): string | undefined {
  switch (status) {
    case 400:
      return 'Check the request arguments and schema requirements.';
    case 401:
    case 403:
      return 'Check ZeroEntropy credentials and permissions.';
    case 409:
      return 'Resource already exists or conflicts with current state. Use overwrite where available or choose a different path/name.';
    case 429:
      return 'Rate limited after retries. Reduce request size or try again later.';
    default:
      return undefined;
  }
}

async function withRetry<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
  let lastError: any;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const data = await operation();
      return { ok: true, data, attempts: attempt + 1 };
    } catch (error: any) {
      lastError = error;

      if (!isRetryableError(error)) {
        const status = getErrorStatus(error);
        return {
          ok: false,
          error: {
            error: getErrorMessage(error),
            status,
            retryable: false,
            attempts: attempt + 1,
            suggestion: getErrorSuggestion(status),
          },
        };
      }

      if (attempt === MAX_RETRIES) break;
      await sleep(1000 * 2 ** attempt);
    }
  }

  const status = getErrorStatus(lastError);
  return {
    ok: false,
    error: {
      error: getErrorMessage(lastError),
      status,
      retryable: true,
      attempts: MAX_RETRIES + 1,
      suggestion: getErrorSuggestion(status),
    },
  };
}

function errorOutput(error: StructuredError) {
  return { output: JSON.stringify(error, null, 2) };
}

function normalizeIndexStatus(indexStatus?: string): 'indexed' | 'pending' | 'failed' {
  if (indexStatus === 'indexed') return 'indexed';
  if (indexStatus === 'parsing_failed' || indexStatus === 'indexing_failed') return 'failed';
  return 'pending';
}

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

          const result = await withRetry(async () => {
            switch (args.query_type) {
              case 'documents':
                return zclient.queries.topDocuments(params);
              case 'pages':
                return zclient.queries.topPages(params);
              default:
                return zclient.queries.topSnippets({
                  ...params,
                  precise_responses: args.precise_responses,
                });
            }
          });

          if (!result.ok) return errorOutput(result.error);
          response = result.data;

          return {
            output: JSON.stringify({
              results: response.results,
              count: response.results.length,
            }, null, 2),
          };
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
          const inputTexts = args.texts;
          const result = await withRetry(() =>
            zclient.models.embed({
              model: 'zembed-1',
              input: Array.isArray(inputTexts) ? inputTexts : [inputTexts],
              input_type: args.input_type,
              dimensions: args.dimensions,
              encoding_format: args.encoding_format,
              latency: args.latency,
            })
          );

          if (!result.ok) return errorOutput(result.error);
          const response = result.data;

          return {
            output: JSON.stringify({
              embeddings: response.results.map((r: any) => r.embedding),
              count: response.results.length,
              dimensions: args.dimensions,
            }, null, 2),
          };
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
          const docs = args.documents;
          const result = await withRetry(() =>
            zclient.models.rerank({
              model: 'zerank-2',
              query: args.query,
              documents: Array.isArray(docs) ? docs : [docs],
              top_n: args.top_n,
            })
          );

          if (!result.ok) return errorOutput(result.error);
          const response = result.data;

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

          const result = await withRetry(() =>
            zclient.documents.add({
              collection_name: args.collection_name,
              path: args.path,
              content,
              metadata: args.metadata as Record<string, string | string[]> | undefined,
              overwrite: args.overwrite,
            })
          );

          if (!result.ok) return errorOutput(result.error);

          return {
            output: JSON.stringify({
              success: true,
              path: args.path,
              status: 'indexed',
              note: 'Document may take a few seconds to become queryable. Poll status if needed.',
            }, null, 2),
          };
        },
      }),

      /**
       * Manage ZeroEntropy collections
       */
      zeroentropy_collection: tool({
        description: 'Create, delete, or list ZeroEntropy collections.',
        args: {
          action: z.enum(['create' as const, 'delete' as const, 'list' as const]).describe('Collection operation to perform'),
          collection_name: z.string().optional().describe('Collection name. Required for create and delete.'),
        },
        async execute(args, context) {
          if (args.action !== 'list' && !args.collection_name) {
            return {
              output: JSON.stringify({
                error: 'collection_name is required for create and delete actions.',
                retryable: false,
              }, null, 2),
            };
          }

          const collections = (zclient as any).collections;
          const result = await withRetry(async () => {
            switch (args.action) {
              case 'create':
                if (typeof collections?.add === 'function') {
                  return collections.add({ collection_name: args.collection_name });
                }
                return collections.create({ collection_name: args.collection_name });
              case 'delete':
                if (typeof collections?.delete === 'function') {
                  return collections.delete({ collection_name: args.collection_name });
                }
                return collections.remove({ collection_name: args.collection_name });
              case 'list':
                if (typeof collections?.getList === 'function') return collections.getList({});
                if (typeof collections?.list === 'function') return collections.list();
                return collections.getAll();
            }
          });

          if (!result.ok) return errorOutput(result.error);

          return {
            output: JSON.stringify(args.action === 'list'
              ? { collections: result.data?.collection_names ?? result.data?.collections ?? result.data?.results ?? result.data }
              : { success: true, action: args.action, collection_name: args.collection_name }, null, 2),
          };
        },
      }),

      /**
       * Check document indexing status
       */
      zeroentropy_status: tool({
        description: 'Check ZeroEntropy document indexing status.',
        args: {
          collection_name: z.string().describe('Collection name containing the document'),
          path: z.string().describe('Document path to check'),
        },
        async execute(args, context) {
          const documents = (zclient as any).documents;
          const result = await withRetry(async () => {
            if (typeof documents?.getInfo === 'function') {
              return documents.getInfo({ collection_name: args.collection_name, path: args.path });
            }
            if (typeof documents?.status === 'function') {
              return documents.status({ collection_name: args.collection_name, path: args.path });
            }
            return documents.get({ collection_name: args.collection_name, path: args.path });
          });

          if (!result.ok) return errorOutput(result.error);
          const document = result.data?.document ?? result.data;
          const indexStatus = document?.index_status ?? document?.status;

          return {
            output: JSON.stringify({
              status: normalizeIndexStatus(indexStatus),
              index_status: indexStatus,
              last_updated: document?.last_updated ?? document?.updated_at ?? document?.created_at ?? null,
              path: args.path,
              collection_name: args.collection_name,
            }, null, 2),
          };
        },
      }),

      /**
       * Batch index documents into a collection
       */
      zeroentropy_batch: tool({
        description: 'Batch index multiple documents into a ZeroEntropy collection.',
        args: {
          collection_name: z.string().describe('Target collection'),
          documents: z.array(z.object({
            path: z.string(),
            content: z.string(),
            content_type: z.enum(['text' as const, 'text-pages' as const, 'text-pages-unordered' as const, 'auto' as const]),
            metadata: z.record(z.string(), z.any()).optional(),
          })).describe('Documents to index'),
        },
        async execute(args, context) {
          const errors: Array<{ path: string; error: StructuredError }> = [];
          let successCount = 0;

          for (const document of args.documents) {
            let content: any;
            switch (document.content_type) {
              case 'text':
                content = { type: 'text' as const, text: document.content };
                break;
              case 'text-pages':
                content = { type: 'text-pages' as const, pages: [document.content] };
                break;
              case 'text-pages-unordered':
                content = { type: 'text-pages-unordered' as const, pages: [document.content] };
                break;
              case 'auto':
                content = { type: 'auto' as const, base64_data: document.content };
                break;
            }

            const result = await withRetry(() =>
              zclient.documents.add({
                collection_name: args.collection_name,
                path: document.path,
                content,
                metadata: document.metadata as Record<string, string | string[]> | undefined,
                overwrite: true,
              })
            );

            if (result.ok) {
              successCount += 1;
            } else {
              errors.push({ path: document.path, error: result.error });
            }
          }

          return {
            output: JSON.stringify({
              success_count: successCount,
              failed_count: errors.length,
              errors,
            }, null, 2),
          };
        },
      }),
    },
  };
};

export default ZeroEntropyPlugin;
