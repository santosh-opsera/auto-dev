import { describe, expect, it } from 'vitest';
import {
  sampleAlignedTicketIntent,
  sampleArchitectureConflictTicketIntent,
  sampleAutoDevLikeContext,
  sampleExpectedArchitectureDivergence,
  sampleExpectedNamingDivergence,
  sampleExpectedPatternDivergence,
  sampleNamingConflictTicketIntent,
  samplePatternConflictTicketIntent,
} from '@autodev/shared-types';
import {
  buildDivergenceSummary,
  detectArchitectureDivergences,
  detectDivergences,
  detectNamingDivergences,
  detectPatternDivergences,
} from './divergenceDetector.js';

const context = {
  ...sampleAutoDevLikeContext,
  fileStructureMap: [],
  dependencyGraph: [],
};

describe('divergenceDetector', () => {
  it('returns no divergences when ticket aligns with codebase conventions', () => {
    const divergences = detectDivergences(sampleAlignedTicketIntent, context);
    expect(divergences).toEqual([]);
    expect(buildDivergenceSummary(divergences)).toContain('aligns');
  });

  it('detects naming divergences for snake_case proposals in camelCase repos', () => {
    const divergences = detectNamingDivergences(sampleNamingConflictTicketIntent, context);
    expect(divergences).toHaveLength(1);
    expect(divergences[0]?.type).toBe('naming');
    expect(divergences[0]?.severity).toBe(sampleExpectedNamingDivergence.severity);
  });

  it('detects pattern divergences when ticket proposes MVC in service-layer repos', () => {
    const divergences = detectPatternDivergences(samplePatternConflictTicketIntent, context);
    expect(divergences.some((divergence) => divergence.type === 'pattern')).toBe(true);
    expect(divergences[0]?.severity).toBe(sampleExpectedPatternDivergence.severity);
  });

  it('detects architecture divergences when ticket targets controllers layer', () => {
    const divergences = detectArchitectureDivergences(
      sampleArchitectureConflictTicketIntent,
      context,
    );
    expect(divergences).toHaveLength(1);
    expect(divergences[0]?.type).toBe('architecture');
    expect(divergences[0]?.affectedFiles.length).toBeGreaterThan(0);
    expect(divergences[0]?.severity).toBe(sampleExpectedArchitectureDivergence.severity);
  });

  it('aggregates all divergence types', () => {
    const intent = {
      ...sampleArchitectureConflictTicketIntent,
      proposedApproach:
        'Use MVC controllers with user_service.ts and get_user_by_id in packages/backend/src/controllers.',
      acceptanceCriteria: ['get_user_by_id works'],
    };

    const divergences = detectDivergences(intent, context);
    expect(divergences.some((divergence) => divergence.type === 'naming')).toBe(true);
    expect(divergences.some((divergence) => divergence.type === 'pattern')).toBe(true);
    expect(divergences.some((divergence) => divergence.type === 'architecture')).toBe(true);
  });
});
