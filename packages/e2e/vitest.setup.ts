import { vi } from 'vitest';

vi.mock('../backend/src/services/auth/githubAuthService.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../backend/src/services/auth/githubAuthService.js')
  >();
  return {
    ...actual,
    exchangeGitHubCode: vi.fn(),
  };
});

vi.mock('../backend/src/services/jira/ticketService.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../backend/src/services/jira/ticketService.js')
  >();
  return {
    ...actual,
    ticketService: {
      getTicket: vi.fn(),
    },
  };
});
