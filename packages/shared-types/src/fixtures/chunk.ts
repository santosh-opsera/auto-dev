import type {
  ChunkDecompositionDraft,
  ImplementationChunkResponse,
} from '../chunk.js';
import { sampleApprovedPrd } from './prd.js';

export const sampleChunkDecompositionDraft: ChunkDecompositionDraft = {
  chunks: [
    {
      tempId: 'c1',
      name: 'Data model and shared types',
      description:
        'Add ImplementationChunk shared types, MongoDB model, and fixtures for chunk persistence.',
      scope: {
        files: [
          'packages/shared-types/src/chunk.ts',
          'packages/backend/src/models/implementationChunkModel.ts',
        ],
        modules: ['shared-types', 'backend/models'],
      },
      dependsOn: [],
      estimatedComplexity: 'low',
    },
    {
      tempId: 'c2',
      name: 'Chunk Manager service',
      description:
        'Implement LLM-powered PRD decomposition with topological ordering and status transitions.',
      scope: {
        files: [
          'packages/backend/src/services/implementation/chunkManager.ts',
          'packages/backend/src/services/implementation/chunkOrdering.ts',
        ],
        modules: ['backend/services/implementation'],
      },
      dependsOn: ['c1'],
      estimatedComplexity: 'high',
    },
    {
      tempId: 'c3',
      name: 'Chunk API routes',
      description:
        'Expose decompose, list, and status-update endpoints under workflows/:id/chunks.',
      scope: {
        files: ['packages/backend/src/routes/chunkRoutes.ts'],
        modules: ['backend/routes'],
      },
      dependsOn: ['c2'],
      estimatedComplexity: 'medium',
    },
  ],
};

export const sampleChunkLlmJsonResponse = JSON.stringify(sampleChunkDecompositionDraft, null, 2);

export const sampleImplementationChunks: ImplementationChunkResponse[] = [
  {
    id: 'chunk-001',
    workflowDocumentId: 'workflow-doc-001',
    workflowId: 'workflow-001',
    prdId: sampleApprovedPrd.id,
    order: 0,
    name: sampleChunkDecompositionDraft.chunks[0]!.name,
    description: sampleChunkDecompositionDraft.chunks[0]!.description,
    scope: sampleChunkDecompositionDraft.chunks[0]!.scope,
    dependencies: [],
    estimatedComplexity: 'low',
    status: 'PENDING',
    createdAt: '2026-07-13T14:00:00.000Z',
    updatedAt: '2026-07-13T14:00:00.000Z',
  },
  {
    id: 'chunk-002',
    workflowDocumentId: 'workflow-doc-001',
    workflowId: 'workflow-001',
    prdId: sampleApprovedPrd.id,
    order: 1,
    name: sampleChunkDecompositionDraft.chunks[1]!.name,
    description: sampleChunkDecompositionDraft.chunks[1]!.description,
    scope: sampleChunkDecompositionDraft.chunks[1]!.scope,
    dependencies: ['chunk-001'],
    estimatedComplexity: 'high',
    status: 'PENDING',
    createdAt: '2026-07-13T14:00:00.000Z',
    updatedAt: '2026-07-13T14:00:00.000Z',
  },
  {
    id: 'chunk-003',
    workflowDocumentId: 'workflow-doc-001',
    workflowId: 'workflow-001',
    prdId: sampleApprovedPrd.id,
    order: 2,
    name: sampleChunkDecompositionDraft.chunks[2]!.name,
    description: sampleChunkDecompositionDraft.chunks[2]!.description,
    scope: sampleChunkDecompositionDraft.chunks[2]!.scope,
    dependencies: ['chunk-002'],
    estimatedComplexity: 'medium',
    status: 'PENDING',
    createdAt: '2026-07-13T14:00:00.000Z',
    updatedAt: '2026-07-13T14:00:00.000Z',
  },
];

export const sampleExpectedChunkDecomposition = {
  prdId: sampleApprovedPrd.id,
  chunks: sampleImplementationChunks,
};
