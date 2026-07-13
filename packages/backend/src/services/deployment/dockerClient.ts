import type { DockerComposeCommand } from '@autodev/shared-types';

export interface DockerExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface DockerClient {
  build(command: DockerComposeCommand): Promise<DockerExecResult>;
  up(command: DockerComposeCommand): Promise<DockerExecResult>;
  down(command: DockerComposeCommand): Promise<DockerExecResult>;
  logs(command: DockerComposeCommand): Promise<DockerExecResult>;
}

/**
 * Production client that shells out to the Docker CLI.
 * Tests inject {@link MockDockerClient} instead — never call real Docker in unit tests.
 */
export class ProcessDockerClient implements DockerClient {
  async build(command: DockerComposeCommand): Promise<DockerExecResult> {
    return this.run(command);
  }

  async up(command: DockerComposeCommand): Promise<DockerExecResult> {
    return this.run(command);
  }

  async down(command: DockerComposeCommand): Promise<DockerExecResult> {
    return this.run(command);
  }

  async logs(command: DockerComposeCommand): Promise<DockerExecResult> {
    return this.run(command);
  }

  private async run(command: DockerComposeCommand): Promise<DockerExecResult> {
    const { spawn } = await import('node:child_process');
    return new Promise((resolve, reject) => {
      const child = spawn(command.command, command.args, {
        cwd: command.cwd,
        env: { ...process.env, ...command.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', reject);
      child.on('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
        });
      });
    });
  }
}

export type MockDockerScenario = 'success' | 'build_failure' | 'up_failure' | 'health_logs_only';

export interface MockDockerClientOptions {
  scenario?: MockDockerScenario;
  buildStdout?: string;
  buildStderr?: string;
  upStdout?: string;
  upStderr?: string;
  downStdout?: string;
  logsStdout?: string;
}

/**
 * In-memory Docker client for unit and integration tests.
 * Records invoked commands for assertions; never touches a real daemon.
 */
export class MockDockerClient implements DockerClient {
  readonly calls: Array<{ operation: 'build' | 'up' | 'down' | 'logs'; command: DockerComposeCommand }> =
    [];

  private readonly scenario: MockDockerScenario;
  private readonly buildStdout: string;
  private readonly buildStderr: string;
  private readonly upStdout: string;
  private readonly upStderr: string;
  private readonly downStdout: string;
  private readonly logsStdout: string;

  constructor(options: MockDockerClientOptions = {}) {
    this.scenario = options.scenario ?? 'success';
    this.buildStdout = options.buildStdout ?? 'Mock build succeeded\n';
    this.buildStderr = options.buildStderr ?? '';
    this.upStdout = options.upStdout ?? 'Mock compose up succeeded\n';
    this.upStderr = options.upStderr ?? '';
    this.downStdout = options.downStdout ?? 'Mock compose down succeeded\n';
    this.logsStdout = options.logsStdout ?? 'app-1  | listening on :4000\n';
  }

  async build(command: DockerComposeCommand): Promise<DockerExecResult> {
    this.calls.push({ operation: 'build', command });
    if (this.scenario === 'build_failure') {
      return {
        exitCode: 1,
        stdout: this.buildStdout,
        stderr: this.buildStderr || 'ERROR: failed to solve: mock build failure\n',
      };
    }
    return { exitCode: 0, stdout: this.buildStdout, stderr: this.buildStderr };
  }

  async up(command: DockerComposeCommand): Promise<DockerExecResult> {
    this.calls.push({ operation: 'up', command });
    if (this.scenario === 'up_failure') {
      return {
        exitCode: 1,
        stdout: this.upStdout,
        stderr: this.upStderr || 'ERROR: mock compose up failure\n',
      };
    }
    return { exitCode: 0, stdout: this.upStdout, stderr: this.upStderr };
  }

  async down(command: DockerComposeCommand): Promise<DockerExecResult> {
    this.calls.push({ operation: 'down', command });
    return { exitCode: 0, stdout: this.downStdout, stderr: '' };
  }

  async logs(command: DockerComposeCommand): Promise<DockerExecResult> {
    this.calls.push({ operation: 'logs', command });
    return { exitCode: 0, stdout: this.logsStdout, stderr: '' };
  }
}
