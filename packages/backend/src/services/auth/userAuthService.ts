import { encryptOAuthToken } from '../../auth/sessionService.js';
import {
  findUserByEmail,
  getUserModel,
  type AuthProvider,
  type ProviderTokens,
  type UserRecord,
} from '../../models/userModel.js';

export interface OAuthProfile {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  tokenExpiresAt?: Date;
}

function toStoredTokens(profile: OAuthProfile): ProviderTokens {
  return {
    providerUserId: profile.providerUserId,
    accountEmail: profile.email,
    encryptedAccessToken: encryptOAuthToken(profile.accessToken),
    encryptedRefreshToken: profile.refreshToken
      ? encryptOAuthToken(profile.refreshToken)
      : undefined,
    tokenExpiresAt: profile.tokenExpiresAt,
    scopes: profile.scopes,
  };
}

export async function upsertUserFromOAuth(profile: OAuthProfile): Promise<UserRecord> {
  const existing = await findUserByEmail(profile.email);
  const tokens = toStoredTokens(profile);

  if (existing) {
    const connectedProviders = existing.connectedProviders.includes(profile.provider)
      ? existing.connectedProviders
      : [...existing.connectedProviders, profile.provider];

    // Merge provider into the existing document by email — never create a duplicate.
    // Atlassian (Jira) tokens on other provider fields are left untouched by this patch.
    const update: Record<string, unknown> = {
      displayName: profile.displayName,
      connectedProviders,
      [profile.provider]: tokens,
      updatedBy: profile.email,
    };

    if (profile.provider === 'github' && existing.requiresGitHubReauth) {
      update.requiresGitHubReauth = false;
    }

    const updated = await getUserModel()
      .findByIdAndUpdate(existing._id, update, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    if (!updated) {
      throw new Error('Failed to update user during OAuth upsert');
    }

    return updated;
  }

  return getUserModel().create({
    email: profile.email,
    displayName: profile.displayName,
    role: 'user',
    connectedProviders: [profile.provider],
    [profile.provider]: tokens,
    createdBy: profile.email,
    updatedBy: profile.email,
    dataClassification: 'confidential',
  });
}

export async function linkProviderToUser(
  userId: string,
  profile: OAuthProfile,
): Promise<UserRecord | null> {
  const user = await getUserModel().findById(userId).exec();

  if (!user) {
    return null;
  }

  const connectedProviders = user.connectedProviders.includes(profile.provider)
    ? user.connectedProviders
    : [...user.connectedProviders, profile.provider];

  const update: Record<string, unknown> = {
    connectedProviders,
    [profile.provider]: toStoredTokens(profile),
    updatedBy: profile.email,
  };

  if (profile.provider === 'github' && user.requiresGitHubReauth) {
    update.requiresGitHubReauth = false;
  }

  return getUserModel()
    .findByIdAndUpdate(userId, update, { returnDocument: 'after', runValidators: true })
    .exec();
}
