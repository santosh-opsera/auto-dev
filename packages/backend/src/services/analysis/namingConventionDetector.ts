import type { NamingConvention, RepositoryTreeEntry } from '@autodev/shared-types';

function countMatches(files: string[], pattern: RegExp): number {
  return files.filter((file) => pattern.test(file)).length;
}

export function detectNamingConventions(tree: RepositoryTreeEntry[]): NamingConvention[] {
  const files = tree.filter((entry) => entry.type === 'file').map((entry) => entry.path);
  const conventions: NamingConvention[] = [];

  const camelCaseFiles = files.filter((file) => /\/[a-z][a-zA-Z0-9]*\.[a-z]+$/.test(file));
  if (camelCaseFiles.length > 0) {
    conventions.push({
      category: 'file',
      pattern: 'camelCase filenames',
      examples: camelCaseFiles.slice(0, 3),
      confidence: Math.min(1, camelCaseFiles.length / Math.max(files.length, 1)),
    });
  }

  const kebabFiles = files.filter((file) => /\/[a-z0-9]+(?:-[a-z0-9]+)+\.[a-z]+$/.test(file));
  if (kebabFiles.length > 0) {
    conventions.push({
      category: 'component',
      pattern: 'kebab-case filenames',
      examples: kebabFiles.slice(0, 3),
      confidence: Math.min(1, kebabFiles.length / Math.max(files.length, 1)),
    });
  }

  const pascalFiles = files.filter((file) => /\/[A-Z][A-Za-z0-9]+\.(tsx|jsx)$/.test(file));
  if (pascalFiles.length > 0) {
    conventions.push({
      category: 'component',
      pattern: 'PascalCase React components',
      examples: pascalFiles.slice(0, 3),
      confidence: Math.min(1, pascalFiles.length / Math.max(files.length, 1)),
    });
  }

  const testFiles = files.filter((file) => /\.(test|spec)\.[jt]sx?$/.test(file));
  if (testFiles.length > 0) {
    conventions.push({
      category: 'test',
      pattern: '*.test.* / *.spec.* suffix',
      examples: testFiles.slice(0, 3),
      confidence: Math.min(1, testFiles.length / Math.max(files.length, 1)),
    });
  }

  const snakeFiles = countMatches(files, /\/[a-z0-9]+(?:_[a-z0-9]+)+\.[a-z]+$/);
  if (snakeFiles > 0) {
    conventions.push({
      category: 'file',
      pattern: 'snake_case filenames',
      examples: files.filter((file) => /\/[a-z0-9]+(?:_[a-z0-9]+)+\.[a-z]+$/.test(file)).slice(0, 3),
      confidence: Math.min(1, snakeFiles / Math.max(files.length, 1)),
    });
  }

  const functionCamel = files.filter((file) => /Service\.ts$/.test(file) || /Controller\.ts$/.test(file));
  if (functionCamel.length > 0) {
    conventions.push({
      category: 'function',
      pattern: 'camelCase service/controller modules',
      examples: functionCamel.slice(0, 3),
      confidence: 0.75,
    });
  }

  return conventions;
}
