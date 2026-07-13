import type {
  GeneratedTest,
  TestCaseResult,
  TestFramework,
  TestRunResult,
} from '@autodev/shared-types';

export function buildTestGenerationPrompt(input: {
  acceptanceCriteria: string[];
  sourceFiles: Record<string, string>;
  framework: TestFramework;
  namingPattern: string;
  chunkName: string;
  chunkDescription: string;
}): string {
  const sources = Object.entries(input.sourceFiles)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  return [
    'Generate automated tests for the implemented chunk.',
    `Framework: ${input.framework}`,
    `Naming convention: ${input.namingPattern}`,
    `Chunk: ${input.chunkName}`,
    `Description: ${input.chunkDescription}`,
    'Produce unit, integration, and edge-case tests.',
    'Return JSON: { "framework": "...", "tests": [{ "id", "name", "kind", "filePath", "content" }] }',
    'Acceptance criteria:',
    ...input.acceptanceCriteria.map((item, index) => `${index + 1}. ${item}`),
    'Source files under test:',
    sources || '(none provided — infer from acceptance criteria)',
  ].join('\n');
}

export function buildBugFixPrompt(input: {
  failingTests: TestCaseResult[];
  sourceFiles: Record<string, string>;
  iteration: number;
  maxIterations: number;
  generatedTests: GeneratedTest[];
}): string {
  const failures = input.failingTests
    .map(
      (test) =>
        `- ${test.name}: ${test.errorMessage ?? 'failed'}${test.stackTrace ? `\n  ${test.stackTrace}` : ''}`,
    )
    .join('\n');

  const sources = Object.entries(input.sourceFiles)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  return [
    `Analyze test failures and produce a fix (iteration ${input.iteration}/${input.maxIterations}).`,
    'Return JSON: { "identifiedIssues": string[], "fixes": [{ "filePath", "summary", "replacementContent", "beforeSnippet?", "afterSnippet?" }], "rootCauseAnalysis"?: string }',
    'Failing tests:',
    failures || '(none)',
    'Current source files:',
    sources,
    `Generated test count: ${input.generatedTests.length}`,
  ].join('\n');
}

export function summarizeRunForLog(run: TestRunResult): string {
  return `${run.passedCount} passed, ${run.failedCount} failed (${run.durationMs}ms)`;
}
