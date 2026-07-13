import type {
  CodebaseContext,
  CursorApprovedPrdSnapshot,
  CursorChunkSpec,
  CursorContextDocument,
  CursorConventionSnapshot,
  ImplementationChunkResponse,
  PrdResponse,
  TicketIntent,
} from '@autodev/shared-types';
import { CURSOR_CONTEXT_SCHEMA_VERSION } from '@autodev/shared-types';

export interface PackageCursorContextInput {
  workflowDocumentId: string;
  workflowId: string;
  ticketIntent: TicketIntent;
  codebaseContext: CodebaseContext;
  approvedPrd: Pick<
    PrdResponse,
    'id' | 'ticketKey' | 'version' | 'status' | 'sections' | 'approvedBy' | 'approvedAt'
  >;
  chunk: ImplementationChunkResponse | CursorChunkSpec;
  conventions: CursorConventionSnapshot;
  packagedAt?: string;
}

function toApprovedPrdSnapshot(
  prd: PackageCursorContextInput['approvedPrd'],
): CursorApprovedPrdSnapshot {
  if (prd.status !== 'approved') {
    throw new Error('Only approved PRDs can be packaged for Cursor delivery.');
  }

  return {
    id: prd.id,
    ticketKey: prd.ticketKey,
    version: prd.version,
    status: 'approved',
    sections: prd.sections,
    approvedBy: prd.approvedBy,
    approvedAt: prd.approvedAt,
  };
}

function toChunkSpec(chunk: ImplementationChunkResponse | CursorChunkSpec): CursorChunkSpec {
  return {
    id: chunk.id,
    name: chunk.name,
    description: chunk.description,
    scope: {
      files: [...chunk.scope.files],
      modules: [...chunk.scope.modules],
    },
    estimatedComplexity: chunk.estimatedComplexity,
    dependencies: [...chunk.dependencies],
    order: chunk.order,
  };
}

/**
 * Packages TicketIntent, CodebaseContext, approved PRD, chunk spec, and convention
 * settings into the structured JSON context document delivered to Cursor IDE.
 */
export function packageCursorContext(input: PackageCursorContextInput): CursorContextDocument {
  const chunk = toChunkSpec(input.chunk);
  const conventions: CursorConventionSnapshot = {
    commitMessageFormat: input.conventions.commitMessageFormat,
    branchNamingPattern: input.conventions.branchNamingPattern,
    prTitleTemplate: input.conventions.prTitleTemplate,
    prDescriptionTemplate: input.conventions.prDescriptionTemplate,
    reviewerAssignmentRules: input.conventions.reviewerAssignmentRules,
  };

  const acceptanceCriteria = [
    ...input.ticketIntent.acceptanceCriteria,
    ...input.approvedPrd.sections.acceptanceCriteria,
  ];

  return {
    schemaVersion: CURSOR_CONTEXT_SCHEMA_VERSION,
    workflowDocumentId: input.workflowDocumentId,
    workflowId: input.workflowId,
    chunkId: chunk.id,
    ticketIntent: input.ticketIntent,
    codebaseContext: input.codebaseContext,
    approvedPrd: toApprovedPrdSnapshot(input.approvedPrd),
    chunk,
    conventions,
    guidance: {
      filesToModify: [...chunk.scope.files],
      namingConventions: [...input.codebaseContext.namingConventions],
      designPatterns: [...input.codebaseContext.designPatterns],
      acceptanceCriteria,
      commitMessageFormat: conventions.commitMessageFormat,
      branchNamingPattern: conventions.branchNamingPattern,
    },
    packagedAt: input.packagedAt ?? new Date().toISOString(),
  };
}
