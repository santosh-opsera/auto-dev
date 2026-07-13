import { describe, expect, it } from 'vitest';
import { samplePrdSections, samplePrdVersionTwo } from '../fixtures/prd';
import { diffLines, diffPrdSections } from './prdDiff';

describe('prdDiff', () => {
  it('marks identical lines as unchanged', () => {
    const lines = diffLines('one\ntwo', 'one\ntwo');
    expect(lines).toEqual([
      { kind: 'unchanged', text: 'one', leftLineNumber: 1, rightLineNumber: 1 },
      { kind: 'unchanged', text: 'two', leftLineNumber: 2, rightLineNumber: 2 },
    ]);
  });

  it('detects added and removed lines', () => {
    const lines = diffLines('alpha\nbeta', 'alpha\ngamma');
    expect(lines).toEqual([
      { kind: 'unchanged', text: 'alpha', leftLineNumber: 1, rightLineNumber: 1 },
      { kind: 'removed', text: 'beta', leftLineNumber: 2 },
      { kind: 'added', text: 'gamma', rightLineNumber: 2 },
    ]);
  });

  it('compares PRD sections and reports changed sections', () => {
    const result = diffPrdSections(samplePrdSections, samplePrdVersionTwo.sections);
    expect(result.changedSectionCount).toBe(1);
    const solution = result.sections.find((section) => section.key === 'solutionOutline');
    expect(solution?.changed).toBe(true);
    expect(solution?.lines.some((line) => line.kind === 'added')).toBe(true);
  });
});
