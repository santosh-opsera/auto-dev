import { describe, expect, it } from 'vitest';
import {
  sampleApprovedPrd,
  sampleAutoDevLikeContext,
  sampleCursorConventions,
  sampleImplementationChunks,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { packageCursorContext } from './contextPackager.js';

describe('packageCursorContext', () => {
  it('packages TicketIntent, CodebaseContext, PRD, chunk, and conventions into JSON context', () => {
    const chunk = sampleImplementationChunks[0]!;
    const context = packageCursorContext({
      workflowDocumentId: 'workflow-doc-001',
      workflowId: 'workflow-001',
      ticketIntent: sampleTicketIntent,
      codebaseContext: {
        ...sampleAutoDevLikeContext,
        analyzedAt: sampleAutoDevLikeContext.analyzedAt,
      },
      approvedPrd: {
        id: sampleApprovedPrd.id,
        ticketKey: sampleApprovedPrd.ticketKey,
        version: sampleApprovedPrd.version,
        status: 'approved',
        sections: sampleApprovedPrd.sections,
        approvedBy: sampleApprovedPrd.approvedBy,
        approvedAt: sampleApprovedPrd.approvedAt,
      },
      chunk,
      conventions: sampleCursorConventions,
      packagedAt: '2026-07-13T15:00:00.000Z',
    });

    expect(context.schemaVersion).toBe('1');
    expect(context.ticketIntent.ticketKey).toBe(sampleTicketIntent.ticketKey);
    expect(context.codebaseContext.designPatterns.length).toBeGreaterThan(0);
    expect(context.approvedPrd.status).toBe('approved');
    expect(context.chunk.scope.files).toEqual(chunk.scope.files);
    expect(context.guidance.filesToModify).toEqual(chunk.scope.files);
    expect(context.guidance.namingConventions).toEqual(
      sampleAutoDevLikeContext.namingConventions,
    );
    expect(context.guidance.designPatterns).toEqual(sampleAutoDevLikeContext.designPatterns);
    expect(context.guidance.acceptanceCriteria).toEqual(
      expect.arrayContaining(sampleTicketIntent.acceptanceCriteria),
    );
    expect(context.guidance.commitMessageFormat).toBe(
      sampleCursorConventions.commitMessageFormat,
    );
    expect(context.guidance.branchNamingPattern).toBe(
      sampleCursorConventions.branchNamingPattern,
    );
    expect(context.conventions).toEqual(sampleCursorConventions);
  });
});
