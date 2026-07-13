import { describe, expect, it } from 'vitest';
import {
  cursorContextDocumentSchema,
  cursorExecuteRequestSchema,
  cursorImplementationResultSchema,
  cursorResultsSubmitRequestSchema,
} from './cursorBridge.js';
import {
  sampleCursorContextDocument,
  sampleCursorImplementationResult,
} from './fixtures/cursorBridge.js';

describe('cursorBridge schemas', () => {
  it('validates packaged context documents', () => {
    expect(cursorContextDocumentSchema.safeParse(sampleCursorContextDocument).success).toBe(true);
    expect(
      cursorContextDocumentSchema.safeParse({
        ...sampleCursorContextDocument,
        schemaVersion: '2',
      }).success,
    ).toBe(false);
  });

  it('validates implementation results and execute requests', () => {
    expect(
      cursorImplementationResultSchema.safeParse(sampleCursorImplementationResult).success,
    ).toBe(true);
    expect(cursorExecuteRequestSchema.safeParse({}).success).toBe(true);
    expect(cursorExecuteRequestSchema.safeParse({ dryRun: true }).success).toBe(true);
    expect(
      cursorResultsSubmitRequestSchema.safeParse({
        chunkId: sampleCursorImplementationResult.chunkId,
        workflowId: sampleCursorImplementationResult.workflowId,
        fileChanges: sampleCursorImplementationResult.fileChanges,
        newFiles: [],
        deletedFiles: [],
      }).success,
    ).toBe(true);
  });

  it('includes guidance fields required by WO-027 AC', () => {
    const guidance = sampleCursorContextDocument.guidance;
    expect(guidance.filesToModify.length).toBeGreaterThan(0);
    expect(guidance.namingConventions.length).toBeGreaterThan(0);
    expect(guidance.designPatterns.length).toBeGreaterThan(0);
    expect(guidance.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(guidance.commitMessageFormat).toBe(
      sampleCursorContextDocument.conventions.commitMessageFormat,
    );
    expect(guidance.branchNamingPattern).toBe(
      sampleCursorContextDocument.conventions.branchNamingPattern,
    );
  });
});
