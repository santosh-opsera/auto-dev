import { describe, expect, it } from 'vitest';
import {
  buildComposeBuildCommand,
  buildComposeDownCommand,
  buildComposeLogsCommand,
  buildComposeUpCommand,
  sanitizeProjectName,
} from './composeCommands.js';
import { MockDockerClient } from './dockerClient.js';
import {
  MockHealthChecker,
  buildHealthCheckUrl,
  waitForHealthy,
} from './healthCheck.js';

describe('composeCommands', () => {
  it('sanitizes project names from workflow ids', () => {
    expect(sanitizeProjectName('workflow-001')).toBe('autodev-qa-workflow-001');
    expect(sanitizeProjectName('WF/Special Name!')).toBe('autodev-qa-wf-special-name');
  });

  it('constructs docker compose build/up/down/logs commands', () => {
    const input = {
      composeFile: 'docker-compose.qa.yml',
      projectName: 'autodev-qa-workflow-001',
      cwd: '/tmp/qa',
      branch: 'feature/qa-handoff',
      baseUrl: 'http://localhost:4000',
    };

    expect(buildComposeBuildCommand(input)).toEqual({
      command: 'docker',
      args: ['compose', '-f', 'docker-compose.qa.yml', '-p', 'autodev-qa-workflow-001', 'build'],
      cwd: '/tmp/qa',
      env: {
        AUTODEV_BRANCH: 'feature/qa-handoff',
        AUTODEV_BASE_URL: 'http://localhost:4000',
      },
    });

    expect(buildComposeUpCommand(input).args).toEqual([
      'compose',
      '-f',
      'docker-compose.qa.yml',
      '-p',
      'autodev-qa-workflow-001',
      'up',
      '-d',
      '--build',
    ]);

    expect(buildComposeDownCommand(input).args).toContain('down');
    expect(buildComposeLogsCommand(input).args).toContain('logs');
  });
});

describe('healthCheck', () => {
  it('builds health check URLs from base URL and path', () => {
    expect(buildHealthCheckUrl('http://localhost:4000/', '/api/v1/health')).toBe(
      'http://localhost:4000/api/v1/health',
    );
  });

  it('does not mark healthy until checks pass', async () => {
    const checker = new MockHealthChecker({
      outcomes: [
        { ok: false, statusCode: 503, error: 'not ready' },
        { ok: true, statusCode: 200 },
      ],
    });

    const result = await waitForHealthy({
      url: 'http://localhost:4000/api/v1/health',
      checker,
      maxAttempts: 3,
      delayMs: 0,
    });

    expect(result.healthy).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('returns failed health result after exhausting attempts', async () => {
    const checker = new MockHealthChecker({
      outcomes: [{ ok: false, statusCode: 503, error: 'still down' }],
    });

    const result = await waitForHealthy({
      url: 'http://localhost:4000/api/v1/health',
      checker,
      maxAttempts: 2,
      delayMs: 0,
    });

    expect(result.healthy).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.lastError).toBe('still down');
  });
});

describe('MockDockerClient', () => {
  it('records compose operations for success scenario', async () => {
    const client = new MockDockerClient({ scenario: 'success' });
    const command = buildComposeBuildCommand({
      composeFile: 'docker-compose.qa.yml',
      projectName: 'p1',
      cwd: '/tmp',
      branch: 'main',
      baseUrl: 'http://localhost:4000',
    });

    const build = await client.build(command);
    const up = await client.up(buildComposeUpCommand({
      composeFile: 'docker-compose.qa.yml',
      projectName: 'p1',
      cwd: '/tmp',
      branch: 'main',
      baseUrl: 'http://localhost:4000',
    }));

    expect(build.exitCode).toBe(0);
    expect(up.exitCode).toBe(0);
    expect(client.calls.map((c) => c.operation)).toEqual(['build', 'up']);
  });

  it('simulates build failure', async () => {
    const client = new MockDockerClient({ scenario: 'build_failure' });
    const result = await client.build(
      buildComposeBuildCommand({
        composeFile: 'docker-compose.qa.yml',
        projectName: 'p1',
        cwd: '/tmp',
        branch: 'main',
        baseUrl: 'http://localhost:4000',
      }),
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('mock build failure');
  });
});
