import type { GeneratedTest, TestFramework, TestRunResult } from '@autodev/shared-types';

export interface TestRunnerRunOptions {
  tests: GeneratedTest[];
  sourceFiles: Record<string, string>;
  /** When present in any source file, the stub runner reports failure. */
  bugMarker?: string;
}

export interface TestRunner {
  readonly framework: TestFramework;
  run(options: TestRunnerRunOptions): Promise<TestRunResult>;
}
