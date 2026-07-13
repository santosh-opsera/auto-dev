import type { PrdResponse, PrdSections } from '@autodev/shared-types';

export interface ChunkPromptInput {
  prd: Pick<PrdResponse, 'id' | 'ticketKey' | 'sections' | 'codebaseContext'>;
}

export const CHUNK_SYSTEM_PROMPT = [
  'You are a senior engineer planning incremental implementation for an AI-powered SDLC platform.',
  'Decompose an approved PRD into ordered implementation chunks with clear boundaries.',
  'Return ONLY valid JSON (no markdown fences) with this shape:',
  '{"chunks":[{"tempId":"c1","name":"...","description":"...","scope":{"files":[],"modules":[]},"dependsOn":[],"estimatedComplexity":"low|medium|high"}]}',
  'Rules:',
  '- Produce at least one chunk.',
  '- Use tempId values like c1, c2 for dependency references in dependsOn.',
  '- Prefer natural boundaries: shared types/models, services, API routes, then UI.',
  '- dependsOn must reference other tempIds only; no cycles.',
  '- scope.files and scope.modules should be concrete paths/module names when possible.',
  '- estimatedComplexity must be one of: low, medium, high.',
].join(' ');

export function buildChunkUserPrompt(input: ChunkPromptInput): string {
  const { prd } = input;
  const sections: PrdSections = prd.sections;

  return [
    'Decompose the following approved PRD into implementation chunks.',
    '',
    `## PRD id: ${prd.id}`,
    `## Ticket: ${prd.ticketKey}`,
    '',
    '## Sections',
    JSON.stringify(sections, null, 2),
    '',
    '## Codebase context summary',
    JSON.stringify(prd.codebaseContext, null, 2),
  ].join('\n');
}
