import type { GeneratedTest, TestCaseResult, TestRunResult } from '@autodev/shared-types';
import type { TestRunner, TestRunnerRunOptions } from './testRunner.js';

export const DEFAULT_BUG_MARKER = '__BUG__';

/**
 * Stub Vitest runner for unit/integration loops.
 * Simulates pass/fail by scanning source files for a bug marker instead of spawning Vitest.
 */
export class VitestRunner implements TestRunner {
  readonly framework = 'vitest' as const;

  constructor(private readonly defaultBugMarker: string = DEFAULT_BUG_MARKER) {}

  async run(options: TestRunnerRunOptions): Promise<TestRunResult> {
    const started = Date.now();
    const marker = options.bugMarker ?? this.defaultBugMarker;
    const hasBug = Object.values(options.sourceFiles).some((content) => content.includes(marker));
    const results = options.tests.map((test) => this.evaluateTest(test, hasBug, marker));
    const failedCount = results.filter((result) => result.status === 'failed').length;
    const passedCount = results.filter((result) => result.status === 'passed').length;

    return {
      passed: failedCount === 0,
      results,
      passedCount,
      failedCount,
      durationMs: Math.max(1, Date.now() - started),
      framework: this.framework,
    };
  }

  private evaluateTest(test: GeneratedTest, hasBug: boolean, marker: string): TestCaseResult {
    if (!hasBug) {
      return {
        name: test.name,
        status: 'passed',
        durationMs: 1,
      };
    }

    return {
      name: test.name,
      status: 'failed',
      errorMessage: `Expected passing assertions but source still contains ${marker}`,
      stackTrace: `Error: ${test.name} failed\n    at VitestRunner.evaluateTest (vitestRunner.ts:1:1)`,
      durationMs: 1,
    };
  }
}
