import Docker from 'dockerode';
import type { Writable, Readable } from 'stream';

const docker = new Docker(); // Configure with host if necessary

export class DockerService {
  private containers: Map<string, Docker.Container> = new Map();

  async startContainer(image: string, command: string[], env: Record<string, string> = {}): Promise<Docker.Container> {
    const container = await docker.createContainer({
      Image: image,
      Cmd: command,
      Env: Object.entries(env).map(([key, value]) => `${key}=${value}`),
      Tty: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
    });

    await container.start();
    this.containers.set(container.id, container);
    return container;
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (container) {
      await container.stop();
      this.containers.delete(containerId);
    }
  }

  async attachStreams(containerId: string): Promise<{ stdin: Writable; stdout: Readable; stderr: Readable }> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    });

    // Split the stream into stdout and stderr
    const stdout = new Readable({
      read() {},
    });

    const stderr = new Readable({
      read() {},
    });

    stream.on('data', (chunk: Buffer) => {
      // Docker multiplexes stdout and stderr, so you'd need to demultiplex them.
      // For simplicity, this example does not handle demuxing.
      stdout.push(chunk);
    });

    stream.on('end', () => {
      stdout.push(null);
      stderr.push(null);
    });

    return { stdin: stream, stdout, stderr };
  }
}
