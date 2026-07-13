import type { Server } from 'node:http';
import { startGitHubMock } from './githubServer.js';
import { startJiraMock } from './jiraServer.js';
import { startLlmMock } from './llmServer.js';
import { MOCK_PORTS } from './ports.js';

export interface MockServers {
  github: { server: Server; baseUrl: string; port: number };
  jira: { server: Server; baseUrl: string; port: number };
  llm: { server: Server; baseUrl: string; port: number };
}

export async function startAllMockServers(ports = MOCK_PORTS): Promise<MockServers> {
  const [github, jira, llm] = await Promise.all([
    startGitHubMock(ports.github),
    startJiraMock(ports.jira),
    startLlmMock(ports.llm),
  ]);
  return { github, jira, llm };
}

export async function stopAllMockServers(servers: MockServers): Promise<void> {
  await Promise.all(
    [servers.github.server, servers.jira.server, servers.llm.server].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
}

/** CLI entry: `npm run mocks -w @autodev/e2e` */
async function main(): Promise<void> {
  const servers = await startAllMockServers();
  console.log(
    JSON.stringify(
      {
        mode: 'mock',
        github: servers.github.baseUrl,
        jira: servers.jira.baseUrl,
        llm: servers.llm.baseUrl,
      },
      null,
      2,
    ),
  );
  console.log('Mock GitHub / Jira / LLM fixture servers are listening. Press Ctrl+C to stop.');
}

const isDirectRun =
  process.argv[1]?.includes('startMocks') || process.argv[1]?.endsWith('startMocks.ts');

if (isDirectRun) {
  void main();
}
