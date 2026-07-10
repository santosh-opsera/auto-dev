export const mockGitHubTokenResponse = {
  access_token: 'gho_mock_access_token',
  refresh_token: 'gho_mock_refresh_token',
  expires_in: 3600,
  scope: 'read:user,user:email',
  token_type: 'bearer',
};

export const mockGitHubUserResponse = {
  id: 12345,
  login: 'alex-dev',
  name: 'Alex Developer',
  email: 'alex.dev@example.com',
};

export const mockAtlassianTokenResponse = {
  access_token: 'atlassian_mock_access_token',
  refresh_token: 'atlassian_mock_refresh_token',
  expires_in: 3600,
  scope: 'read:me offline_access',
  token_type: 'Bearer',
};

export const mockAtlassianUserResponse = {
  account_id: 'atlassian-account-001',
  email: 'alex.dev@example.com',
  name: 'Alex Developer',
};

export const mockLinkedUserFixture = {
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github', 'atlassian'] as const,
};
