import type { DeploymentError, DeploymentStatus } from '@autodev/shared-types';
import { DEPLOYMENT_STATUSES } from '@autodev/shared-types';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface DeploymentDocument extends AuditFields {
  userId: string;
  workflowId: string;
  branch: string;
  status: DeploymentStatus;
  baseUrl: string;
  composeFile: string;
  projectName: string;
  projectDir: string;
  healthCheckPath: string;
  confirmationTokenHash: string;
  confirmed: true;
  logs?: string;
  error?: DeploymentError;
  startedAt?: Date;
  completedAt?: Date;
  stoppedAt?: Date;
}

export type DeploymentRecord = HydratedDocument<DeploymentDocument>;

const deploymentErrorSubSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    code: { type: String, required: false },
    phase: { type: String, enum: [...DEPLOYMENT_STATUSES], required: false },
  },
  { _id: false },
);

const deploymentSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true, index: true },
  branch: { type: String, required: true },
  status: {
    type: String,
    enum: [...DEPLOYMENT_STATUSES],
    required: true,
    index: true,
  },
  baseUrl: { type: String, required: true },
  composeFile: { type: String, required: true },
  projectName: { type: String, required: true },
  projectDir: { type: String, required: true },
  healthCheckPath: { type: String, required: true },
  confirmationTokenHash: { type: String, required: true },
  confirmed: { type: Boolean, required: true },
  logs: { type: String, required: false },
  error: { type: deploymentErrorSubSchema, required: false },
  startedAt: { type: Date, required: false },
  completedAt: { type: Date, required: false },
  stoppedAt: { type: Date, required: false },
});

deploymentSchema.index({ userId: 1, createdAt: -1 });
deploymentSchema.index({ userId: 1, workflowId: 1, createdAt: -1 });

export function getDeploymentModel(): Model<DeploymentDocument> {
  return (
    (mongoose.models.Deployment as Model<DeploymentDocument> | undefined) ??
    mongoose.model<DeploymentDocument>('Deployment', deploymentSchema)
  );
}
