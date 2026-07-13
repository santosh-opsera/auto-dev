import { describe, expect, it } from 'vitest';
import { parseChunkLlmOutput } from './chunkParser.js';
import { sampleChunkLlmJsonResponse } from '@autodev/shared-types';
import { AppError } from '../../utils/errors.js';

describe('parseChunkLlmOutput', () => {
  it('parses valid chunk decomposition JSON', () => {
    const draft = parseChunkLlmOutput(sampleChunkLlmJsonResponse);
    expect(draft.chunks).toHaveLength(3);
    expect(draft.chunks[0]?.tempId).toBe('c1');
  });

  it('parses fenced JSON responses', () => {
    const draft = parseChunkLlmOutput(`\`\`\`json\n${sampleChunkLlmJsonResponse}\n\`\`\``);
    expect(draft.chunks[1]?.dependsOn).toEqual(['c1']);
  });

  it('rejects invalid payloads', () => {
    expect(() => parseChunkLlmOutput('{"chunks":[]}')).toThrow(AppError);
  });
});
