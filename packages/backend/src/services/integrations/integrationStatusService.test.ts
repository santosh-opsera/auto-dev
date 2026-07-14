import { afterEach, describe, expect, it } from 'vitest';
import type { UserDocument } from '../../models/userModel.js';
import {
  mockUserWithExpiredJiraToken,
  mockUserWithJiraConnection,
  mockUserWithoutJiraConnection,
} from '../../fixtures/jira.js';
import { adapterRegistry } from './adapterRegistry.js';
import { getIntegrationsStatus } from './integrationStatusService.js';
import { registerDefaultAdapters } from './registerDefaultAdapters.js';

describe('getIntegrationsStatus', () => {
  afterEach(() => {
    adapterRegistry.reset();
  });

  it('reports GitHub disconnected when access token is missing', () => {
    registerDefaultAdapters();
    const user = {
      email: 'alex.dev@example.com',
      displayName: 'Alex',
      role: 'user',
      connectedProviders: ['github'],
      github: undefined,
      atlassian: mockUserWithJiraConnection.atlassian,
    } as unknown as UserDocument;

    const status = getIntegrationsStatus(user);

    expect(status.github).toMatchObject({
      connected: false,
      tokenValid: false,
      connectionState: 'disconnected',
      message: 'GitHub not connected',
    });
    expect(status.jira.connectionState).toBe('connected');
    expect(status.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reports Jira expired when access token is past expiry', () => {
    registerDefaultAdapters();
    const user = {
      ...mockUserWithExpiredJiraToken,
      github: {
        providerUserId: '12345',
        encryptedAccessToken: 'enc-gh',
        scopes: ['read:user', 'user:email', 'repo'],
        tokenExpiresAt: new Date(Date.now() + 86_400_000),
      },
    } as unknown as UserDocument;

    const status = getIntegrationsStatus(user);

    expect(status.jira).toMatchObject({
      connected: true,
      tokenValid: false,
      connectionState: 'expired',
      message: 'Jira connection expired — Reconnect',
    });
    expect(status.github.connectionState).toBe('connected');
  });

  it('reports both healthy when GitHub repos and Jira are valid', () => {
    registerDefaultAdapters();
    const user = {
      ...mockUserWithoutJiraConnection,
      atlassian: {
        ...mockUserWithJiraConnection.atlassian,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      connectedProviders: ['github', 'atlassian'],
    } as unknown as UserDocument;

    const status = getIntegrationsStatus(user);

    expect(status.github).toMatchObject({
      connected: true,
      tokenValid: true,
      connectionState: 'connected',
    });
    expect(status.jira).toMatchObject({
      connected: true,
      tokenValid: true,
      connectionState: 'connected',
    });
  });
});
