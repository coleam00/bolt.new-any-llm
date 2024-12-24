import { toast } from 'react-toastify';
import { ensureEncryption, lookupSavedPassword } from '~/lib/auth';
import { gitProviders } from './providers';

export const getGitCredentials = async (): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {};

  for (const [name, plugin] of Object.entries(gitProviders)) {
    const auth = await lookupSavedPassword(plugin.provider.url);
    results[name] = !!(auth?.username && auth?.password);
  }

  return results;
};

export const createGitPushHandler = (getFiles: () => Record<string, string>) => {
  const createPushFunction = (providerName: string) => async (): Promise<void> => {
    const plugin = gitProviders[providerName];

    if (!plugin) {
      toast.error(`Git provider ${providerName} not found`);
      return;
    }

    const repoName = prompt(
      `Please enter a name for your new ${plugin.provider.title} repository:`,
      'bolt-generated-project',
    );

    if (!repoName) {
      toast.error('Repository name is required');
      return;
    }

    if (!(await ensureEncryption())) {
      toast.error('Failed to initialize secure storage');
      return;
    }

    const auth = await lookupSavedPassword(plugin.provider.url);

    if (!auth?.username || !auth?.password) {
      toast.info(`Please set up your ${plugin.provider.title} credentials in the Connections tab`);
      return;
    }

    const files = getFiles();
    const result = await plugin.api.pushWithRepoHandling(repoName, auth.username, files, auth.password);

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const pushFunctions: Record<string, () => Promise<void>> = {};

  for (const providerName of Object.keys(gitProviders)) {
    pushFunctions[providerName] = createPushFunction(providerName);
  }

  return pushFunctions;
};
