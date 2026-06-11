import { Plugin, tool } from '@opencode-ai/plugin';
import type { ToolContext } from '@opencode-ai/plugin';
import { ZeroEntropy, APIConnectionError } from 'zeroentropy';

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return JSON.stringify({
      error: 'Failed to serialize result',
      details: e instanceof Error ? e.message : 'Unknown serialization error',
    });
  }
}

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

const DEFAULT_MAX_RETRIES = 4;
const MAX_RETRY_LIMIT = 10;
const VALID_EMBED_DIMENSIONS = [2560, 1280, 640, 320, 160, 80, 40] as const;
const metadataValueSchema = z.union([z.string(), z.array(z.string().min(1)).min(1)]);
const metadataSchema = z.record(z.string(), metadataValueSchema);

let cachedClient: ZeroEntropy | undefined;
let cachedApiKey: string | undefined;

function parseMaxRetries(value = process.env.ZEROENTROPY_MAX_RETRIES): number {
  if (value === undefined || value === '') return DEFAULT_MAX_RETRIES;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_RETRIES;

  return Math.max(0, Math.min(Math.trunc(parsed), MAX_RETRY_LIMIT));
}

function missingApiKeyError(): StructuredError {
  return {
    error: 'ZEROENTROPY_API_KEY is not set',
    retryable: false,
    attempts: 0,
    suggestion: 'Set ZEROENTROPY_API_KEY in the environment before using ZeroEntropy plugin tools.',
  };
}

function getClient(): RetryResult<ZeroEntropy> {
  const apiKey = process.env.ZEROENTROPY_API_KEY;
  if (!apiKey) return { ok: false, error: missingApiKeyError() };

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new ZeroEntropy({ apiKey, maxRetries: 0 });
    cachedApiKey = apiKey;
  }

  return { ok: true, data: cachedClient, attempts: 0 };
}

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

function abortError(attempts = 0, reason?: unknown): StructuredError {
  return {
    error: reason instanceof Error && reason.message ? `Operation aborted: ${reason.message}` : 'Operation aborted',
    retryable: false,
    attempts,
    suggestion: 'The OpenCode tool run was cancelled before the ZeroEntropy request completed.',
  };
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || /aborted|abort/i.test(error.message));
}

function requestOptions(context?: Partial<ToolContext>): { signal?: AbortSignal } | undefined {
  return context?.abort ? { signal: context.abort } : undefined;
}

function sdkCall<T>(
  method: (body: any, options?: { signal?: AbortSignal }) => Promise<T>,
  body: any,
  options?: { signal?: AbortSignal }
): Promise<T> {
  return options ? method(body, options) : method(body);
}

function sdkCallNoBody<T>(
  method: (options?: { signal?: AbortSignal }) => Promise<T>,
  options?: { signal?: AbortSignal }
): Promise<T> {
  return options ? method(options) : method();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error('Operation aborted'));

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new Error('Operation aborted'));
    };
    const timeout = setTimeout(() => {
      // Avoid accumulating stale listeners on a long-lived shared AbortSignal.
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function getErrorStatus(error: any): number | undefined {
  if (typeof error?.status === 'number') return error.status;
  if (typeof error?.statusCode === 'number') return error.statusCode;
  if (typeof error?.response?.status === 'number') return error.response.status;

  // Fallback: only treat a LEADING 3-digit code as a status (e.g. the SDK's
  // "400 {...detail...}" message format). Avoids mis-reading arbitrary numbers
  // inside the message body (e.g. "search returned 404 results").
  const message = String(error?.message ?? '');
  const statusMatch = message.match(/^\s*([45]\d{2})\b/);
  return statusMatch ? Number(statusMatch[1]) : undefined;
}

// Transient network conditions worth retrying when no HTTP status is present.
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

// Narrow, explicit phrases that reliably indicate a transient transport
// failure. Deliberately excludes broad words like "network" or a bare
// "timed out" which can appear in unrelated application errors.
const TRANSIENT_MESSAGE_PATTERN = new RegExp(
  [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'socket hang up',
    'fetch failed',
    'connection error',
    'network (?:error|timeout|connection)',
  ].join('|'),
  'i'
);

function isTransientNetworkError(error: any): boolean {
  // Primary signal: the SDK's own connection-error classes (status=undefined),
  // which also covers APIConnectionTimeoutError via inheritance.
  if (error instanceof APIConnectionError) return true;

  // Fallback: raw socket errors carry a Node error code.
  const code = error?.code ?? error?.cause?.code;
  if (typeof code === 'string' && TRANSIENT_NETWORK_CODES.has(code)) return true;

  // Last resort: narrow, explicit transient phrases in the message.
  const message = String(error?.message ?? '');
  return TRANSIENT_MESSAGE_PATTERN.test(message);
}

function isRetryableError(error: any): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined) {
    // Retry on 429 (rate limit) and 5xx (server errors); fail fast on 4xx.
    return status === 429 || (status >= 500 && status < 600);
  }
  // No HTTP status: only retry genuine transient network errors, not
  // programmer errors (TypeError, etc.) or other unexpected failures.
  return isTransientNetworkError(error);
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
      return 'Resource already exists or conflicts with current state. Delete the existing resource and recreate it, or choose a different path/name (the API does not support overwrite).';
    case 429:
      return 'Rate limited after retries. Reduce request size or try again later.';
    default:
      return undefined;
  }
}

async function withRetry<T>(
  operation: (options?: { signal?: AbortSignal }) => Promise<T>,
  options: { signal?: AbortSignal; retry?: boolean } = {}
): Promise<RetryResult<T>> {
  if (options.signal?.aborted) return { ok: false, error: abortError(0, options.signal.reason) };

  let lastError: any;
  const retryEnabled = options.retry !== false;
  const maxRetries = retryEnabled ? parseMaxRetries() : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (options.signal?.aborted) return { ok: false, error: abortError(attempt, options.signal.reason) };
      const data = await operation(requestOptions({ abort: options.signal }));
      return { ok: true, data, attempts: attempt + 1 };
    } catch (error: any) {
      lastError = error;
      if (options.signal?.aborted || isAbortLikeError(error)) {
        return { ok: false, error: abortError(attempt + 1, error) };
      }

      const retryable = isRetryableError(error);
      if (!retryable || !retryEnabled) {
        const status = getErrorStatus(error);
        return {
          ok: false,
          error: {
            error: getErrorMessage(error),
            status,
            retryable: false,
            attempts: attempt + 1,
            suggestion: !retryEnabled && retryable
              ? 'Mutation was not retried because the first attempt may have changed remote state. Check ZeroEntropy before retrying manually.'
              : getErrorSuggestion(status),
          },
        };
      }

      if (attempt === maxRetries) break;
      const baseDelay = 1000 * 2 ** attempt;
      const jitteredDelay = baseDelay + Math.random() * 1000;
      try {
        await sleep(jitteredDelay, options.signal);
      } catch (abortReason) {
        return { ok: false, error: abortError(attempt + 1, abortReason) };
      }
    }
  }

  const status = getErrorStatus(lastError);
  return {
    ok: false,
    error: {
      error: getErrorMessage(lastError),
      status,
      retryable: true,
      attempts: maxRetries + 1,
      suggestion: getErrorSuggestion(status),
    },
  };
}

function errorOutput(error: StructuredError) {
  return { output: safeStringify(error) };
}

function validateSearchK(queryType: 'documents' | 'pages' | 'snippets', k: number): StructuredError | undefined {
  const limits = { documents: 2048, pages: 1024, snippets: 128 } as const;
  const max = limits[queryType];
  if (k >= 1 && k <= max) return undefined;

  return {
    error: `k must be between 1 and ${max} for ${queryType} searches`,
    status: 400,
    retryable: false,
    attempts: 0,
    suggestion: `Use k <= ${max} for query_type="${queryType}".`,
  };
}

function validateTopN(topN: number | undefined, documentCount: number): StructuredError | undefined {
  if (topN === undefined) return undefined;
  if (topN >= 1 && topN <= Math.min(100, documentCount)) return undefined;

  return {
    error: `top_n must be between 1 and the number of documents (max 100); got ${topN}`,
    status: 400,
    retryable: false,
    attempts: 0,
    suggestion: 'Use a positive top_n that is not larger than the provided document count.',
  };
}

function validationError(error: string, suggestion: string): StructuredError {
  return { error, status: 400, retryable: false, attempts: 0, suggestion };
}

function normalizeIndexStatus(indexStatus?: string): 'indexed' | 'pending' | 'failed' {
  if (indexStatus === 'indexed') return 'indexed';
  if (indexStatus === 'parsing_failed' || indexStatus === 'indexing_failed' || indexStatus === 'failed') {
    return 'failed';
  }
  // not_indexed, indexing, parsing, undefined, etc. → still in progress
  return 'pending';
}

function normalizeMetadata(
  metadata?: Record<string, string | string[]>
): Record<string, string | string[]> | undefined {
  if (!metadata) return undefined;

  const normalized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      const normalizedKey = key.startsWith('list:') ? key : `list:${key}`;
      normalized[normalizedKey] = value;
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function validateMetadata(metadata?: Record<string, unknown>): RetryResult<Record<string, string | string[]> | undefined> {
  if (!metadata) return { ok: true, data: undefined, attempts: 0 };

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') continue;
    if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0)) continue;

    return {
      ok: false,
      error: validationError(
        `metadata.${key} must be a string or a non-empty string array`,
        'Use ZeroEntropy metadata values shaped as dict[str, str | list[str]]. Arrays are auto-normalized to list: keys by the plugin.'
      ),
    };
  }

  return { ok: true, data: metadata as Record<string, string | string[]>, attempts: 0 };
}

function validateContentInput(contentType: ContentType, pages?: string[]): StructuredError | undefined {
  if ((contentType === 'text-pages' || contentType === 'text-pages-unordered') && pages !== undefined && pages.length === 0) {
    return validationError(
      'pages must contain at least one page when provided for page-based content',
      'Omit pages to use the content fallback, or provide one or more non-empty page strings.'
    );
  }

  return undefined;
}

type ContentType = 'text' | 'text-pages' | 'text-pages-unordered' | 'auto';

/**
 * Build the ZeroEntropy document content object from a content_type + raw
 * content (+ optional pages). Shared by zeroentropy_index and zeroentropy_batch
 * to guarantee identical behavior across single and batch indexing.
 */
function buildContent(contentType: ContentType, content: string, pages?: string[]): any {
  switch (contentType) {
    case 'text-pages':
      return { type: 'text-pages' as const, pages: pages || [content] };
    case 'text-pages-unordered':
      return { type: 'text-pages-unordered' as const, pages: pages || [content] };
    case 'auto':
      return { type: 'auto' as const, base64_data: content };
    case 'text':
    default:
      return { type: 'text' as const, text: content };
  }
}

function documentAddParams(input: {
  collection_name: string;
  path: string;
  content: any;
  metadata?: Record<string, string | string[]>;
}) {
  const metadata = normalizeMetadata(input.metadata);
  return {
    collection_name: input.collection_name,
    path: input.path,
    content: input.content,
    ...(metadata ? { metadata } : {}),
  };
}

export const ZeroEntropyPlugin: Plugin = async (ctx) => {
  if (!process.env.ZEROENTROPY_API_KEY) {
    console.warn('[zeroentropy-plugin] WARNING: ZEROENTROPY_API_KEY not set. Tools will fail at runtime.');
  }

  return {
    tool: {
      /**
       * Search indexed documents using zsearch
       */
      zeroentropy_search: tool({
        description: `Search documents in a ZeroEntropy collection. Supports documents, pages, or snippets granularity. Use metadata filters with list: prefix for arrays.`,
        args: {
          collection_name: z.string().min(1).describe('Collection name to search'),
          query: z.string().min(1).describe('Natural language search query'),
          k: z.number().int().min(1).max(2048).default(10).describe('Number of results (max: 2048 docs, 1024 pages, 128 snippets)'),
          query_type: z.enum(['documents' as const, 'pages' as const, 'snippets' as const]).default('snippets').describe('Granularity level'),
          filter: z.record(z.string(), z.any()).optional().describe('Metadata filter (MongoDB-style). Use list: prefix for array fields.'),
          reranker: z.enum(['zerank-2' as const, 'zerank-1' as const]).optional().describe('Optional reranker to apply'),
          precise_responses: z.boolean().default(false).describe('For snippets: ~200 chars vs ~2000'),
          include_metadata: z.boolean().default(false).describe('Include document metadata'),
          include_content: z.boolean().default(false).describe('Include document/page content'),
          latency_mode: z.enum(['low' as const, 'high' as const]).optional().describe('For documents/pages: low=faster, high=more accurate'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);
          const options = requestOptions(context);

          const queryType = args.query_type ?? 'snippets';
          const k = args.k ?? 10;
          const kError = validateSearchK(queryType, k);
          if (kError) return errorOutput(kError);

          const result = await withRetry(async () => {
            switch (queryType) {
              case 'documents':
                return sdkCall(client.data.queries.topDocuments.bind(client.data.queries), {
                  collection_name: args.collection_name,
                  query: args.query,
                  k,
                  filter: args.filter,
                  reranker: args.reranker,
                  include_metadata: args.include_metadata ?? false,
                  latency_mode: args.latency_mode,
                }, options);
              case 'pages':
                return sdkCall(client.data.queries.topPages.bind(client.data.queries), {
                  collection_name: args.collection_name,
                  query: args.query,
                  k,
                  filter: args.filter,
                  include_content: args.include_content ?? false,
                  include_metadata: args.include_metadata ?? false,
                  latency_mode: args.latency_mode,
                }, options);
              default:
                return sdkCall(client.data.queries.topSnippets.bind(client.data.queries), {
                  collection_name: args.collection_name,
                  query: args.query,
                  k,
                  filter: args.filter,
                  reranker: args.reranker,
                  include_document_metadata: args.include_metadata ?? false,
                  precise_responses: args.precise_responses ?? false,
                }, options);
            }
          }, { signal: context.abort });

          if (!result.ok) return errorOutput(result.error);
          const response = result.data;

          return {
            output: safeStringify({
              results: response.results,
              ...('document_results' in response ? { document_results: response.document_results } : {}),
              count: response.results.length,
            }),
          };
        },
      }),

      /**
       * Generate embeddings with zembed-1
       */
      zeroentropy_embed: tool({
        description: `Generate embeddings using zembed-1. Use input_type="query" for user questions and "document" for corpus text.`,
        args: {
          texts: z.union([z.string().min(1), z.array(z.string().min(1)).min(1).max(128)]).describe('Texts to embed (single string or array)'),
          input_type: z.enum(['query' as const, 'document' as const]).describe('Query or document embedding type'),
          dimensions: z.number().int().refine((value) => VALID_EMBED_DIMENSIONS.includes(value as any), 'Unsupported embedding dimensions').default(2560).describe('Embedding dimensions (2560, 1280, 640, 320, 160, 80, 40)'),
          encoding_format: z.enum(['float' as const, 'base64' as const]).default('float').describe('Output format'),
          latency: z.enum(['fast' as const, 'slow' as const]).optional().describe('fast=subsecond, slow=cheaper'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          const inputTexts = args.texts;
          if (Array.isArray(inputTexts) && inputTexts.length === 0) {
            return errorOutput(validationError(
              'texts must contain at least one text',
              'Provide a non-empty string or an array with 1 to 128 non-empty strings.'
            ));
          }
          if (!VALID_EMBED_DIMENSIONS.includes((args.dimensions ?? 2560) as any)) {
            return errorOutput(validationError(
              `Unsupported embedding dimensions: ${args.dimensions}`,
              `Use one of: ${VALID_EMBED_DIMENSIONS.join(', ')}.`
            ));
          }

          const result = await withRetry((options) =>
            sdkCall(client.data.models.embed.bind(client.data.models), {
              model: 'zembed-1',
              input: Array.isArray(inputTexts) ? inputTexts : [inputTexts],
              input_type: args.input_type,
              dimensions: args.dimensions ?? 2560,
              encoding_format: args.encoding_format ?? 'float',
              latency: args.latency,
            }, options)
          , { signal: context.abort });

          if (!result.ok) return errorOutput(result.error);
          const response = result.data;

          return {
            output: safeStringify({
              embeddings: response.results.map((r: any) => r.embedding),
              count: response.results.length,
              dimensions: args.dimensions ?? 2560,
            }),
          };
        },
      }),

      /**
       * Rerank documents with zerank-2
       */
      zeroentropy_rerank: tool({
        description: `Rerank candidate documents by relevance to a query. Scores are relative (0-1), not absolute probabilities. Use rank ordering, not thresholding.`,
        args: {
          query: z.string().min(1).describe('Search query'),
          documents: z.array(z.string().min(1)).min(1).max(100).describe('Candidate documents to rerank'),
          top_n: z.number().int().min(1).max(100).optional().describe('Return only top N results'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          const docs = args.documents;
          const topNError = validateTopN(args.top_n, docs.length);
          if (topNError) return errorOutput(topNError);

          const result = await withRetry((options) =>
            sdkCall(client.data.models.rerank.bind(client.data.models), {
              model: 'zerank-2',
              query: args.query,
              documents: Array.isArray(docs) ? docs : [docs],
              top_n: args.top_n,
            }, options)
          , { signal: context.abort });

          if (!result.ok) return errorOutput(result.error);
          const response = result.data;

          return {
            output: safeStringify({
              results: response.results.map((r: any) => ({
                index: r.index,
                score: r.relevance_score,
                document: args.documents[r.index],
              })),
              count: response.results.length,
            }),
          };
        },
      }),

      /**
       * Index a document into a collection
       */
      zeroentropy_index: tool({
        description: `Add a document to a ZeroEntropy collection for indexing. Supports text, pages, and binary content.`,
        args: {
          collection_name: z.string().min(1).describe('Target collection'),
          path: z.string().min(1).describe('Unique document path (like a filepath)'),
          content_type: z.enum(['text' as const, 'text-pages' as const, 'text-pages-unordered' as const, 'auto' as const]).describe('text=plain text, text-pages=ordered array, text-pages-unordered=independent entries, auto=base64 binary'),
          content: z.string().min(1).max(500_000).describe('Text content or base64-encoded binary'),
          pages: z.array(z.string().min(1)).min(1).optional().describe('For text-pages content type: array of page strings'),
          metadata: metadataSchema.optional().describe('Metadata dict[str, str | list[str]]. Array fields are auto-normalized to list: prefix.'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);
          if (context.abort?.aborted) return errorOutput(abortError(0, context.abort.reason));

          const contentError = validateContentInput(args.content_type, args.pages);
          if (contentError) return errorOutput(contentError);
          const metadata = validateMetadata(args.metadata);
          if (!metadata.ok) return errorOutput(metadata.error);

          const content = buildContent(args.content_type, args.content, args.pages);

          const result = await withRetry((options) =>
            sdkCall(client.data.documents.add.bind(client.data.documents), documentAddParams({
              collection_name: args.collection_name,
              path: args.path,
              content,
              metadata: metadata.data,
            }), options)
          , { signal: context.abort, retry: false });

          if (!result.ok) return errorOutput(result.error);

          return {
            output: safeStringify({
              success: true,
              path: args.path,
              status: 'accepted',
              note: 'Document accepted for indexing. Poll zeroentropy_status until status is indexed before querying.',
            }),
          };
        },
      }),

      /**
       * Create a ZeroEntropy collection
       */
      zeroentropy_create_collection: tool({
        description: 'Create a new ZeroEntropy collection.',
        args: {
          collection_name: z.string().min(1).describe('Collection name to create'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          const collections = client.data.collections;
          const result = await withRetry(
            (options) => sdkCall(collections.add.bind(collections), { collection_name: args.collection_name }, options),
            { signal: context.abort, retry: false }
          );

          if (!result.ok) return errorOutput(result.error);

          return {
            output: safeStringify({
              success: true,
              action: 'create',
              collection_name: args.collection_name,
            }),
          };
        },
      }),

      /**
       * Delete a ZeroEntropy collection
       */
      zeroentropy_delete_collection: tool({
        description: 'Delete an existing ZeroEntropy collection.',
        args: {
          collection_name: z.string().min(1).describe('Collection name to delete'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          if (typeof context.ask !== 'function') {
            return errorOutput(validationError(
              'zeroentropy_delete_collection requires an OpenCode permission prompt',
              'Run this tool in an OpenCode context that supports context.ask before deleting collections.'
            ));
          }

          try {
            await context.ask({
              permission: 'zeroentropy.delete_collection',
              patterns: [args.collection_name],
              always: [],
              metadata: { collection_name: args.collection_name, action: 'delete_collection' },
            });
          } catch (error) {
            return errorOutput({
              error: getErrorMessage(error),
              retryable: false,
              attempts: 0,
              suggestion: 'Deletion was cancelled before contacting ZeroEntropy.',
            });
          }

          const collections = client.data.collections;
          const result = await withRetry(
            (options) => sdkCall(collections.delete.bind(collections), { collection_name: args.collection_name }, options),
            { signal: context.abort, retry: false }
          );

          if (!result.ok) return errorOutput(result.error);

          return {
            output: safeStringify({
              success: true,
              action: 'delete',
              collection_name: args.collection_name,
            }),
          };
        },
      }),

      /**
       * List ZeroEntropy collections
       */
      zeroentropy_list_collections: tool({
        description: 'List all ZeroEntropy collections available to the configured API key.',
        args: {},
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          const collections = (client.data as any).collections;
          const result = await withRetry(async (options) => {
            // Real SDK method is getList; others are defensive fallbacks.
            if (typeof collections?.getList === 'function') return sdkCall(collections.getList.bind(collections), {}, options);
            if (typeof collections?.get_list === 'function') return sdkCall(collections.get_list.bind(collections), {}, options);
            if (typeof collections?.list === 'function') return sdkCallNoBody(collections.list.bind(collections), options);
            return sdkCallNoBody(collections.getAll.bind(collections), options);
          }, { signal: context.abort });

          if (!result.ok) return errorOutput(result.error);
          const response = result.data as any;

          return {
            output: safeStringify({
              collections: response?.collection_names ?? response?.collections ?? response?.results ?? response,
            }),
          };
        },
      }),

      /**
       * Check document indexing status
       */
      zeroentropy_status: tool({
        description: 'Check ZeroEntropy document indexing status.',
        args: {
          collection_name: z.string().min(1).describe('Collection name containing the document'),
          path: z.string().min(1).describe('Document path to check'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          const documents = (client.data as any).documents;
          const result = await withRetry(async (options) => {
            // SDK exposes documents.getInfo; keep get_info as a defensive fallback.
            if (typeof documents?.getInfo === 'function') {
              return sdkCall(documents.getInfo.bind(documents), { collection_name: args.collection_name, path: args.path }, options);
            }
            return sdkCall(documents.get_info.bind(documents), { collection_name: args.collection_name, path: args.path }, options);
          }, { signal: context.abort });

          if (!result.ok) return errorOutput(result.error);
          const response = result.data as any;
          const document = response?.document ?? response;
          const indexStatus = document?.index_status ?? document?.status;

          return {
            output: safeStringify({
              status: normalizeIndexStatus(indexStatus),
              index_status: indexStatus,
              last_updated: document?.last_updated ?? document?.updated_at ?? document?.created_at ?? null,
              path: args.path,
              collection_name: args.collection_name,
            }),
          };
        },
      }),

      /**
       * Batch index documents into a collection
       */
      zeroentropy_batch: tool({
        description: 'Batch index multiple documents into a ZeroEntropy collection.',
        args: {
          collection_name: z.string().min(1).describe('Target collection'),
          documents: z.array(z.object({
            path: z.string().min(1),
            content: z.string().min(1).max(500_000),
            content_type: z.enum(['text' as const, 'text-pages' as const, 'text-pages-unordered' as const, 'auto' as const]),
            pages: z.array(z.string().min(1)).min(1).optional(),
            metadata: metadataSchema.optional(),
          })).min(1).max(100).describe('Documents to index'),
        },
        async execute(args, context) {
          const client = getClient();
          if (!client.ok) return errorOutput(client.error);

          if (args.documents.length === 0) {
            return errorOutput(validationError(
              'documents must contain at least one document',
              'Provide 1 to 100 documents for batch indexing.'
            ));
          }

          const errors: Array<{ path: string; error: StructuredError }> = [];
          let successCount = 0;
          let skippedCount = 0;

          for (let docIndex = 0; docIndex < args.documents.length; docIndex += 1) {
            const document = args.documents[docIndex];
            if (context.abort?.aborted) {
              errors.push({ path: document.path, error: abortError(0, context.abort.reason) });
              // Remaining documents were never attempted; report them explicitly
              // so success + failed + skipped always reconciles with the input.
              skippedCount = args.documents.length - docIndex - 1;
              break;
            }
            const contentError = validateContentInput(document.content_type, document.pages);
            if (contentError) {
              errors.push({ path: document.path, error: contentError });
              continue;
            }
            const metadata = validateMetadata(document.metadata);
            if (!metadata.ok) {
              errors.push({ path: document.path, error: metadata.error });
              continue;
            }
            const content = buildContent(document.content_type, document.content, document.pages);

            const result = await withRetry((options) =>
              sdkCall(client.data.documents.add.bind(client.data.documents), documentAddParams({
                collection_name: args.collection_name,
                path: document.path,
                content,
                metadata: metadata.data,
              }), options)
            , { signal: context.abort, retry: false });

            if (result.ok) {
              successCount += 1;
            } else {
              errors.push({ path: document.path, error: result.error });
            }
          }

          return {
            output: safeStringify({
              success_count: successCount,
              failed_count: errors.length,
              skipped_count: skippedCount,
              errors,
            }),
          };
        },
      }),
    },
  };
};

export default ZeroEntropyPlugin;
