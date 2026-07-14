import { describe, expect, it } from 'vitest';
import {
  findDeprecatedComposeVersionFields,
  formatComposeVersionErrors,
} from './composeVersionGuard.js';

describe('composeVersionGuard', () => {
  it('flags docker-compose YAML files that declare a deprecated version field', () => {
    const hits = findDeprecatedComposeVersionFields(
      '/repo',
      ['/repo/docker-compose.yml', '/repo/packages/backend/src/fixtures/docker-compose.qa.yml'],
      (absolutePath) => {
        if (absolutePath.endsWith('docker-compose.yml')) {
          return "version: '3.8'\nservices:\n  app:\n    image: node:22.23-alpine3.18\n";
        }
        return 'services:\n  app:\n    image: node:22.23-alpine3.18\n';
      },
    );

    expect(hits).toHaveLength(1);
    expect(hits[0]?.relativePath).toBe('docker-compose.yml');
    expect(formatComposeVersionErrors(hits)).toMatch(/Compose V5/i);
  });

  it('allows Compose V5 files without a version field', () => {
    const hits = findDeprecatedComposeVersionFields(
      '/repo',
      ['/repo/docker-compose.yml'],
      () => 'services:\n  mongodb:\n    image: mongo:7\n',
    );
    expect(hits).toEqual([]);
  });
});
