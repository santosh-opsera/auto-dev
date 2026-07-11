import { describe, expect, it } from 'vitest';
import { sampleSmallRepoTree } from '@autodev/shared-types';
import { detectNamingConventions } from './namingConventionDetector.js';
import { detectDesignPatterns } from './designPatternDetector.js';
import { buildDependencyGraph } from './dependencyGraphBuilder.js';

describe('analysis detectors', () => {
  it('detects naming conventions from repository paths', () => {
    const conventions = detectNamingConventions(sampleSmallRepoTree);
    expect(conventions.some((item) => item.category === 'test')).toBe(true);
    expect(conventions.some((item) => item.category === 'function')).toBe(true);
  });

  it('detects repository and service-layer design patterns', () => {
    const patterns = detectDesignPatterns(sampleSmallRepoTree);
    expect(patterns.map((pattern) => pattern.pattern)).toEqual(
      expect.arrayContaining(['repository', 'service-layer']),
    );
  });

  it('builds dependency edges from import statements', () => {
    const edges = buildDependencyGraph({
      'src/services/userService.ts':
        "import { userRepository } from '../repositories/userRepository.js';",
    });

    expect(edges[0]).toMatchObject({
      from: 'src/services/userService.ts',
      type: 'import',
    });
  });
});
