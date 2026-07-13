import type { DockerComposeCommand } from '@autodev/shared-types';

export const DEFAULT_COMPOSE_FILE = 'docker-compose.qa.yml';
export const DEFAULT_HEALTH_CHECK_PATH = '/api/v1/health';

export function sanitizeProjectName(workflowId: string): string {
  const cleaned = workflowId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `autodev-qa-${cleaned || 'local'}`;
}

export interface BuildComposeCommandInput {
  composeFile: string;
  projectName: string;
  cwd: string;
  branch: string;
  baseUrl: string;
}

/** Pure helpers for Docker Compose CLI argument construction (unit-testable). */
export function buildComposeBuildCommand(input: BuildComposeCommandInput): DockerComposeCommand {
  return {
    command: 'docker',
    args: ['compose', '-f', input.composeFile, '-p', input.projectName, 'build'],
    cwd: input.cwd,
    env: {
      AUTODEV_BRANCH: input.branch,
      AUTODEV_BASE_URL: input.baseUrl,
    },
  };
}

export function buildComposeUpCommand(input: BuildComposeCommandInput): DockerComposeCommand {
  return {
    command: 'docker',
    args: [
      'compose',
      '-f',
      input.composeFile,
      '-p',
      input.projectName,
      'up',
      '-d',
      '--build',
    ],
    cwd: input.cwd,
    env: {
      AUTODEV_BRANCH: input.branch,
      AUTODEV_BASE_URL: input.baseUrl,
    },
  };
}

export function buildComposeDownCommand(input: {
  composeFile: string;
  projectName: string;
  cwd: string;
}): DockerComposeCommand {
  return {
    command: 'docker',
    args: ['compose', '-f', input.composeFile, '-p', input.projectName, 'down', '-v'],
    cwd: input.cwd,
  };
}

export function buildComposeLogsCommand(input: {
  composeFile: string;
  projectName: string;
  cwd: string;
}): DockerComposeCommand {
  return {
    command: 'docker',
    args: ['compose', '-f', input.composeFile, '-p', input.projectName, 'logs', '--no-color'],
    cwd: input.cwd,
  };
}
