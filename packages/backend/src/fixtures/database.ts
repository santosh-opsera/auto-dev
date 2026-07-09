import type { Model } from 'mongoose';
import type { DataClassification } from '../database/baseSchema.js';

export interface SampleUserDocument {
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  dataClassification: DataClassification;
}

export const sampleUserDocuments: SampleUserDocument[] = [
  {
    email: 'alex.dev@example.com',
    displayName: 'Alex Developer',
    role: 'user',
    dataClassification: 'internal',
  },
  {
    email: 'dana.lead@example.com',
    displayName: 'Dana Team Lead',
    role: 'admin',
    dataClassification: 'confidential',
  },
];

export const sampleErrorContext = {
  actor: 'seed@autodev.local',
  resource: 'users',
  operation: 'seed',
};

export async function seedDocuments<T>(
  model: Model<T>,
  documents: Partial<T>[],
  actorId = 'seed@autodev.local',
): Promise<void> {
  await model.insertMany(
    documents.map((document) => ({
      ...document,
      createdBy: actorId,
      updatedBy: actorId,
    })),
  );
}
