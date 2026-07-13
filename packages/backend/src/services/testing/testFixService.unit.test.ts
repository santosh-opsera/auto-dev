import { describe, expect, it } from 'vitest';
import {
  sampleBuggySourceFiles,
  sampleFixedSourceFiles,
  sampleGeneratedTestsDraft,
  sampleGeneratedTestsLlmJson,
  sampleSuccessfulBugFixLlmJson,
} from '@autodev/shared-types';
import { VitestRunner } from './vitestRunner.js';
import { detectTestFramework, resolveTestFileNamingPattern } from './testFrameworkDetector.js';
import { buildBugFixPrompt, buildTestGenerationPrompt } from './testPromptBuilder.js';
import {
  normalizeGeneratedTests,
  parseBugFixLlmOutput,
  parseGeneratedTestsLlmOutput,
} from './testParser.js';
import { buildFailureReport, stubCoverageMetrics } from './testFixService.js';

describe('VitestRunner stub', () => {
  const runner = new VitestRunner();
  const tests = normalizeGeneratedTests(sampleGeneratedTestsDraft);

  it('fails when source contains the bug marker', async () => {
    const result = await runner.run({
      tests,
      sourceFiles: sampleBuggySourceFiles,
    });
    expect(result.passed).toBe(false);
    expect(result.failedCount).toBe(tests.length);
    expect(result.results[0]?.stackTrace).toContain('VitestRunner');
  });

  it('passes when the bug marker is removed', async () => {
    const result = await runner.run({
      tests,
      sourceFiles: sampleFixedSourceFiles,
    });
    expect(result.passed).toBe(true);
    expect(result.failedCount).toBe(0);
    expect(result.passedCount).toBe(tests.length);
  });
});

describe('test framework detection', () => {
  it('detects vitest from naming evidence and defaults when unknown', () => {
    expect(
      detectTestFramework(
        [{ category: 'test', pattern: 'vitest *.test.ts', examples: ['foo.test.ts'], confidence: 0.9 }],
        ['packages/backend/vitest.config.ts'],
      ),
    ).toBe('vitest');
    expect(detectTestFramework([], [])).toBe('vitest');
    expect(resolveTestFileNamingPattern([])).toContain('*.test');
  });
});

describe('prompt construction and parsers', () => {
  it('builds generation prompts with AC, framework, and sources', () => {
    const prompt = buildTestGenerationPrompt({
      acceptanceCriteria: ['add(2,3) === 5'],
      sourceFiles: sampleBuggySourceFiles,
      framework: 'vitest',
      namingPattern: '*.test.ts',
      chunkName: 'Math helpers',
      chunkDescription: 'Fix add',
    });
    expect(prompt).toContain('Framework: vitest');
    expect(prompt).toContain('add(2,3) === 5');
    expect(prompt).toContain('src/math/add.ts');
    expect(prompt).toContain('unit, integration, and edge-case');
  });

  it('builds bug-fix prompts with failing tests and iteration bounds', () => {
    const prompt = buildBugFixPrompt({
      failingTests: [
        {
          name: 'add returns sum',
          status: 'failed',
          errorMessage: 'still contains __BUG__',
        },
      ],
      sourceFiles: sampleBuggySourceFiles,
      iteration: 2,
      maxIterations: 5,
      generatedTests: normalizeGeneratedTests(sampleGeneratedTestsDraft),
    });
    expect(prompt).toContain('iteration 2/5');
    expect(prompt).toContain('still contains __BUG__');
  });

  it('parses generated tests and bug-fix LLM JSON', () => {
    const draft = parseGeneratedTestsLlmOutput(sampleGeneratedTestsLlmJson);
    expect(draft.tests).toHaveLength(3);
    expect(normalizeGeneratedTests(draft).every((test) => test.id)).toBe(true);

    const fix = parseBugFixLlmOutput(sampleSuccessfulBugFixLlmJson);
    expect(fix.fixes[0]?.filePath).toBe('src/math/add.ts');
    expect(fix.fixes[0]?.replacementContent).not.toContain('__BUG__');
  });
});

describe('failure report and coverage stubs', () => {
  it('builds a detailed failure report when iterations are exhausted', () => {
    const finalRun = {
      passed: false,
      results: [
        {
          name: 'add returns sum',
          status: 'failed' as const,
          errorMessage: 'bug remains',
        },
      ],
      passedCount: 0,
      failedCount: 1,
      durationMs: 5,
      framework: 'vitest' as const,
    };

    const report = buildFailureReport({
      finalRun,
      iterations: [
        {
          iteration: 1,
          testResults: finalRun,
          identifiedIssues: ['wrong operator'],
          appliedFixes: [{ filePath: 'src/math/add.ts', summary: 'partial fix' }],
          loggedAt: new Date().toISOString(),
        },
      ],
      maxIterations: 5,
      rootCauseAnalysis: 'Operator still incorrect after retries.',
    });

    expect(report.iterationsExhausted).toBe(5);
    expect(report.failingTests).toHaveLength(1);
    expect(report.attemptedFixes).toHaveLength(1);
    expect(report.rootCauseAnalysis).toContain('Operator');
  });

  it('stubs coverage percentages from pass rate', () => {
    const coverage = stubCoverageMetrics(
      {
        passed: true,
        results: [{ name: 'a', status: 'passed' }],
        passedCount: 1,
        failedCount: 0,
        durationMs: 1,
        framework: 'vitest',
      },
      1,
    );
    expect(coverage.overallPercent).toBe(100);
    expect(coverage.lines).toBeGreaterThan(0);
  });
});
