export const mockAuthUser = {
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github', 'atlassian'] as Array<'github' | 'atlassian'>,
};

export const mockSessionMetadata = {
  remainingMs: 86_400_000,
  warning: false,
  expiresAt: '2026-07-10T12:00:00.000Z',
};

export const mockWarningSessionMetadata = {
  remainingMs: 240_000,
  warning: true,
  expiresAt: '2026-07-09T12:04:00.000Z',
};

export const mockMeResponse = {
  user: mockAuthUser,
  session: mockSessionMetadata,
};

export const mockHeartbeatResponse = {
  session: mockSessionMetadata,
};

export const mockWarningHeartbeatResponse = {
  session: mockWarningSessionMetadata,
  warning: 'Your session will expire in less than 5 minutes.',
};
