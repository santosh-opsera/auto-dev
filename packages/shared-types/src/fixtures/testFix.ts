import type {
  BugFixDraft,
  ChunkTestReport,
  GeneratedTestsDraft,
} from '../testFix.js';

/** Sample source with a known bug marker used by the VitestRunner stub. */
export const sampleBuggySourceFiles: Record<string, string> = {
  'src/math/add.ts': `export function add(a: number, b: number): number {
  // __BUG__: intentionally wrong — subtracts instead of adding
  return a - b;
}
`,
};

export const sampleFixedSourceFiles: Record<string, string> = {
  'src/math/add.ts': `export function add(a: number, b: number): number {
  return a + b;
}
`,
};

export const sampleGeneratedTestsDraft: GeneratedTestsDraft = {
  framework: 'vitest',
  tests: [
    {
      id: 't-unit-1',
      name: 'add returns sum of two numbers',
      kind: 'unit',
      filePath: 'src/math/add.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { add } from './add.js';

describe('add', () => {
  it('returns sum of two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
`,
    },
    {
      id: 't-integration-1',
      name: 'add integrates with caller pipeline',
      kind: 'integration',
      filePath: 'src/math/add.integration.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { add } from './add.js';

describe('add integration', () => {
  it('composes sums across steps', () => {
    expect(add(add(1, 2), 3)).toBe(6);
  });
});
`,
    },
    {
      id: 't-edge-1',
      name: 'add handles zero and negatives',
      kind: 'edge',
      filePath: 'src/math/add.edge.test.ts',
      content: `import { describe, expect, it } from 'vitest';
import { add } from './add.js';

describe('add edge cases', () => {
  it('handles zero', () => {
    expect(add(0, 5)).toBe(5);
  });
  it('handles negatives', () => {
    expect(add(-2, 3)).toBe(1);
  });
});
`,
    },
  ],
};

export const sampleGeneratedTestsLlmJson = JSON.stringify(sampleGeneratedTestsDraft, null, 2);

/** First fix attempt — still buggy (marker remains). */
export const samplePartialBugFixDraft: BugFixDraft = {
  identifiedIssues: ['add subtracts operands instead of adding them'],
  rootCauseAnalysis: 'Off-by-operator: subtraction used where addition was required.',
  fixes: [
    {
      filePath: 'src/math/add.ts',
      summary: 'Attempted operator change but left debug marker',
      replacementContent: `export function add(a: number, b: number): number {
  // __BUG__: still present after partial fix
  return a + b;
}
`,
      beforeSnippet: 'return a - b;',
      afterSnippet: 'return a + b; // marker remains',
    },
  ],
};

/** Successful fix that removes the bug marker. */
export const sampleSuccessfulBugFixDraft: BugFixDraft = {
  identifiedIssues: ['add still contains __BUG__ marker after prior attempt'],
  rootCauseAnalysis:
    'The arithmetic operator was corrected earlier, but the __BUG__ marker remained and continued to fail the stub runner.',
  fixes: [
    {
      filePath: 'src/math/add.ts',
      summary: 'Remove bug marker and keep correct addition',
      replacementContent: sampleFixedSourceFiles['src/math/add.ts']!,
      beforeSnippet: '// __BUG__',
      afterSnippet: 'return a + b;',
    },
  ],
};

export const samplePartialBugFixLlmJson = JSON.stringify(samplePartialBugFixDraft, null, 2);
export const sampleSuccessfulBugFixLlmJson = JSON.stringify(sampleSuccessfulBugFixDraft, null, 2);

export const sampleChunkTestReportPassed: ChunkTestReport = {
  id: 'test-report-001',
  workflowDocumentId: 'workflow-doc-001',
  workflowId: 'workflow-001',
  chunkId: 'chunk-001',
  status: 'passed',
  framework: 'vitest',
  maxIterations: 5,
  iterationsUsed: 2,
  generatedTests: sampleGeneratedTestsDraft.tests.map((test) => ({
    id: test.id ?? 'generated',
    name: test.name,
    kind: test.kind,
    filePath: test.filePath,
    content: test.content,
  })),
  iterations: [
    {
      iteration: 1,
      testResults: {
        passed: false,
        results: [
          {
            name: 'add returns sum of two numbers',
            status: 'failed',
            errorMessage: 'Expected 5 but source still contains __BUG__',
            stackTrace: 'at VitestRunner.run (vitestRunner.ts:1)',
          },
        ],
        passedCount: 0,
        failedCount: 1,
        durationMs: 12,
        framework: 'vitest',
      },
      identifiedIssues: samplePartialBugFixDraft.identifiedIssues,
      appliedFixes: [
        {
          filePath: 'src/math/add.ts',
          summary: samplePartialBugFixDraft.fixes[0]!.summary,
          beforeSnippet: samplePartialBugFixDraft.fixes[0]!.beforeSnippet,
          afterSnippet: samplePartialBugFixDraft.fixes[0]!.afterSnippet,
        },
      ],
      loggedAt: '2026-07-13T16:00:00.000Z',
    },
    {
      iteration: 2,
      testResults: {
        passed: true,
        results: [
          {
            name: 'add returns sum of two numbers',
            status: 'passed',
            durationMs: 4,
          },
        ],
        passedCount: 1,
        failedCount: 0,
        durationMs: 8,
        framework: 'vitest',
      },
      identifiedIssues: [],
      appliedFixes: [],
      loggedAt: '2026-07-13T16:00:01.000Z',
    },
  ],
  coverage: {
    lines: 82,
    branches: 70,
    functions: 90,
    statements: 81,
    overallPercent: 80.75,
  },
  finalTestResults: {
    passed: true,
    results: [
      {
        name: 'add returns sum of two numbers',
        status: 'passed',
        durationMs: 4,
      },
    ],
    passedCount: 1,
    failedCount: 0,
    durationMs: 8,
    framework: 'vitest',
  },
  createdAt: '2026-07-13T16:00:00.000Z',
  updatedAt: '2026-07-13T16:00:01.000Z',
};

export const sampleChunkTestReportFailed: ChunkTestReport = {
  ...sampleChunkTestReportPassed,
  id: 'test-report-002',
  status: 'failed',
  iterationsUsed: 5,
  failureReport: {
    failingTests: [
      {
        name: 'add returns sum of two numbers',
        status: 'failed',
        errorMessage: 'Expected 5 but source still contains __BUG__',
        stackTrace: 'at VitestRunner.run (vitestRunner.ts:1)',
      },
    ],
    attemptedFixes: [
      {
        filePath: 'src/math/add.ts',
        summary: 'Partial operator change',
      },
    ],
    rootCauseAnalysis:
      'Max iterations exhausted while __BUG__ marker remained in source under test.',
    iterationsExhausted: 5,
    maxIterations: 5,
  },
  finalTestResults: {
    passed: false,
    results: [
      {
        name: 'add returns sum of two numbers',
        status: 'failed',
        errorMessage: 'Expected 5 but source still contains __BUG__',
      },
    ],
    passedCount: 0,
    failedCount: 1,
    durationMs: 10,
    framework: 'vitest',
  },
  updatedAt: '2026-07-13T16:00:05.000Z',
};
