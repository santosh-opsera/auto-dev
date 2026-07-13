import type { CodebaseContext, NamingConvention, TestFramework } from '@autodev/shared-types';

const FRAMEWORK_HINTS: Array<{ framework: TestFramework; pattern: RegExp }> = [
  { framework: 'vitest', pattern: /vitest/i },
  { framework: 'jest', pattern: /jest/i },
  { framework: 'mocha', pattern: /mocha/i },
];

/**
 * Detects the codebase test framework from analyzer naming conventions and file paths.
 */
export function detectTestFramework(
  namingConventions: NamingConvention[] = [],
  filePaths: string[] = [],
): TestFramework {
  const evidence = [
    ...namingConventions.flatMap((item) => [item.pattern, ...item.examples]),
    ...filePaths,
  ].join('\n');

  for (const hint of FRAMEWORK_HINTS) {
    if (hint.pattern.test(evidence)) {
      return hint.framework;
    }
  }

  const hasVitestConfig = filePaths.some((path) => /vitest\.config\.[cm]?[jt]s$/i.test(path));
  if (hasVitestConfig) {
    return 'vitest';
  }

  const hasJestConfig = filePaths.some((path) => /jest\.config\.[cm]?[jt]s$/i.test(path));
  if (hasJestConfig) {
    return 'jest';
  }

  // Default to Vitest — matches this monorepo's convention when analyzer evidence is thin.
  return 'vitest';
}

export function detectTestFrameworkFromContext(context?: CodebaseContext): TestFramework {
  if (!context) {
    return 'vitest';
  }

  const paths = flattenFilePaths(context.fileStructureMap);
  return detectTestFramework(context.namingConventions, paths);
}

function flattenFilePaths(
  nodes: CodebaseContext['fileStructureMap'],
  acc: string[] = [],
): string[] {
  for (const node of nodes) {
    if (node.type === 'file') {
      acc.push(node.path);
    }
    if (node.children?.length) {
      flattenFilePaths(node.children, acc);
    }
  }
  return acc;
}

export function resolveTestFileNamingPattern(namingConventions: NamingConvention[]): string {
  const testConvention = namingConventions.find((item) => item.category === 'test');
  return testConvention?.pattern ?? '*.test.* / *.spec.* suffix';
}
