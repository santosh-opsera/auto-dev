import express, { type Express } from 'express';
import type { Server } from 'node:http';
import {
  mockAtlassianTokenResponse,
  mockAtlassianUserResponse,
  mockJiraAccessibleResources,
  mockJiraIssues,
} from '../fixtures/jira.js';
import { MOCK_PORTS, mockBaseUrl } from './ports.js';

export function createJiraMockApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'jira-mock' });
  });

  app.post('/oauth/token', (_req, res) => {
    res.json(mockAtlassianTokenResponse);
  });

  app.get('/me', (_req, res) => {
    res.json(mockAtlassianUserResponse);
  });

  app.get('/oauth/token/accessible-resources', (_req, res) => {
    res.json(mockJiraAccessibleResources);
  });

  app.get('/ex/jira/:cloudId/rest/api/3/issue/:issueKey', (req, res) => {
    const issue = mockJiraIssues[req.params.issueKey];
    if (!issue) {
      res.status(404).json({ errorMessages: [`Issue does not exist: ${req.params.issueKey}`] });
      return;
    }
    res.json(issue);
  });

  app.get('/rest/api/3/issue/:issueKey', (req, res) => {
    const issue = mockJiraIssues[req.params.issueKey];
    if (!issue) {
      res.status(404).json({ errorMessages: [`Issue does not exist: ${req.params.issueKey}`] });
      return;
    }
    res.json(issue);
  });

  app.get('/rest/api/3/search', (req, res) => {
    const jql = String(req.query.jql ?? '');
    const keys = Object.keys(mockJiraIssues).filter((key) => jql.includes(key));
    const issues = keys.map((key) => mockJiraIssues[key]);
    res.json({ startAt: 0, maxResults: 50, total: issues.length, issues });
  });

  return app;
}

export async function startJiraMock(
  port = MOCK_PORTS.jira,
): Promise<{ server: Server; baseUrl: string; port: number }> {
  const app = createJiraMockApp();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(port, '127.0.0.1', () => resolve(listening));
  });
  return { server, baseUrl: mockBaseUrl(port), port };
}
