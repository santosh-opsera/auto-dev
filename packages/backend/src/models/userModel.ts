import mongoose, { type HydratedDocument, type Model, type Types } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export type AuthProvider = 'github' | 'atlassian';

export interface ProviderTokens {
  providerUserId: string;
  /** Provider account email captured at OAuth link time (Atlassian/GitHub). */
  accountEmail?: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
}

export interface UserDocument extends AuditFields {
  _id: Types.ObjectId;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  connectedProviders: AuthProvider[];
  github?: ProviderTokens;
  atlassian?: ProviderTokens;
  /**
   * Set by the Atlassian→GitHub migration for Atlassian-only users.
   * Cleared when the user successfully links GitHub via OAuth (email match).
   */
  requiresGitHubReauth?: boolean;
}

export type UserRecord = HydratedDocument<UserDocument>;

const userSchema = createBaseSchema({
  email: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  connectedProviders: {
    type: [String],
    enum: ['github', 'atlassian'],
    default: [],
  },
  github: {
    type: {
      providerUserId: String,
      accountEmail: String,
      encryptedAccessToken: String,
      encryptedRefreshToken: String,
      tokenExpiresAt: Date,
      scopes: [String],
    },
    required: false,
  },
  atlassian: {
    type: {
      providerUserId: String,
      accountEmail: String,
      encryptedAccessToken: String,
      encryptedRefreshToken: String,
      tokenExpiresAt: Date,
      scopes: [String],
    },
    required: false,
  },
  requiresGitHubReauth: { type: Boolean, required: false, default: false },
});

userSchema.index({ email: 1 }, { unique: true });

export function getUserModel(): Model<UserDocument> {
  if (mongoose.models.User) {
    return mongoose.models.User as Model<UserDocument>;
  }

  return mongoose.model<UserDocument>('User', userSchema);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return getUserModel().findOne({ email }).exec();
}

export async function findUserById(userId: string): Promise<UserRecord | null> {
  return getUserModel().findById(userId).exec();
}
