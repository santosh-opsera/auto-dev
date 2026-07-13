import {
  bugFixDraftSchema,
  generatedTestsDraftSchema,
  type BugFixDraft,
  type GeneratedTest,
  type GeneratedTestsDraft,
} from '@autodev/shared-types';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';

function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('No JSON object found in LLM response');
  }
}

export function parseGeneratedTestsLlmOutput(content: string): GeneratedTestsDraft {
  try {
    const parsed = extractJsonPayload(content);
    const result = generatedTestsDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError(
        'TestGenerationParseError',
        'LLM response did not match the required generated-tests schema.',
        502,
        'Retry test generation. If the failure persists, verify the LLM provider configuration.',
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'TestGenerationParseError',
      'Failed to parse LLM test-generation response as JSON.',
      502,
      'Retry test generation. If the failure persists, verify the LLM provider configuration.',
    );
  }
}

export function normalizeGeneratedTests(draft: GeneratedTestsDraft): GeneratedTest[] {
  return draft.tests.map((test) => ({
    id: test.id ?? randomUUID(),
    name: test.name,
    kind: test.kind,
    filePath: test.filePath,
    content: test.content,
  }));
}

export function parseBugFixLlmOutput(content: string): BugFixDraft {
  try {
    const parsed = extractJsonPayload(content);
    const result = bugFixDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError(
        'BugFixParseError',
        'LLM response did not match the required bug-fix schema.',
        502,
        'Retry the bug-fix iteration. If the failure persists, verify the LLM provider configuration.',
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'BugFixParseError',
      'Failed to parse LLM bug-fix response as JSON.',
      502,
      'Retry the bug-fix iteration. If the failure persists, verify the LLM provider configuration.',
    );
  }
}
