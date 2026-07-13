import { describe, expect, it } from 'vitest';
import {
  createPullRequestRequestSchema,
  labelForChangeType,
  PR_CHANGE_TYPES,
  pullRequestResponseSchema,
} from './pullRequest.js';
import {
  sampleCreatePullRequestRequest,
  samplePullRequestResponse,
} from './fixtures/pullRequest.js';

describe('pull request schemas', () => {
  it('defines change types used for labels', () => {
    expect(PR_CHANGE_TYPES).toEqual(['feature', 'bugfix', 'refactor', 'documentation']);
    expect(labelForChangeType('bugfix')).toBe('bugfix');
    expect(labelForChangeType('documentation')).toBe('documentation');
  });

  it('validates create request and response fixtures', () => {
    expect(createPullRequestRequestSchema.safeParse(sampleCreatePullRequestRequest).success).toBe(
      true,
    );
    expect(createPullRequestRequestSchema.safeParse({}).success).toBe(true);
    expect(pullRequestResponseSchema.safeParse(samplePullRequestResponse).success).toBe(true);
  });

  it('rejects invalid change types and empty branches', () => {
    expect(
      createPullRequestRequestSchema.safeParse({ changeType: 'hotfix' }).success,
    ).toBe(false);
    expect(createPullRequestRequestSchema.safeParse({ headBranch: '' }).success).toBe(false);
  });
});
