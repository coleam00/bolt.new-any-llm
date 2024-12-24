import { githubProvider, githubAPI } from './github';
import { gitlabProvider, gitlabAPI } from './gitlab';
import type { GitProviderPlugin } from '~/lib/git/types';

export const gitProviders: Record<string, GitProviderPlugin> = {
  github: {
    provider: githubProvider,
    api: githubAPI,
  },
  gitlab: {
    provider: gitlabProvider,
    api: gitlabAPI,
  },
};

export const registerGitProvider = (name: string, plugin: GitProviderPlugin) => {
  gitProviders[name] = plugin;
};
