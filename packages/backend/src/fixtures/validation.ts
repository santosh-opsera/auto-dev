import { z } from 'zod';

export const sampleValidationPayloadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  branchPattern: z
    .string()
    .min(1, 'Branch naming pattern is required')
    .refine((value) => {
      try {
        RegExp(value);
        return true;
      } catch {
        return false;
      }
    }, 'Branch naming pattern must be valid regex'),
  reviewers: z
    .array(z.string().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i, 'Invalid GitHub username'))
    .min(1, 'At least one reviewer is required'),
});

export const validSampleValidationPayload = {
  name: 'Team defaults',
  branchPattern: '^feature/[A-Z]+-\\d+$',
  reviewers: ['octocat'],
};

export const invalidSampleValidationPayload = {
  name: '',
  branchPattern: '[invalid',
  reviewers: ['not a valid username!'],
};
