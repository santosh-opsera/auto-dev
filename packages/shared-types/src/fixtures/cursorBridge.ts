import type {
  CursorContextDocument,
  CursorImplementationResult,
} from '../cursorBridge.js';
import { sampleExpectedSmallContext, sampleFileStructureMap } from './codebaseContext.js';
import { sampleImplementationChunks } from './chunk.js';
import { sampleApprovedPrd } from './prd.js';
import { sampleTicketIntent } from './ticketIntent.js';

const sampleChunk = sampleImplementationChunks[0]!;

/** Sample convention snapshot — patterns come from user config, never hardcoded defaults in validators. */
export const sampleCursorConventions = {
  commitMessageFormat: '{ticketKey}: {description}',
  branchNamingPattern: '^(feature|bugfix)/OPL-\\d+$',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate: 'Context\n{context}\n\nChanges\n{changes}',
  reviewerAssignmentRules: {
    mode: 'manual-list' as const,
    reviewers: ['octocat'],
  },
};

export const sampleCursorContextDocument: CursorContextDocument = {
  schemaVersion: '1',
  workflowDocumentId: 'workflow-doc-001',
  workflowId: 'workflow-001',
  chunkId: sampleChunk.id,
  ticketIntent: sampleTicketIntent,
  codebaseContext: {
    owner: 'santosh-opsera',
    repo: 'auto-dev',
    branch: 'main',
    totalLocEstimate: 1200,
    strategy: sampleExpectedSmallContext.strategy,
    fileStructureMap: sampleFileStructureMap,
    namingConventions: [
      {
        category: 'file',
        pattern: 'camelCase.ts',
        examples: ['userService.ts'],
        confidence: 0.9,
      },
    ],
    designPatterns: sampleExpectedSmallContext.designPatterns,
    dependencyGraph: [
      { from: 'src/services/userService.ts', to: 'src/repositories/userRepository.ts', type: 'import' },
    ],
    architecturalLayers: sampleExpectedSmallContext.architecturalLayers,
    analyzedAt: '2026-07-13T12:00:00.000Z',
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
  chunk: {
    id: sampleChunk.id,
    name: sampleChunk.name,
    description: sampleChunk.description,
    scope: sampleChunk.scope,
    estimatedComplexity: sampleChunk.estimatedComplexity,
    dependencies: sampleChunk.dependencies,
    order: sampleChunk.order,
  },
  conventions: sampleCursorConventions,
  guidance: {
    filesToModify: [...sampleChunk.scope.files],
    namingConventions: [
      {
        category: 'file',
        pattern: 'camelCase.ts',
        examples: ['userService.ts'],
        confidence: 0.9,
      },
    ],
    designPatterns: sampleExpectedSmallContext.designPatterns,
    acceptanceCriteria: [
      ...sampleTicketIntent.acceptanceCriteria,
      ...sampleApprovedPrd.sections.acceptanceCriteria,
    ],
    commitMessageFormat: sampleCursorConventions.commitMessageFormat,
    branchNamingPattern: sampleCursorConventions.branchNamingPattern,
  },
  packagedAt: '2026-07-13T15:00:00.000Z',
};

export const sampleCursorImplementationResult: CursorImplementationResult = {
  chunkId: sampleChunk.id,
  workflowId: 'workflow-001',
  branchName: 'feature/OPL-1234',
  commitMessage: 'OPL-1234: Add ImplementationChunk shared types and model',
  fileChanges: sampleChunk.scope.files.map((path) => ({
    path,
    action: 'modified' as const,
    content: '// updated\n',
  })),
  newFiles: [],
  deletedFiles: [],
  summary: 'Implemented chunk scope files with convention-compliant branch and commit.',
  receivedAt: '2026-07-13T15:05:00.000Z',
};

export const sampleCursorImplementationResultOutOfScope: CursorImplementationResult = {
  ...sampleCursorImplementationResult,
  fileChanges: [
    ...sampleCursorImplementationResult.fileChanges,
    {
      path: 'packages/frontend/src/App.tsx',
      action: 'modified',
      content: '// unexpected\n',
    },
  ],
};

export const sampleCursorImplementationResultBadConventions: CursorImplementationResult = {
  ...sampleCursorImplementationResult,
  branchName: 'my-branch',
  commitMessage: 'fixed stuff',
};
