import { describe, expect, it } from 'vitest';
import { INFRASTRUCTURE_PACKAGE } from './infrastructurePackage.js';

describe('infrastructure package reference (WO-028)', () => {
  it('resolves @autodev/infrastructure from backend', () => {
    expect(INFRASTRUCTURE_PACKAGE).toBe('@autodev/infrastructure');
  });
});
