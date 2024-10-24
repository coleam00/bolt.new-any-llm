import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'node:buffer';
import { bufferWatchEvents } from '~/utils/buffer';
import { WORK_DIR } from '~/utils/constants';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';
import { debounce } from 'lodash';
import * as diff from 'diff';

const logger = createScopedLogger('FilesStore');

const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  metadata?: {
    lastModified: number;
    size: number;
  };
}

export interface Folder {
  type: 'folder';
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

// Error Categories enum for better error classification
enum ErrorCategory {
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  RESOURCE = 'RESOURCE',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
  CORRUPTION = 'CORRUPTION'
}

// Base error class with additional context
class FilesStoreError extends Error {
  readonly category: ErrorCategory;
  readonly timestamp: number;
  readonly path?: string;
  readonly operation?: string;

  constructor(message: string, category: ErrorCategory, options?: {
    path?: string;
    operation?: string;
    cause?: Error;
  }) {
    super(message);
    this.name = 'FilesStoreError';
    this.category = category;
    this.timestamp = Date.now();
    this.path = options?.path;
    this.operation = options?.operation;
    this.cause = options?.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      timestamp: this.timestamp,
      path: this.path,
      operation: this.operation,
      cause: this.cause instanceof Error ? this.cause.message : this.cause
    };
  }
}

// Enhanced error classes with better context
class FileNotFoundError extends FilesStoreError {
  constructor(path: string) {
    super(
      `File not found: ${path}`, 
      ErrorCategory.RESOURCE,
      { path }
    );
    this.name = 'FileNotFoundError';
  }
}

class FileOperationError extends FilesStoreError {
  constructor(operation: string, path: string, originalError: Error) {
    super(
      `Failed to ${operation} file ${path}: ${originalError.message}`,
      ErrorCategory.SYSTEM,
      { path, operation, cause: originalError }
    );
    this.name = 'FileOperationError';
  }
}

class FileDecodeError extends FileOperationError {
  constructor(path: string, originalError: Error) {
    super('decode', path, originalError);
    this.name = 'FileDecodeError';
  }
}

class FilePermissionError extends FilesStoreError {
  constructor(operation: string, path: string) {
    super(
      `Permission denied: Cannot ${operation} file ${path}`,
      ErrorCategory.PERMISSION,
      { path, operation }
    );
    this.name = 'FilePermissionError';
  }
}

class FileSizeExceededError extends FilesStoreError {
  constructor(path: string, size: number, maxSize: number) {
    super(
      `File size exceeded: ${path} (${size} bytes) exceeds maximum allowed size of ${maxSize} bytes`,
      ErrorCategory.VALIDATION,
      { path }
    );
    this.name = 'FileSizeExceededError';
  }
}

class InvalidFileNameError extends FilesStoreError {
  constructor(fileName: string) {
    super(
      `Invalid file name: ${fileName}`,
      ErrorCategory.VALIDATION,
      { path: fileName }
    );
    this.name = 'InvalidFileNameError';
  }
}

// Add retry information to network errors
class NetworkError extends FilesStoreError {
  readonly attemptsMade: number;
  readonly maxAttempts: number;

  constructor(operation: string, path: string, originalError: Error, attemptsMade: number, maxAttempts: number) {
    super(
      `Network error while ${operation} file ${path}: ${originalError.message}`,
      ErrorCategory.NETWORK,
      { path, operation, cause: originalError }
    );
    this.name = 'NetworkError';
    this.attemptsMade = attemptsMade;
    this.maxAttempts = maxAttempts;
  }
}

// Enhanced quota error with size information
class FileSystemQuotaExceededError extends FilesStoreError {
  readonly currentUsage: number;
  readonly quota: number;

  constructor(path: string, currentUsage: number, quota: number) {
    super(
      `File system quota exceeded when trying to write file: ${path}. Usage: ${currentUsage}B/${quota}B`,
      ErrorCategory.SYSTEM,
      { path }
    );
    this.name = 'FileSystemQuotaExceededError';
    this.currentUsage = currentUsage;
    this.quota = quota;
  }
}

class InvalidFileTypeError extends FilesStoreError {
  constructor(path: string, expectedType: string, actualType: string) {
    super(
      `Invalid file type for ${path}: expected ${expectedType}, but got ${actualType}`,
      ErrorCategory.VALIDATION,
      { path }
    );
    this.name = 'InvalidFileTypeError';
  }
}

class FileCorruptedError extends FilesStoreError {
  constructor(path: string) {
    super(
      `File ${path} appears to be corrupted`,
      ErrorCategory.CORRUPTION,
      { path }
    );
    this.name = 'FileCorruptedError';
  }
}

// Error handler utility
class ErrorHandler {
  static async retryOperation<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      retryDelay: number;
      operationName: string;
      path: string;
    }
  ): Promise<T> {
    let retries = 0;
    
    while (true) {
      try {
        return await operation();
      } catch (error) {
        retries++;
        
        if (error instanceof Error) {
          // Convert known error patterns
          if (error.message.includes('permission denied')) {
            throw new FilePermissionError('write', options.path);
          }
          
          if (error.message.includes('network')) {
            throw new NetworkError(
              options.operationName,
              options.path,
              error,
              retries,
              options.maxRetries
            );
          }
        }

        if (retries >= options.maxRetries) {
          throw new FileOperationError(options.operationName, options.path, error as Error);
        }

        await new Promise(resolve => setTimeout(resolve, options.retryDelay));
      }
    }
  }

  static handleFileOperation(error: Error, path: string, operation: string): never {
    if (error instanceof FilesStoreError) {
      throw error;
    }

    // Map common error patterns to specific errors
    if (error.message.includes('ENOENT')) {
      throw new FileNotFoundError(path);
    }
    if (error.message.includes('EACCES')) {
      throw new FilePermissionError(operation, path);
    }
    if (error.message.includes('ENOSPC')) {
      // You would need to implement getting actual usage and quota
      throw new FileSystemQuotaExceededError(path, 0, 0);
    }

    throw new FileOperationError(operation, path, error);
  }
}

export interface FilesStoreConfig {
  debounceTime?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxFileSize?: number;
}

export class FilesStore {
  #webcontainer: Promise<WebContainer>;
  #size = 0;
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});
  #contentCache: Map<string, string> = new Map();
  #saveDebounce: Map<string, ReturnType<typeof debounce>> = new Map();
  #config: FilesStoreConfig;
  #fileOperationQueue: Array<() => Promise<void>> = [];
  #isProcessingQueue = false;
  #watchStats = {
    totalEvents: 0,
    addDirEvents: 0,
    removeDirEvents: 0,
    addFileEvents: 0,
    changeEvents: 0,
    removeFileEvents: 0,
  };

  constructor(webcontainerPromise: Promise<WebContainer>, config: FilesStoreConfig = {}) {
    this.#webcontainer = webcontainerPromise;
    this.#config = {
      debounceTime: 500,
      maxRetries: 3,
      retryDelay: 1000,
      maxFileSize: 1024 * 1024 * 10, // 10 MB default
      ...config,
    };

    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
      import.meta.hot.dispose(this.#disposeSaveDebounce.bind(this));
    }

    this.#init();
  }

  get filesCount() {
    return this.#size;
  }

  get watchStats() {
    return { ...this.#watchStats };
  }

  getFile(filePath: string): File | undefined {
    const dirent = this.files.get()[filePath];
    return dirent?.type === 'file' ? dirent : undefined;
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async setFileContent(path: string, content: string) {
    const sanitizedPath = this.#sanitizePath(path);
    
    if (!this.#isValidFileName(sanitizedPath)) {
      throw new InvalidFileNameError(sanitizedPath);
    }

    const file = this.files.get()[sanitizedPath];

    if (!file || file.type !== 'file') {
      throw new FileNotFoundError(sanitizedPath);
    }

    if (this.#contentCache.get(sanitizedPath) === content) {
      return; // Content hasn't changed, no need to update
    }

    this.#contentCache.set(sanitizedPath, content);
    this.#debouncedSaveFile(sanitizedPath, content, file);
  }

  #isValidFileName(fileName: string): boolean {
    // Implement your file name validation logic here
    // For example, you might want to disallow certain characters or patterns
    return /^[a-zA-Z0-9_\-\.]+$/.test(fileName);
  }

  async #init() {
    const webcontainer = await this.#webcontainer;
    webcontainer.internal.watchPaths(
      { include: [`${WORK_DIR}/**`], exclude: ['**/node_modules', '.git'], includeContent: true },
      bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
    );
  }

  #processEventBuffer(events: Array<[events: PathWatcherEvent[]]>) {
    const watchEvents = events.flat(2);

    for (const { type, path, buffer } of watchEvents) {
      const sanitizedPath = this.#sanitizePath(path);
      this.#watchStats.totalEvents++;

      switch (type) {
        case 'add_dir':
          this.#watchStats.addDirEvents++;
          this.files.setKey(sanitizedPath, { type: 'folder' });
          break;
        case 'remove_dir':
          this.#watchStats.removeDirEvents++;
          this.#removeDirectory(sanitizedPath);
          break;
        case 'add_file':
        case 'change':
          type === 'add_file' ? this.#watchStats.addFileEvents++ : this.#watchStats.changeEvents++;
          this.#handleFileAddOrChange(type, sanitizedPath, buffer);
          break;
        case 'remove_file':
          this.#watchStats.removeFileEvents++;
          this.#removeFile(sanitizedPath);
          break;
        case 'update_directory':
          // we don't care about these events
          break;
        default:
          logger.warn(`Unhandled event type: ${type}`);
          break;
      }
    }
  }

  #removeDirectory(path: string) {
    this.files.setKey(path, undefined);
    for (const [direntPath] of Object.entries(this.files.get())) {
      if (direntPath.startsWith(path)) {
        this.files.setKey(direntPath, undefined);
      }
    }
  }

  #handleFileAddOrChange(type: 'add_file' | 'change', path: string, buffer?: Uint8Array) {
    if (type === 'add_file') {
      this.#size++;
    }

    const isBinary = isBinaryFile(buffer);
    const content = isBinary ? '' : this.#decodeFileContent(buffer, path);
    
    // Check for invalid file type
    const expectedType = path.endsWith('.txt') ? 'text' : 'unknown';
    if (isBinary && expectedType === 'text') {
      throw new InvalidFileTypeError(path, expectedType, 'binary');
    }

    const metadata = {
      lastModified: Date.now(),
      size: buffer?.byteLength ?? 0,
    };
    this.files.setKey(path, { type: 'file', content, isBinary, metadata });
  }

  #removeFile(path: string) {
    this.#size--;
    this.files.setKey(path, undefined);
  }

  #decodeFileContent(buffer?: Uint8Array, path?: string): string {
    if (!buffer || buffer.byteLength === 0) {
      return '';
    }

    try {
      const content = utf8TextDecoder.decode(buffer);
      // Check for potential corruption (e.g., if the content is not valid UTF-8)
      if (content.includes('\uFFFD')) {
        throw new FileCorruptedError(path || 'unknown');
      }
      return content;
    } catch (error) {
      logger.error('Failed to decode file content', error);
      if (path) {
        if (error instanceof FileCorruptedError) {
          throw error;
        }
        throw new FileDecodeError(path, error as Error);
      }
      return '';
    }
  }

  #sanitizePath(path: string): string {
    return path.replace(/\/+$/g, '');
  }

  #debouncedSaveFile(path: string, content: string, file: File) {
    if (!this.#saveDebounce.has(path)) {
      this.#saveDebounce.set(
        path,
        debounce(this.#saveFile.bind(this), this.#config.debounceTime)
      );
    }
    this.#saveDebounce.get(path)!(path, content, file);
  }

  async #saveFile(path: string, content: string, file: File) {
    await this.#queueFileOperation(async () => {
      const webcontainer = await this.#webcontainer;
      
      try {
        const currentContent = await ErrorHandler.retryOperation(
          () => webcontainer.fs.readFile(path, 'utf-8'),
          {
            maxRetries: this.#config.maxRetries!,
            retryDelay: this.#config.retryDelay!,
            operationName: 'read',
            path
          }
        );

        // Validate file size before writing
        const newSize = Buffer.byteLength(content);
        if (newSize > this.#config.maxFileSize!) {
          throw new FileSizeExceededError(path, newSize, this.#config.maxFileSize!);
        }

        if (diff.diffChars(currentContent, content).length > 1) {
          await ErrorHandler.retryOperation(
            () => webcontainer.fs.writeFile(path, content),
            {
              maxRetries: this.#config.maxRetries!,
              retryDelay: this.#config.retryDelay!,
              operationName: 'write',
              path
            }
          );

          // Update file metadata
          const updatedFile: File = {
            ...file,
            content,
            metadata: {
              lastModified: Date.now(),
              size: newSize,
            },
          };
          
          this.files.setKey(path, updatedFile);
          
          if (!this.#modifiedFiles.has(path)) {
            this.#modifiedFiles.set(path, currentContent);
          }
        }
      } catch (error) {
        ErrorHandler.handleFileOperation(error as Error, path, 'save');
      }
    });
  }

  async #queueFileOperation(operation: () => Promise<void>) {
    this.#fileOperationQueue.push(operation);
    if (!this.#isProcessingQueue) {
      await this.#processFileOperationQueue();
    }
  }

  async #processFileOperationQueue() {
    if (this.#isProcessingQueue) return;
    this.#isProcessingQueue = true;

    while (this.#fileOperationQueue.length > 0) {
      const operation = this.#fileOperationQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          logger.error('File operation failed', error);
        }
      }
    }

    this.#isProcessingQueue = false;
  }

  #disposeSaveDebounce() {
    for (const debounceFn of this.#saveDebounce.values()) {
      debounceFn.cancel();
    }
  }

  async saveFile(filePath: string, content: string) {
    const file = this.getFile(filePath);
    if (!file || file.type !== 'file') {
      throw new FileNotFoundError(filePath);
    }

    await this.setFileContent(filePath, content);
  }
}

function isBinaryFile(buffer: Uint8Array | undefined): boolean {
  if (buffer === undefined) {
    return false;
  }
  return getEncoding(convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
}

function convertToBuffer(view: Uint8Array): Buffer {
  const buffer = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  Object.setPrototypeOf(buffer, Buffer.prototype);
  return buffer as Buffer;
}
