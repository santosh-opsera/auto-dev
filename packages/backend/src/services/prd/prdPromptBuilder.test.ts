import { describe, expect, it } from 'vitest';
import { sampleAutoDevLikeContext, sampleTicketIntent } from '@autodev/shared-types';
import { PRD_SYSTEM_PROMPT, buildPrdUserPrompt } from './prdPromptBuilder.js';
import { parsePrdLlmOutput } from './prdParser.js';
import { samplePrdLlmJsonResponse, samplePrdSections } from '@autodev/shared-types';
import { buildCodebaseContextSummary } from './prdGenerationService.js';

describe('prdPromptBuilder', () => {
  it('builds a structured system and user prompt with codebase context', () => {
    expect(PRD_SYSTEM_PROMPT).toContain('problemStatement');
    expect(PRD_SYSTEM_PROMPT).toContain('successMetrics');

    const prompt = buildPrdUserPrompt({
      ticketIntent: sampleTicketIntent,
      codebaseContext: {
        ...sampleAutoDevLikeContext,
        analyzedAt: sampleAutoDevLikeContext.analyzedAt,
      },
      affectedModules: ['backend', 'auth'],
      applicablePatterns: ['service-layer'],
      integrationPoints: ['packages/backend/src/services'],
    });

    expect(prompt).toContain(sampleTicketIntent.ticketKey);
    expect(prompt).toContain('affectedModules');
    expect(prompt).toContain('service-layer');
    expect(prompt).toContain(sampleAutoDevLikeContext.repo);
  });
});

describe('prdParser', () => {
  it('parses raw JSON PRD sections', () => {
    const sections = parsePrdLlmOutput(samplePrdLlmJsonResponse);
    expect(sections.problemStatement).toBe(samplePrdSections.problemStatement);
    expect(sections.userStories).toHaveLength(samplePrdSections.userStories.length);
  });

  it('parses fenced JSON responses', () => {
    const sections = parsePrdLlmOutput(`\`\`\`json\n${samplePrdLlmJsonResponse}\n\`\`\``);
    expect(sections.acceptanceCriteria.length).toBeGreaterThan(0);
  });

  it('throws a clear error for invalid LLM payloads', () => {
    expect(() => parsePrdLlmOutput('not json')).toThrow(/Failed to parse|did not match/);
  });
});

describe('buildCodebaseContextSummary', () => {
  it('merges ticket components with codebase modules and patterns', () => {
    const summary = buildCodebaseContextSummary(sampleTicketIntent, {
      ...sampleAutoDevLikeContext,
      analyzedAt: sampleAutoDevLikeContext.analyzedAt,
    });

    expect(summary.affectedModules).toEqual(
      expect.arrayContaining(['backend', 'auth', 'services', 'routes']),
    );
    expect(summary.applicablePatterns).toEqual(
      expect.arrayContaining(['service-layer', 'repository']),
    );
    expect(summary.integrationPoints.length).toBeGreaterThan(0);
  });
});
