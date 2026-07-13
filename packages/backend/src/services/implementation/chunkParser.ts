import {
  chunkDecompositionDraftSchema,
  type ChunkDecompositionDraft,
} from '@autodev/shared-types';
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

export function parseChunkLlmOutput(content: string): ChunkDecompositionDraft {
  try {
    const parsed = extractJsonPayload(content);
    const result = chunkDecompositionDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError(
        'ChunkParseError',
        'LLM response did not match the required chunk decomposition schema.',
        502,
        'Retry chunk decomposition. If the failure persists, verify the LLM provider configuration.',
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      'ChunkParseError',
      'Failed to parse LLM chunk decomposition response as JSON.',
      502,
      'Retry chunk decomposition. If the failure persists, verify the LLM provider configuration.',
    );
  }
}
