import { WebContainer } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import * as nodePath from 'node:path';
import type { BoltAction } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';
import { DockerService } from '~/lib/services/dockerService';
import { PassThrough } from 'stream';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

import { DockerService } from '~/lib/services/dockerService';
import { PassThrough } from 'stream';
import axios from 'axios';
import nodePath from 'path';
import { logger } from '~/lib/logger';
import { unreachable } from '~/lib/utils';

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();

  actions: ActionsMap = map({});
  private dockerService = new DockerService();

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;
    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // Action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return;
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: true });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
        case 'docker': {
          await this.#runDockerAction(action);
          break;
        }
        case 'git': {
          await this.#runGitAction(action);
          break;
        }
        default: {
          unreachable(`Unknown action type: ${action.type}`);
        }
      }

      this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
    } catch (error) {
      this.#updateAction(actionId, { status: 'failed', error: (error as Error).message });
      throw error;
    }
  }

  private async #runDockerAction(action: ActionState) {
    if (action.type !== 'docker') {
      unreachable('Expected docker action');
    }

    const { image, command, env } = action;

    try {
      // Start the Docker container
      const container = await this.dockerService.startContainer(image, command, env);

      // Attach to the container's IO streams
      const { stdin, stdout, stderr } = await this.dockerService.attachStreams(container.id);

      // Create PassThrough streams to interface with the LLM
      const llmToDocker = new PassThrough();
      const dockerToLLM = new PassThrough();

      // Pipe LLM input to Docker's stdin
      llmToDocker.pipe(stdin);

      // Pipe Docker's stdout and stderr to LLM's output
      stdout.pipe(dockerToLLM);
      stderr.pipe(dockerToLLM); // Handle stderr if needed

      // Connect these streams to the LLM service
      llmService.connectInput(llmToDocker);
      llmService.connectOutput(dockerToLLM);

      // Handle abort
      action.abort = async () => {
        try {
          await container.stop();
          await this.dockerService.stopContainer(container.id);
          this.#updateAction(action.id, { status: 'aborted' });
        } catch (error: any) {
          this.#updateAction(action.id, { status: 'failed', error: error.message });
        }
      };

      // Monitor container exit
      container.wait((err, result) => {
        if (err) {
          this.#updateAction(action.id, { status: 'failed', error: err.message });
          return;
        }
        this.#updateAction(action.id, { status: 'complete' });
      });
    } catch (error: any) {
      this.#updateAction(action.id, { status: 'failed', error: error.message });
    }
  }

  private async #runGitAction(action: ActionState) {
    if (action.type !== 'git') {
      unreachable('Expected git action');
    }

    const { repositoryUrl, branchName, commitMessage, pullRequestTitle, pullRequestBody, token } = action;

    // Initialize a temporary directory for Git operations
    const tempDir = '/tmp/agent-repo';

    try {
      // Start a Docker container
      const container = await this.dockerService.startContainer('my-node-git:latest', ['bash'], {});

      // Ensure container is stopped after operations
      const cleanup = async () => {
        try {
          await container.stop();
          await this.dockerService.stopContainer(container.id);
        } catch (cleanupError) {
          console.error(`Failed to clean up container ${container.id}:`, cleanupError);
        }
      };

      try {
        // Execute Git commands
        const commands = [
          `git clone ${repositoryUrl} ${tempDir}`,
          `cd ${tempDir}`,
          branchName ? `git checkout -b ${branchName}` : '',
          commitMessage ? `git commit --allow-empty -m "${commitMessage}"` : '',
          `git push origin ${branchName || 'main'}`,
        ].filter(cmd => cmd !== '');

        for (const cmd of commands) {
          await this.#runShellCommandInDocker(action, cmd, tempDir);
        }

        // Create Pull Request if needed
        if (pullRequestTitle && token) {
          await this.#createPullRequest(repositoryUrl, branchName || 'main', pullRequestTitle, pullRequestBody, token);
        }

        // Update status to complete
        this.#updateAction(action.id, { status: 'complete' });
      } catch (error) {
        // Update status to failed
        this.#updateAction(action.id, { status: 'failed', error: (error as Error).message });
        throw error;
      } finally {
        // Cleanup Docker container
        await cleanup();
      }
    } catch (error) {
      this.#updateAction(action.id, { status: 'failed', error: (error as Error).message });
      throw error;
    }
  }

  private async #runShellCommandInDocker(action: ActionState, command: string, workingDir: string) {
    // Start a Docker container with a shell to run Git commands
    const container = await this.dockerService.startContainer('my-node-git:latest', ['bash'], {
      // Pass necessary environment variables if any
    });

    // Attach to container streams
    const { stdin, stdout, stderr } = await this.dockerService.attachStreams(container.id);

    // Write the command to stdin
    stdin.write(`cd ${workingDir} && ${command}\n`);
    stdin.end();

    // Collect command output
    let output = '';
    stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    // Wait for the container to finish
    await container.wait();

    if (output.includes('error') || output.includes('Error')) {
      throw new Error(`Git command failed: ${output}`);
    }

    this.#updateAction(action.id, { output });
  }

  private async #createPullRequest(repositoryUrl: string, branchName: string, title: string, body: string, token: string) {
    // Extract owner and repo name from repositoryUrl
    const match = repositoryUrl.match(/github\.com\/([^/]+)\/([^/]+)(\.git)?$/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const owner = match[1];
    const repo = match[2];

    // Create Pull Request via GitHub API
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        title,
        head: branchName,
        base: 'main',
        body,
      },
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.status !== 201) {
      throw new Error(`Failed to create Pull Request: ${response.statusText}`);
    }

    this.#updateAction(action.id, { output: `Pull Request created: ${response.data.html_url}` });
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const webcontainer = await this.#webcontainer;

    const process = await webcontainer.spawn('jsh', ['-c', action.content], {
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
        },
      }),
    );

    const exitCode = await process.exit;

    logger.debug(`Process terminated with code ${exitCode}`);
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const webcontainer = await this.#webcontainer;

    let folder = nodePath.dirname(action.filePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    try {
      await webcontainer.fs.writeFile(action.filePath, action.content);
      logger.debug(`File written ${action.filePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();
    this.actions.setKey(id, { ...actions[id], ...newState });
  }
}
