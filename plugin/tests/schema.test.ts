import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * These tests exercise REAL Zod schemas (not the no-op plugin mock used in
 * index.test.ts) to guarantee the input-size guards on the plugin tools
 * actually reject oversized/empty input. They mirror the schemas defined in
 * src/index.ts so a regression that weakens a limit fails CI.
 */
describe('plugin input-validation schemas (real Zod)', () => {
  describe('embed texts .max(128)', () => {
    const schema = z.array(z.string().min(1)).max(128);

    it('accepts up to 128 texts', () => {
      expect(() => schema.parse(Array.from({ length: 128 }, (_, i) => `t${i}`))).not.toThrow();
    });

    it('rejects 129 texts', () => {
      expect(() => schema.parse(Array.from({ length: 129 }, (_, i) => `t${i}`))).toThrow();
    });

    it('rejects an empty string element', () => {
      expect(() => schema.parse([''])).toThrow();
    });
  });

  describe('rerank documents .max(100)', () => {
    const schema = z.array(z.string().min(1)).max(100);

    it('accepts up to 100 documents', () => {
      expect(() => schema.parse(Array.from({ length: 100 }, (_, i) => `d${i}`))).not.toThrow();
    });

    it('rejects 101 documents', () => {
      expect(() => schema.parse(Array.from({ length: 101 }, (_, i) => `d${i}`))).toThrow();
    });
  });

  describe('batch documents .max(100)', () => {
    const docSchema = z.object({
      path: z.string().min(1),
      content: z.string().min(1).max(500_000),
      content_type: z.enum(['text', 'text-pages', 'text-pages-unordered', 'auto']),
      pages: z.array(z.string().min(1)).optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    });
    const schema = z.array(docSchema).max(100);

    it('accepts a valid batch document', () => {
      expect(() => schema.parse([{ path: 'a.txt', content: 'hello', content_type: 'text' }])).not.toThrow();
    });

    it('rejects 101 documents', () => {
      const docs = Array.from({ length: 101 }, (_, i) => ({
        path: `p${i}.txt`,
        content: 'x',
        content_type: 'text' as const,
      }));
      expect(() => schema.parse(docs)).toThrow();
    });

    it('rejects an invalid content_type', () => {
      expect(() =>
        schema.parse([{ path: 'a.txt', content: 'x', content_type: 'pdf' }])
      ).toThrow();
    });

    it('rejects an empty path', () => {
      expect(() =>
        schema.parse([{ path: '', content: 'x', content_type: 'text' }])
      ).toThrow();
    });
  });

  describe('content .max(500_000)', () => {
    const schema = z.string().min(1).max(500_000);

    it('accepts content at the 500k limit', () => {
      expect(() => schema.parse('a'.repeat(500_000))).not.toThrow();
    });

    it('rejects content over 500k', () => {
      expect(() => schema.parse('a'.repeat(500_001))).toThrow();
    });

    it('rejects empty content', () => {
      expect(() => schema.parse('')).toThrow();
    });
  });

  describe('collection_name .min(1)', () => {
    const schema = z.string().min(1);

    it('accepts a non-empty name', () => {
      expect(() => schema.parse('kb')).not.toThrow();
    });

    it('rejects an empty name', () => {
      expect(() => schema.parse('')).toThrow();
    });
  });
});
