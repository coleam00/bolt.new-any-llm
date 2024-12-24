import Cookies from 'js-cookie';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import { encrypt, decrypt, isEncryptionInitialized, initializeMasterKey } from './encryption';
import type { GitAuth } from 'isomorphic-git';

const getDomain = (url: string): string => {
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  return withoutProtocol.split(/[/?#]/)[0];
};

const ensureEncryption = async (): Promise<boolean> => {
  if (!isEncryptionInitialized()) {
    return await initializeMasterKey();
  }

  return true;
};

const getLegacyCredentials = async (domain: string): Promise<GitAuth | null> => {
  const provider = domain.split('.')[0];
  const encryptedUsername = Cookies.get(`${provider}Username`);
  const encryptedToken = Cookies.get(`${provider}Token`);

  if (!encryptedUsername || !encryptedToken) {
    return null;
  }

  try {
    const username = await decrypt(encryptedUsername);
    const token = await decrypt(encryptedToken);

    if (!username || !token) {
      Cookies.remove(`${provider}Username`);
      Cookies.remove(`${provider}Token`);

      return null;
    }

    return { username, password: token };
  } catch (error) {
    logStore.logError('Failed to decrypt legacy credentials:', error);
    Cookies.remove(`${provider}Username`);
    Cookies.remove(`${provider}Token`);

    return null;
  }
};

const migrateLegacyCredentials = async (domain: string, auth: GitAuth): Promise<boolean> => {
  const provider = domain.split('.')[0];

  try {
    const encryptedCreds = await encrypt(JSON.stringify(auth));
    Cookies.set(domain, encryptedCreds);

    Cookies.remove(`${provider}Username`);
    Cookies.remove(`${provider}Token`);

    const legacyKeys = [
      `${provider}AccessToken`,
      `${provider}Auth`,
      `${provider}Credentials`,
      `${provider}_username`,
      `${provider}_token`,
    ];

    legacyKeys.forEach((key) => {
      if (Cookies.get(key)) {
        Cookies.remove(key);
        logStore.logSystem(`Removed legacy cookie: ${key}`);
      }
    });

    logStore.logSystem(`Successfully migrated ${provider} credentials to new format and cleaned up legacy data`);

    return true;
  } catch (error) {
    logStore.logError('Failed to migrate legacy credentials:', error);
    return false;
  }
};

const getNewFormatCredentials = async (domain: string): Promise<GitAuth | null> => {
  const encryptedCreds = Cookies.get(domain);

  if (!encryptedCreds) {
    return null;
  }

  try {
    const decryptedCreds = await decrypt(encryptedCreds);
    const { username, password } = JSON.parse(decryptedCreds);

    if (!username || !password) {
      Cookies.remove(domain);
      return null;
    }

    return { username, password };
  } catch (error) {
    logStore.logError('Failed to parse or decrypt Git Cookie:', error);
    Cookies.remove(domain);

    return null;
  }
};

const lookupSavedPassword = async (url: string): Promise<GitAuth | null> => {
  if (!(await ensureEncryption())) {
    return null;
  }

  const domain = getDomain(url);
  const newFormatCreds = await getNewFormatCredentials(domain);

  if (newFormatCreds) {
    return newFormatCreds;
  }

  const legacyCreds = await getLegacyCredentials(domain);

  if (legacyCreds) {
    const migrationSuccess = await migrateLegacyCredentials(domain, legacyCreds);

    if (migrationSuccess) {
      return legacyCreds;
    }
  }

  return null;
};

const saveGitAuth = async (url: string, auth: GitAuth) => {
  if (!(await ensureEncryption())) {
    toast.error('Failed to initialize encryption');
    return;
  }

  const domain = getDomain(url);

  try {
    const encryptedCreds = await encrypt(
      JSON.stringify({
        username: auth.username,
        password: auth.password,
      }),
    );
    Cookies.set(domain, encryptedCreds);
    logStore.logSystem(`${domain} connection settings updated`, {
      username: auth.username,
      hasToken: !!auth.password,
    });
  } catch (error) {
    logStore.logError('Failed to encrypt credentials:', error);
  }
};

const removeGitAuth = async (url: string) => {
  const domain = getDomain(url);

  try {
    Cookies.remove(domain);
    logStore.logSystem(`${domain} connection removed`);
    toast.success(`${domain} connection removed successfully!`);
  } catch (error) {
    logStore.logError('Failed to encrypt credentials:', error);
    toast.error('Failed to save credentials securely');
  }
};

export { lookupSavedPassword, saveGitAuth, removeGitAuth, ensureEncryption };
