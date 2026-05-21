import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const topDocuments = vi.fn();
  const topPages = vi.fn();
  const topSnippets = vi.fn();
  const embed = vi.fn();
  const rerank = vi.fn();
  const documentAdd = vi.fn();
  const documentStatus = vi.fn();
  const collectionAdd = vi.fn();
  const collectionDelete = vi.fn();
  const collectionGetList = vi.fn();

  return {
    topDocuments,
    topPages,
    topSnippets,
    embed,
    rerank,
    documentAdd,
    documentStatus,
    collectionAdd,
    collectionDelete,
    collectionGetList,
  };
});

vi.mock('zeroentropy', () => ({
  ZeroEntropy: vi.fn(() => ({
    queries: {
      topDocuments: mocks.topDocuments,
      topPages: mocks.topPages,
      topSnippets: mocks.topSnippets,
    },
    models: {
      embed: mocks.embed,
      rerank: mocks.rerank,
    },
    documents: {
      add: mocks.documentAdd,
      status: mocks.documentStatus,
    },
    collections: {
      add: mocks.collectionAdd,
      delete: mocks.collectionDelete,
      getList: mocks.collectionGetList,
      get_list: mocks.collectionGetList,
    },
  })),
}));

vi.mock('@opencode-ai/plugin', () => {
  const chain = () => ({
    describe: vi.fn(() => chain()),
    default: vi.fn(() => chain()),
    max: vi.fn(() => chain()),
    optional: vi.fn(() => chain()),
  });

  const schema = {
    string: vi.fn(chain),
    number: vi.fn(chain),
    boolean: vi.fn(chain),
    any: vi.fn(chain),
    enum: vi.fn(chain),
    array: vi.fn(chain),
    object: vi.fn(chain),
    record: vi.fn(chain),
  };

  const tool = vi.fn((definition) => definition);
  tool.schema = schema;

  return { tool };
});

type PluginTools = Awaited<ReturnType<typeof getTools>>;

async function getTools() {
  const { default: ZeroEntropyPlugin } = await import('../src/index');
  const plugin = await ZeroEntropyPlugin({} as never);
  return plugin.tool;
}

function parseOutput(result: { output: string }) {
  return JSON.parse(result.output);
}

function rateLimitError() {
  const error = new Error('429 rate limit exceeded');
  (error as Error & { status: number }).status = 429;
  return error;
}

function badRequestError() {
  const error = new Error('Bad Request');
  (error as Error & { status: number }).status = 400;
  return error;
}

function unauthorizedError() {
  const error = new Error('Unauthorized');
  (error as Error & { status: number }).status = 401;
  return error;
}

function serverError() {
  const error = new Error('Internal Server Error');
  (error as Error & { status: number }).status = 500;
  return error;
}

function conflictError() {
  const error = new Error('Conflict');
  (error as Error & { status: number }).status = 409;
  return error;
}

describe('ZeroEntropy OpenCode plugin', () => {
  let tools: PluginTools;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('setTimeout', vi.fn((callback: () => void) => {
      callback();
      return 0 as never;
    }));
    tools = await getTools();
  });

  describe('zeroentropy_search', () => {
    it('returns documents with correct structure', async () => {
      mocks.topDocuments.mockResolvedValueOnce({
        results: [{ path: 'doc.md', score: 0.98, metadata: { tag: 'renal' } }],
      });

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'ckd staging',
        k: 1,
        query_type: 'documents',
        include_metadata: true,
        include_content: false,
      }, {});

      expect(mocks.topDocuments).toHaveBeenCalledWith(expect.objectContaining({
        collection_name: 'kb',
        query: 'ckd staging',
        k: 1,
        include_metadata: true,
      }));
      expect(parseOutput(result)).toEqual({
        results: [{ path: 'doc.md', score: 0.98, metadata: { tag: 'renal' } }],
        count: 1,
      });
    });

    it('returns pages with correct structure', async () => {
      mocks.topPages.mockResolvedValueOnce({
        results: [{ path: 'guide.md', page_index: 2, content: 'Page text', score: 0.9 }],
      });

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'albuminuria',
        k: 1,
        query_type: 'pages',
        include_content: true,
      }, {});

      expect(mocks.topPages).toHaveBeenCalledOnce();
      expect(parseOutput(result)).toEqual({
        results: [{ path: 'guide.md', page_index: 2, content: 'Page text', score: 0.9 }],
        count: 1,
      });
    });

    it('returns snippets with precise_responses', async () => {
      mocks.topSnippets.mockResolvedValueOnce({
        results: [{ path: 'doc.md', snippet: 'precise answer', score: 0.95 }],
      });

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'bp target',
        k: 1,
        query_type: 'snippets',
        precise_responses: true,
      }, {});

      expect(mocks.topSnippets).toHaveBeenCalledWith(expect.objectContaining({ precise_responses: true }));
      expect(parseOutput(result)).toEqual({
        results: [{ path: 'doc.md', snippet: 'precise answer', score: 0.95 }],
        count: 1,
      });
    });

    it('handles 429 rate limit with retry', async () => {
      mocks.topSnippets.mockRejectedValueOnce(rateLimitError()).mockResolvedValueOnce({ results: [{ path: 'retry.md' }] });

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'retry',
        k: 1,
        query_type: 'snippets',
      }, {});

      expect(mocks.topSnippets).toHaveBeenCalledTimes(2);
      expect(parseOutput(result)).toEqual({ results: [{ path: 'retry.md' }], count: 1 });
    });

    it('handles 409 conflict error', async () => {
      mocks.topDocuments.mockRejectedValueOnce(conflictError());

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'conflict',
        k: 1,
        query_type: 'documents',
      }, {});

      expect(parseOutput(result)).toMatchObject({ status: 409, retryable: false });
    });

    it('returns empty results gracefully', async () => {
      mocks.topSnippets.mockResolvedValueOnce({ results: [] });

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'no matches',
        k: 10,
        query_type: 'snippets',
      }, {});

      expect(parseOutput(result)).toEqual({ results: [], count: 0 });
    });
  });

  describe('retry logic', () => {
    it('succeeds on the 3rd attempt', async () => {
      mocks.topSnippets
        .mockRejectedValueOnce(rateLimitError())
        .mockRejectedValueOnce(rateLimitError())
        .mockResolvedValueOnce({ results: [{ path: 'success.md' }] });

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'retry twice',
        k: 1,
        query_type: 'snippets',
      }, {});

      expect(mocks.topSnippets).toHaveBeenCalledTimes(3);
      expect(parseOutput(result)).toEqual({ results: [{ path: 'success.md' }], count: 1 });
    });

    it('does not retry on 400 Bad Request', async () => {
      mocks.topDocuments.mockRejectedValueOnce(badRequestError());

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'bad request',
        k: 1,
        query_type: 'documents',
      }, {});

      expect(mocks.topDocuments).toHaveBeenCalledTimes(1);
      expect(parseOutput(result)).toMatchObject({ status: 400, retryable: false, attempts: 1 });
    });

    it('does not retry on 401 Unauthorized', async () => {
      mocks.topDocuments.mockRejectedValueOnce(unauthorizedError());

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'unauthorized',
        k: 1,
        query_type: 'documents',
      }, {});

      expect(mocks.topDocuments).toHaveBeenCalledTimes(1);
      expect(parseOutput(result)).toMatchObject({ status: 401, retryable: false, attempts: 1 });
    });

    it('exhausts all retries on persistent 500', async () => {
      mocks.topDocuments.mockRejectedValue(serverError());

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'server error',
        k: 1,
        query_type: 'documents',
      }, {});

      expect(mocks.topDocuments).toHaveBeenCalledTimes(5);
      expect(parseOutput(result)).toMatchObject({ status: 500, retryable: true, attempts: 5 });
    });
  });

  describe('zeroentropy_embed', () => {
    it('generates embeddings for single text', async () => {
      mocks.embed.mockResolvedValueOnce({ results: [{ embedding: [0.1, 0.2, 0.3] }] });

      const result = await tools.zeroentropy_embed.execute({
        texts: ['one text'],
        input_type: 'query',
        dimensions: 3,
        encoding_format: 'float',
      }, {});

      expect(mocks.embed).toHaveBeenCalledWith(expect.objectContaining({ input: ['one text'], input_type: 'query' }));
      expect(parseOutput(result)).toEqual({ embeddings: [[0.1, 0.2, 0.3]], count: 1, dimensions: 3 });
    });

    it('generates embeddings for multiple texts', async () => {
      mocks.embed.mockResolvedValueOnce({ results: [{ embedding: [1] }, { embedding: [2] }] });

      const result = await tools.zeroentropy_embed.execute({
        texts: ['first', 'second'],
        input_type: 'document',
        dimensions: 1,
        encoding_format: 'float',
      }, {});

      expect(mocks.embed).toHaveBeenCalledWith(expect.objectContaining({ input: ['first', 'second'] }));
      expect(parseOutput(result)).toEqual({ embeddings: [[1], [2]], count: 2, dimensions: 1 });
    });

    it('handles different dimensions', async () => {
      mocks.embed.mockResolvedValueOnce({ results: [{ embedding: [0.5, 0.6] }] });

      const result = await tools.zeroentropy_embed.execute({
        texts: ['small vector'],
        input_type: 'query',
        dimensions: 2,
        encoding_format: 'float',
      }, {});

      expect(mocks.embed).toHaveBeenCalledWith(expect.objectContaining({ dimensions: 2 }));
      expect(parseOutput(result).dimensions).toBe(2);
    });

    it('handles rate limit with retry', async () => {
      mocks.embed.mockRejectedValueOnce(rateLimitError()).mockResolvedValueOnce({ results: [{ embedding: [9] }] });

      const result = await tools.zeroentropy_embed.execute({
        texts: ['retry'],
        input_type: 'query',
        dimensions: 1,
        encoding_format: 'float',
      }, {});

      expect(mocks.embed).toHaveBeenCalledTimes(2);
      expect(parseOutput(result).embeddings).toEqual([[9]]);
    });

    it('wraps a single text string before calling API', async () => {
      mocks.embed.mockResolvedValueOnce({ results: [{ embedding: [0.1] }] });

      const result = await tools.zeroentropy_embed.execute({
        texts: 'hello',
        input_type: 'query',
        dimensions: 1,
        encoding_format: 'float',
      }, {});

      expect(mocks.embed).toHaveBeenCalledWith(expect.objectContaining({ input: ['hello'] }));
      expect(parseOutput(result)).toEqual({ embeddings: [[0.1]], count: 1, dimensions: 1 });
    });
  });

  describe('zeroentropy_rerank', () => {
    it('reranks documents and returns scored results', async () => {
      mocks.rerank.mockResolvedValueOnce({ results: [{ index: 1, relevance_score: 0.99 }, { index: 0, relevance_score: 0.2 }] });

      const result = await tools.zeroentropy_rerank.execute({
        query: 'best match',
        documents: ['weak', 'strong'],
      }, {});

      expect(parseOutput(result)).toEqual({
        results: [
          { index: 1, score: 0.99, document: 'strong' },
          { index: 0, score: 0.2, document: 'weak' },
        ],
        count: 2,
      });
    });

    it('handles top_n parameter', async () => {
      mocks.rerank.mockResolvedValueOnce({ results: [{ index: 0, relevance_score: 0.7 }] });

      await tools.zeroentropy_rerank.execute({ query: 'q', documents: ['a', 'b'], top_n: 1 }, {});

      expect(mocks.rerank).toHaveBeenCalledWith(expect.objectContaining({ top_n: 1 }));
    });

    it('handles rate limit with retry', async () => {
      mocks.rerank.mockRejectedValueOnce(rateLimitError()).mockResolvedValueOnce({ results: [{ index: 0, relevance_score: 1 }] });

      const result = await tools.zeroentropy_rerank.execute({ query: 'q', documents: ['a'] }, {});

      expect(mocks.rerank).toHaveBeenCalledTimes(2);
      expect(parseOutput(result).results[0].score).toBe(1);
    });
  });

  describe('zeroentropy_index', () => {
    it('indexes text document successfully', async () => {
      mocks.documentAdd.mockResolvedValueOnce({});

      const result = await tools.zeroentropy_index.execute({
        collection_name: 'kb',
        path: 'doc.txt',
        content_type: 'text',
        content: 'hello',
        overwrite: false,
      }, {});

      expect(mocks.documentAdd).toHaveBeenCalledWith(expect.objectContaining({
        collection_name: 'kb',
        path: 'doc.txt',
        content: { type: 'text', text: 'hello' },
        overwrite: false,
      }));
      expect(parseOutput(result)).toMatchObject({ success: true, path: 'doc.txt', status: 'indexed' });
    });

    it('indexes text-pages document', async () => {
      mocks.documentAdd.mockResolvedValueOnce({});

      await tools.zeroentropy_index.execute({
        collection_name: 'kb',
        path: 'pages.txt',
        content_type: 'text-pages',
        content: 'fallback',
        pages: ['p1', 'p2'],
        overwrite: false,
      }, {});

      expect(mocks.documentAdd).toHaveBeenCalledWith(expect.objectContaining({
        content: { type: 'text-pages', pages: ['p1', 'p2'] },
      }));
    });

    it('handles overwrite=true', async () => {
      mocks.documentAdd.mockResolvedValueOnce({});

      await tools.zeroentropy_index.execute({
        collection_name: 'kb',
        path: 'doc.txt',
        content_type: 'text',
        content: 'replacement',
        overwrite: true,
      }, {});

      expect(mocks.documentAdd).toHaveBeenCalledWith(expect.objectContaining({ overwrite: true }));
    });

    it('handles 409 conflict', async () => {
      mocks.documentAdd.mockRejectedValueOnce(conflictError());

      const result = await tools.zeroentropy_index.execute({
        collection_name: 'kb',
        path: 'doc.txt',
        content_type: 'text',
        content: 'duplicate',
        overwrite: false,
      }, {});

      expect(parseOutput(result)).toMatchObject({ status: 409, retryable: false });
    });
  });

  describe('split collection tools', () => {
    it('creates collection', async () => {
      mocks.collectionAdd.mockResolvedValueOnce({});

      const result = await tools.zeroentropy_create_collection.execute({ collection_name: 'kb' }, {});

      expect(mocks.collectionAdd).toHaveBeenCalledWith({ collection_name: 'kb' });
      expect(parseOutput(result)).toEqual({ success: true, action: 'create', collection_name: 'kb' });
    });

    it('deletes collection', async () => {
      mocks.collectionDelete.mockResolvedValueOnce({});

      const result = await tools.zeroentropy_delete_collection.execute({ collection_name: 'kb' }, {});

      expect(mocks.collectionDelete).toHaveBeenCalledWith({ collection_name: 'kb' });
      expect(parseOutput(result)).toEqual({ success: true, action: 'delete', collection_name: 'kb' });
    });

    it('lists collections', async () => {
      mocks.collectionGetList.mockResolvedValueOnce({ collections: [{ name: 'kb' }, { name: 'docs' }] });

      const result = await tools.zeroentropy_list_collections.execute({}, {});

      expect(mocks.collectionGetList).toHaveBeenCalledWith({});
      expect(parseOutput(result)).toEqual({ collections: [{ name: 'kb' }, { name: 'docs' }] });
    });
  });

  describe('zeroentropy_status', () => {
    it('returns document status', async () => {
      mocks.documentStatus.mockResolvedValueOnce({ status: 'indexed', last_updated: '2026-05-20T00:00:00Z' });

      const result = await tools.zeroentropy_status.execute({ collection_name: 'kb', path: 'doc.txt' }, {});

      expect(mocks.documentStatus).toHaveBeenCalledWith({ collection_name: 'kb', path: 'doc.txt' });
      expect(parseOutput(result)).toEqual({
        status: 'indexed',
        index_status: 'indexed',
        last_updated: '2026-05-20T00:00:00Z',
        path: 'doc.txt',
        collection_name: 'kb',
      });
    });
  });

  describe('zeroentropy_batch', () => {
    it('indexes multiple documents', async () => {
      mocks.documentAdd.mockResolvedValue({});

      const result = await tools.zeroentropy_batch.execute({
        collection_name: 'kb',
        documents: [
          { path: 'a.txt', content: 'A', content_type: 'text' },
          { path: 'b.txt', content: 'B', content_type: 'text' },
        ],
      }, {});

      expect(mocks.documentAdd).toHaveBeenCalledTimes(2);
      expect(parseOutput(result)).toEqual({ success_count: 2, failed_count: 0, errors: [] });
    });

    it('reports failures', async () => {
      mocks.documentAdd.mockResolvedValueOnce({}).mockRejectedValueOnce(badRequestError());

      const result = await tools.zeroentropy_batch.execute({
        collection_name: 'kb',
        documents: [
          { path: 'good.txt', content: 'good', content_type: 'text' },
          { path: 'bad.txt', content: 'bad', content_type: 'text' },
        ],
      }, {});

      expect(parseOutput(result)).toMatchObject({
        success_count: 1,
        failed_count: 1,
        errors: [{ path: 'bad.txt', error: { error: 'Bad Request', status: 400, retryable: false, attempts: 1 } }],
      });
    });

    it('handles an empty documents array', async () => {
      const result = await tools.zeroentropy_batch.execute({
        collection_name: 'kb',
        documents: [],
      }, {});

      expect(mocks.documentAdd).not.toHaveBeenCalled();
      expect(parseOutput(result)).toEqual({ success_count: 0, failed_count: 0, errors: [] });
    });
  });

  describe('edge cases', () => {
    it('handles network error without status as retryable', async () => {
      mocks.topSnippets.mockRejectedValue(new Error('ECONNRESET'));

      const result = await tools.zeroentropy_search.execute({
        collection_name: 'kb',
        query: 'network failure',
        k: 1,
        query_type: 'snippets',
      }, {});

      expect(mocks.topSnippets).toHaveBeenCalledTimes(5);
      expect(parseOutput(result)).toMatchObject({ error: 'ECONNRESET', retryable: true, attempts: 5 });
    });
  });
});
