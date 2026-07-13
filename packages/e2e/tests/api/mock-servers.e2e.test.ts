import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MockServers } from '../../mocks/startMocks.js';
import { startAllMockServers, stopAllMockServers } from '../../mocks/startMocks.js';

describe('E2E · Express mock fixture servers', () => {
  let servers: MockServers;

  beforeAll(async () => {
    servers = await startAllMockServers({
      github: 19101,
      jira: 19102,
      llm: 19103,
    });
  });

  afterAll(async () => {
    await stopAllMockServers(servers);
  });

  it('serves GitHub OAuth token, user, and repo fixtures', async () => {
    const token = await fetch(`${servers.github.baseUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'x', client_id: 'y' }),
    });
    expect(token.status).toBe(200);
    const tokenBody = (await token.json()) as { access_token: string };
    expect(tokenBody.access_token).toContain('gho_');

    const user = await fetch(`${servers.github.baseUrl}/user`);
    expect(user.status).toBe(200);
    const userBody = (await user.json()) as { login: string };
    expect(userBody.login).toBe('e2e-alex');

    const repos = await fetch(`${servers.github.baseUrl}/user/repos`);
    expect(repos.status).toBe(200);
    const repoBody = (await repos.json()) as unknown[];
    expect(repoBody.length).toBeGreaterThan(0);
  });

  it('serves Jira issue and Atlassian identity fixtures', async () => {
    const me = await fetch(`${servers.jira.baseUrl}/me`);
    expect(me.status).toBe(200);

    const issue = await fetch(`${servers.jira.baseUrl}/rest/api/3/issue/OPL-1234`);
    expect(issue.status).toBe(200);
    const issueBody = (await issue.json()) as { key: string };
    expect(issueBody.key).toBe('OPL-1234');

    const missing = await fetch(`${servers.jira.baseUrl}/rest/api/3/issue/NOPE-1`);
    expect(missing.status).toBe(404);
  });

  it('serves LLM chat completion and embedding fixtures', async () => {
    const chat = await fetch(`${servers.llm.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'e2e-mock-llm',
        messages: [{ role: 'user', content: 'Recommend camelCase.' }],
      }),
    });
    expect(chat.status).toBe(200);
    const chatBody = (await chat.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    expect(chatBody.choices[0]?.message.content).toContain('camelCase');

    const embed = await fetch(`${servers.llm.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'hello', model: 'e2e-mock-embed' }),
    });
    expect(embed.status).toBe(200);
  });
});
