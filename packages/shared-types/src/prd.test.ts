import { describe, expect, it } from 'vitest';
import {
  encodePrdSections,
  escapeHtml,
  formatPrdSectionValue,
  prdCreateVersionRequestSchema,
  prdGenerateRequestSchema,
  prdListResponseSchema,
  prdRejectRequestSchema,
  prdResponseSchema,
  prdSectionsSchema,
} from './prd.js';
import {
  sampleApprovedPrd,
  sampleExpectedPrdResponse,
  samplePrdSections,
  samplePrdVersionTwo,
  samplePrdWithXssAttempt,
  sampleRejectedPrd,
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

  it('validates PRD response fixtures including versioning and approval states', () => {
    expect(prdResponseSchema.safeParse(sampleExpectedPrdResponse).success).toBe(true);
    expect(prdResponseSchema.safeParse(samplePrdVersionTwo).success).toBe(true);
    expect(prdResponseSchema.safeParse(sampleApprovedPrd).success).toBe(true);
    expect(prdResponseSchema.safeParse(sampleRejectedPrd).success).toBe(true);
    expect(samplePrdVersionTwo.previousVersionId).toBe(sampleExpectedPrdResponse.id);
    expect(sampleApprovedPrd.status).toBe('approved');
    expect(sampleRejectedPrd.rejectionReason).toBeTruthy();
    expect(
      prdListResponseSchema.safeParse({
        prds: [sampleExpectedPrdResponse, samplePrdVersionTwo, sampleApprovedPrd],
      }).success,
    ).toBe(true);
  });

  it('validates generate, create-version, and reject requests', () => {
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
    expect(prdRejectRequestSchema.safeParse({ reason: 'Needs clearer metrics' }).success).toBe(
      true,
    );
    expect(prdRejectRequestSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(formatPrdSectionValue(['a', 'b'])).toBe('a\nb');
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
