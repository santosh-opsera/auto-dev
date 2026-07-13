import { describe, expect, it } from 'vitest';
import {
  encodePrdSections,
  escapeHtml,
  prdCreateVersionRequestSchema,
  prdGenerateRequestSchema,
  prdListResponseSchema,
  prdResponseSchema,
  prdSectionsSchema,
} from './prd.js';
import {
  sampleExpectedPrdResponse,
  samplePrdSections,
  samplePrdVersionTwo,
  samplePrdWithXssAttempt,
} from './fixtures/prd.js';

describe('prd schemas', () => {
  it('validates required PRD sections', () => {
    expect(prdSectionsSchema.safeParse(samplePrdSections).success).toBe(true);
    expect(
      prdSectionsSchema.safeParse({
        ...samplePrdSections,
        userStories: [],
      }).success,
    ).toBe(false);
  });

  it('validates PRD response fixtures including versioning', () => {
    expect(prdResponseSchema.safeParse(sampleExpectedPrdResponse).success).toBe(true);
    expect(prdResponseSchema.safeParse(samplePrdVersionTwo).success).toBe(true);
    expect(samplePrdVersionTwo.previousVersionId).toBe(sampleExpectedPrdResponse.id);
    expect(
      prdListResponseSchema.safeParse({
        prds: [sampleExpectedPrdResponse, samplePrdVersionTwo],
      }).success,
    ).toBe(true);
  });

  it('validates generate and create-version requests', () => {
    expect(
      prdGenerateRequestSchema.safeParse({
        workflowId: 'wf-1',
        owner: 'santosh-opsera',
        repo: 'auto-dev',
      }).success,
    ).toBe(true);
    expect(
      prdCreateVersionRequestSchema.safeParse({
        sections: samplePrdSections,
        status: 'in_review',
      }).success,
    ).toBe(true);
  });
});

describe('XSS encoding', () => {
  it('escapes HTML entities in strings', () => {
    expect(escapeHtml(`<script>alert("xss")</script> & 'ok'`)).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;ok&#39;',
    );
  });

  it('encodes all PRD section fields', () => {
    const encoded = encodePrdSections(samplePrdWithXssAttempt);
    expect(encoded.problemStatement).toContain('&lt;script&gt;');
    expect(encoded.problemStatement).not.toContain('<script>');
    expect(encoded.userStories[0]).toContain('&lt;img');
    expect(encoded.solutionOutline).toContain('&amp;');
  });
});
