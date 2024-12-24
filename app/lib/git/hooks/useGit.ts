import type { WebContainer } from '@webcontainer/api';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { webcontainer as webcontainerPromise } from '~/lib/webcontainer';
import git, { type GitAuth, type PromiseFsClient } from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { toast } from 'react-toastify';
import { ensureEncryption, lookupSavedPassword, saveGitAuth } from '~/lib/auth';

export function useGit() {
  const [ready, setReady] = useState(false);
  const [webcontainer, setWebcontainer] = useState<WebContainer>();
  const [fs, setFs] = useState<PromiseFsClient>();
  const fileData = useRef<Record<string, { data: any; encoding?: string }>>({});

  useEffect(() => {
    webcontainerPromise.then((container) => {
      fileData.current = {};
      setWebcontainer(container);
      setFs(getFs(container, fileData));
      setReady(true);
    });
  }, []);

  const gitClone = useCallback(
    async (url: string) => {
      if (!webcontainer || !fs || !ready) {
        throw 'Webcontainer not initialized';
      }

      fileData.current = {};

      try {
        if (url.startsWith('git@')) {
          throw new Error('SSH protocol is not supported. Please use HTTPS URL instead.');
        }

        await git.clone({
          fs,
          http,
          dir: webcontainer.workdir,
          url,
          depth: 1,
          singleBranch: true,
          corsProxy: 'https://cors.isomorphic-git.org',
          onAuth: async (url) => {
            if (!(await ensureEncryption())) {
              return { cancel: true };
            }

            const auth = await lookupSavedPassword(url);

            if (auth) {
              return auth;
            }

            if (confirm('This repo is password protected. Ready to enter a username & password?')) {
              const username = prompt('Enter username');
              const password = prompt('Enter password');

              if (username && password) {
                return { username, password };
              }
            }

            return { cancel: true };
          },
          onAuthFailure: (url, _auth) => {
            toast.error(`Error Authenticating with ${url.split('/')[2]}`);
          },
          onAuthSuccess: async (url, auth) => {
            await saveGitAuth(url, auth as GitAuth);
          },
        });

        const data: Record<string, { data: any; encoding?: string }> = {};

        for (const [key, value] of Object.entries(fileData.current)) {
          data[key] = value;
        }

        return { workdir: webcontainer.workdir, data };
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to clone repository');
        throw error;
      }
    },
    [webcontainer],
  );

  return { ready, gitClone };
}

const getFs = (
  webcontainer: WebContainer,
  record: MutableRefObject<Record<string, { data: any; encoding?: string }>>,
) => ({
  promises: {
    readFile: async (path: string, options: any) => {
      const encoding = options.encoding;
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      console.log('readFile', relativePath, encoding);

      return await webcontainer.fs.readFile(relativePath, encoding);
    },
    writeFile: async (path: string, data: any, options: any) => {
      const encoding = options.encoding;
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      console.log('writeFile', { relativePath, data, encoding });

      if (record.current) {
        record.current[relativePath] = { data, encoding };
      }

      return await webcontainer.fs.writeFile(relativePath, data, { ...options, encoding });
    },
    mkdir: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      console.log('mkdir', relativePath, options);

      return await webcontainer.fs.mkdir(relativePath, { ...options, recursive: true });
    },
    readdir: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      console.log('readdir', relativePath, options);

      return await webcontainer.fs.readdir(relativePath, options);
    },
    rm: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      console.log('rm', relativePath, options);

      return await webcontainer.fs.rm(relativePath, { ...(options || {}) });
    },
    rmdir: async (path: string, options: any) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      console.log('rmdir', relativePath, options);

      return await webcontainer.fs.rm(relativePath, { recursive: true, ...options });
    },
    unlink: async (path: string) => {
      const relativePath = pathUtils.relative(webcontainer.workdir, path);
      return await webcontainer.fs.rm(relativePath, { recursive: false });
    },
    stat: async (path: string) => {
      try {
        const relativePath = pathUtils.relative(webcontainer.workdir, path);
        const resp = await webcontainer.fs.readdir(pathUtils.dirname(relativePath), { withFileTypes: true });
        const name = pathUtils.basename(relativePath);
        const fileInfo = resp.find((x) => x.name == name);

        if (!fileInfo) {
          throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
        }

        return {
          isFile: () => fileInfo.isFile(),
          isDirectory: () => fileInfo.isDirectory(),
          isSymbolicLink: () => false,
          size: 1,
          mode: 0o666,
          mtimeMs: Date.now(),
          uid: 1000,
          gid: 1000,
        };
      } catch (error: any) {
        console.error(error?.message);

        const err = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        err.errno = -2;
        err.syscall = 'stat';
        err.path = path;
        throw err;
      }
    },
    lstat: async (path: string) => {
      return await getFs(webcontainer, record).promises.stat(path);
    },
    readlink: async (path: string) => {
      throw new Error(`EINVAL: invalid argument, readlink '${path}'`);
    },
    symlink: async (target: string, path: string) => {
      throw new Error(`EPERM: operation not permitted, symlink '${target}' -> '${path}'`);
    },
    chmod: async (_path: string, _mode: number) => {
      return await Promise.resolve();
    },
  },
});

const pathUtils = {
  dirname: (path: string) => {
    if (!path || !path.includes('/')) {
      return '.';
    }

    path = path.replace(/\/+$/, '');

    return path.split('/').slice(0, -1).join('/') || '/';
  },

  basename: (path: string, ext?: string) => {
    path = path.replace(/\/+$/, '');

    const base = path.split('/').pop() || '';

    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }

    return base;
  },

  relative: (from: string, to: string): string => {
    if (!from || !to) {
      return '.';
    }

    const normalizePathParts = (p: string) => p.replace(/\/+$/, '').split('/').filter(Boolean);
    const fromParts = normalizePathParts(from);
    const toParts = normalizePathParts(to);
    let commonLength = 0;
    const minLength = Math.min(fromParts.length, toParts.length);

    for (let i = 0; i < minLength; i++) {
      if (fromParts[i] !== toParts[i]) {
        break;
      }

      commonLength++;
    }

    const upCount = fromParts.length - commonLength;
    const remainingPath = toParts.slice(commonLength);
    const relativeParts = [...Array(upCount).fill('..'), ...remainingPath];

    return relativeParts.length === 0 ? '.' : relativeParts.join('/');
  },
};
