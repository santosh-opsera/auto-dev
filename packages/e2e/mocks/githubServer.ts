import express, { type Express } from 'express';
import type { Server } from 'node:http';
import {
  mockGitHubFileContent,
  mockGitHubRepos,
  mockGitHubTokenResponse,
  mockGitHubTree,
  mockGitHubUserResponse,
} from '../fixtures/github.js';
import { MOCK_PORTS, mockBaseUrl } from './ports.js';

export function createGitHubMockApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'github-mock' });
  });

  app.post('/login/oauth/access_token', (_req, res) => {
    res.json(mockGitHubTokenResponse);
  });

  app.get('/user', (_req, res) => {
    res.json(mockGitHubUserResponse);
  });

  app.get('/user/repos', (_req, res) => {
    res.json(mockGitHubRepos);
  });

  app.get('/repos/:owner/:repo', (req, res) => {
    const fullName = `${req.params.owner}/${req.params.repo}`;
    const repo = mockGitHubRepos.find((entry) => entry.full_name === fullName);
    if (!repo) {
      res.status(404).json({ message: 'Not Found' });
      return;
    }
    res.json(repo);
  });

  app.get('/repos/:owner/:repo/git/trees/:ref', (_req, res) => {
    res.json(mockGitHubTree);
  });

  app.get('/repos/:owner/:repo/contents/*path', (_req, res) => {
    res.json(mockGitHubFileContent);
  });

  app.get('/rate_limit', (_req, res) => {
    res.json({
      resources: {
        core: { limit: 5000, remaining: 4999, reset: Math.floor(Date.now() / 1000) + 3600 },
      },
    });
  });

  return app;
}

export async function startGitHubMock(
  port = MOCK_PORTS.github,
): Promise<{ server: Server; baseUrl: string; port: number }> {
  const app = createGitHubMockApp();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(port, '127.0.0.1', () => resolve(listening));
  });
  return { server, baseUrl: mockBaseUrl(port), port };
}
