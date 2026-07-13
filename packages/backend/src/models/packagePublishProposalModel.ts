import type {
  AllowListValidation,
  PackageProposalStatus,
  SemverBumpType,
  VulnerabilityScanResult,
} from '@autodev/shared-types';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface PackagePublishProposalDocument extends AuditFields {
  userId: string;
  owner: string;
  repo: string;
  packagePath: string;
  packageName: string;
  currentVersion: string;
  proposedVersion: string;
  bump: SemverBumpType;
  changelog: string;
  vulnerabilityScan: VulnerabilityScanResult;
  allowList: AllowListValidation;
  affectedFiles: string[];
  status: PackageProposalStatus;
  confirmationTokenHash: string;
  confirmedAt?: Date;
  publishedAt?: Date;
  publishSimulation?: {
    registry: string;
    tarballName: string;
    simulated: true;
  };
}

export type PackagePublishProposalRecord = HydratedDocument<PackagePublishProposalDocument>;

const vulnerabilityFindingSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    severity: {
      type: String,
      enum: ['critical', 'high', 'moderate', 'low', 'info'],
      required: true,
    },
    packageName: { type: String, required: true },
    path: { type: String, required: false },
  },
  { _id: false },
);

const vulnerabilityScanSubSchema = new mongoose.Schema(
  {
    findings: { type: [vulnerabilityFindingSubSchema], required: true, default: [] },
    severityThreshold: {
      type: String,
      enum: ['critical', 'high', 'moderate', 'low', 'info'],
      required: true,
    },
    blocked: { type: Boolean, required: true },
    blockingSeverities: {
      type: [
        {
          type: String,
          enum: ['critical', 'high', 'moderate', 'low', 'info'],
        },
      ],
      required: true,
      default: [],
    },
    summary: { type: String, required: true },
  },
  { _id: false },
);

const allowListSubSchema = new mongoose.Schema(
  {
    allowedPatterns: { type: [String], required: true, default: [] },
    includedFiles: { type: [String], required: true, default: [] },
    excludedFiles: { type: [String], required: true, default: [] },
    source: { type: String, enum: ['files', 'npmignore', 'default'], required: true },
  },
  { _id: false },
);

const publishSimulationSubSchema = new mongoose.Schema(
  {
    registry: { type: String, required: true },
    tarballName: { type: String, required: true },
    simulated: { type: Boolean, required: true },
  },
  { _id: false },
);

const packagePublishProposalSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  packagePath: { type: String, required: true },
  packageName: { type: String, required: true },
  currentVersion: { type: String, required: true },
  proposedVersion: { type: String, required: true },
  bump: { type: String, enum: ['major', 'minor', 'patch'], required: true },
  changelog: { type: String, required: true },
  vulnerabilityScan: { type: vulnerabilityScanSubSchema, required: true },
  allowList: { type: allowListSubSchema, required: true },
  affectedFiles: { type: [String], required: true, default: [] },
  status: {
    type: String,
    enum: ['proposed', 'blocked', 'confirmed', 'published'],
    required: true,
    index: true,
  },
  confirmationTokenHash: { type: String, required: true },
  confirmedAt: { type: Date, required: false },
  publishedAt: { type: Date, required: false },
  publishSimulation: { type: publishSimulationSubSchema, required: false },
});

packagePublishProposalSchema.index({ userId: 1, createdAt: -1 });

export function getPackagePublishProposalModel(): Model<PackagePublishProposalDocument> {
  return (
    (mongoose.models.PackagePublishProposal as Model<PackagePublishProposalDocument> | undefined) ??
    mongoose.model<PackagePublishProposalDocument>(
      'PackagePublishProposal',
      packagePublishProposalSchema,
    )
  );
}
