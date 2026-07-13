import type { CodebaseContext, TicketIntent } from '@autodev/shared-types';

export interface PrdPromptInput {
  ticketIntent: TicketIntent;
  codebaseContext?: CodebaseContext;
  affectedModules: string[];
  applicablePatterns: string[];
  integrationPoints: string[];
}

export const PRD_SYSTEM_PROMPT = [
  'You are a product requirements analyst for an AI-powered SDLC platform.',
  'Return ONLY valid JSON (no markdown fences) with exactly these keys:',
  'problemStatement (string),',
  'solutionOutline (string),',
  'userStories (string[]),',
  'acceptanceCriteria (string[]),',
  'scopeBoundaries (string[]),',
  'dependencies (string[]),',
  'risks (string[]),',
  'successMetrics (string[]).',
  'Each array must contain concrete, reviewable items.',
  'Incorporate the provided codebase context (modules, patterns, integration points).',
].join(' ');

export function buildPrdUserPrompt(input: PrdPromptInput): string {
  const { ticketIntent, codebaseContext, affectedModules, applicablePatterns, integrationPoints } =
    input;

  const contextBlock = codebaseContext
    ? {
        owner: codebaseContext.owner,
        repo: codebaseContext.repo,
        branch: codebaseContext.branch,
        designPatterns: codebaseContext.designPatterns.map((pattern) => pattern.pattern),
        architecturalLayers: codebaseContext.architecturalLayers.map((layer) => layer.layer),
        namingConventions: codebaseContext.namingConventions.map(
          (convention) => `${convention.category}: ${convention.pattern}`,
        ),
      }
    : null;

  return [
    'Generate a structured PRD from the following ticket intent and codebase context.',
    '',
    '## TicketIntent',
    JSON.stringify(
      {
        ticketKey: ticketIntent.ticketKey,
        problemStatement: ticketIntent.problemStatement,
        proposedApproach: ticketIntent.proposedApproach,
        acceptanceCriteria: ticketIntent.acceptanceCriteria,
        affectedComponents: ticketIntent.affectedComponents,
        dependencies: ticketIntent.dependencies,
        constraints: ticketIntent.constraints,
      },
      null,
      2,
    ),
    '',
    '## Codebase context summary',
    JSON.stringify(
      {
        affectedModules,
        applicablePatterns,
        integrationPoints,
        repository: contextBlock,
      },
      null,
      2,
    ),
    '',
    'Respond with JSON only.',
  ].join('\n');
}
