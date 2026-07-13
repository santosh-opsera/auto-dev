import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type {
  ChunkComplexity,
  ChunkScope,
  ChunkStatus,
} from '@autodev/shared-types';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface ImplementationChunkDocument extends AuditFields {
  userId: string;
  workflowDocumentId: string;
  workflowId: string;
  prdId: string;
  order: number;
  name: string;
  description: string;
  scope: ChunkScope;
  dependencies: string[];
  estimatedComplexity: ChunkComplexity;
  status: ChunkStatus;
}

export type ImplementationChunkRecord = HydratedDocument<ImplementationChunkDocument>;

const chunkScopeSubSchema = new mongoose.Schema(
  {
    files: { type: [String], required: true, default: [] },
    modules: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const implementationChunkSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  workflowDocumentId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true, index: true },
  prdId: { type: String, required: true, index: true },
  order: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  scope: { type: chunkScopeSubSchema, required: true },
  dependencies: { type: [String], required: true, default: [] },
  estimatedComplexity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PAUSED', 'SKIPPED'],
    required: true,
    default: 'PENDING',
  },
});

implementationChunkSchema.index({ userId: 1, workflowDocumentId: 1, order: 1 });
implementationChunkSchema.index({ userId: 1, workflowId: 1, order: 1 });

export function getImplementationChunkModel(): Model<ImplementationChunkDocument> {
  if (mongoose.models.ImplementationChunkDocument) {
    return mongoose.models.ImplementationChunkDocument as Model<ImplementationChunkDocument>;
  }

  return mongoose.model<ImplementationChunkDocument>(
    'ImplementationChunkDocument',
    implementationChunkSchema,
    'implementation_chunks',
  );
}
