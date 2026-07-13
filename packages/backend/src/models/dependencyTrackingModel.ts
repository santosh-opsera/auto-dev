import type {
  DependencyField,
  DependencyUpdateProposalStatus,
} from '@autodev/shared-types';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface DependencyEdgeDocument extends AuditFields {
  userId: string;
  packageName: string;
  owner: string;
  repo: string;
  packagePath: string;
  dependencyField: DependencyField;
  currentVersion: string;
}

export type DependencyEdgeRecord = HydratedDocument<DependencyEdgeDocument>;

const dependencyEdgeSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  packageName: { type: String, required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  packagePath: { type: String, required: true },
  dependencyField: {
    type: String,
    enum: ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'],
    required: true,
  },
  currentVersion: { type: String, required: true },
});

dependencyEdgeSchema.index(
  { userId: 1, packageName: 1, owner: 1, repo: 1, packagePath: 1, dependencyField: 1 },
  { unique: true },
);
dependencyEdgeSchema.index({ userId: 1, owner: 1, repo: 1 });

export function getDependencyEdgeModel(): Model<DependencyEdgeDocument> {
  return (
    (mongoose.models.DependencyEdge as Model<DependencyEdgeDocument> | undefined) ??
    mongoose.model<DependencyEdgeDocument>('DependencyEdge', dependencyEdgeSchema)
  );
}

export interface DependencyUpdateProposalDocument extends AuditFields {
  userId: string;
  packageName: string;
  currentVersion: string;
  proposedVersion: string;
  changelogLink: string;
  owner: string;
  repo: string;
  packagePath: string;
  dependencyField: DependencyField;
  status: DependencyUpdateProposalStatus;
  sourceOwner?: string;
  sourceRepo?: string;
}

export type DependencyUpdateProposalRecord = HydratedDocument<DependencyUpdateProposalDocument>;

const dependencyUpdateProposalSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  packageName: { type: String, required: true, index: true },
  currentVersion: { type: String, required: true },
  proposedVersion: { type: String, required: true },
  changelogLink: { type: String, required: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  packagePath: { type: String, required: true },
  dependencyField: {
    type: String,
    enum: ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'],
    required: true,
  },
  status: {
    type: String,
    enum: ['proposed', 'accepted', 'dismissed'],
    required: true,
    index: true,
  },
  sourceOwner: { type: String, required: false },
  sourceRepo: { type: String, required: false },
});

dependencyUpdateProposalSchema.index({ userId: 1, owner: 1, repo: 1, status: 1 });
dependencyUpdateProposalSchema.index({
  userId: 1,
  packageName: 1,
  owner: 1,
  repo: 1,
  packagePath: 1,
  dependencyField: 1,
  proposedVersion: 1,
});

export function getDependencyUpdateProposalModel(): Model<DependencyUpdateProposalDocument> {
  return (
    (mongoose.models.DependencyUpdateProposal as
      | Model<DependencyUpdateProposalDocument>
      | undefined) ??
    mongoose.model<DependencyUpdateProposalDocument>(
      'DependencyUpdateProposal',
      dependencyUpdateProposalSchema,
    )
  );
}
