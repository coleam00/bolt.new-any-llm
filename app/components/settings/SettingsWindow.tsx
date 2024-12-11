import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { DialogTitle, dialogVariants, dialogBackdropVariants } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { providersList } from '~/lib/stores/settings';
import { db, getAll, deleteById } from '~/lib/persistence';
import { toast } from 'react-toastify';
import { useNavigate } from '@remix-run/react';
import commit from '~/commit.json';
import Cookies from 'js-cookie';
import styles from './Settings.module.scss';
import { Switch } from '~/components/ui/Switch';
import { getProvidersInitialState } from '~/components/settings/getProvidersInitialState';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'chat-history' | 'providers' | 'features' | 'debug' | 'connection';

// Providers that support base URL configuration
const URL_CONFIGURABLE_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'];

export const SettingsWindow = ({ open, onClose }: SettingsProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('chat-history');
  const [isDebugEnabled, setIsDebugEnabled] = useState(() => {
    const savedDebugState = Cookies.get('isDebugEnabled');
    return savedDebugState === 'true';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [githubUsername, setGithubUsername] = useState(Cookies.get('githubUsername') || '');
  const [githubToken, setGithubToken] = useState(Cookies.get('githubToken') || '');
  const [isLocalModelsEnabled, setIsLocalModelsEnabled] = useState(() => {
    const savedLocalModelsState = Cookies.get('isLocalModelsEnabled');
    return savedLocalModelsState === 'true';
  });

  // Load base URLs from cookies
  const [baseUrls, setBaseUrls] = useState(() => {
    const savedUrls = Cookies.get('providerBaseUrls');

    if (savedUrls) {
      try {
        return JSON.parse(savedUrls);
      } catch (error) {
        console.error('Failed to parse base URLs from cookies:', error);
        return {
          Ollama: 'http://localhost:11434',
          LMStudio: 'http://localhost:1234',
          OpenAILike: '',
        };
      }
    }

    return {
      Ollama: 'http://localhost:11434',
      LMStudio: 'http://localhost:1234',
      OpenAILike: '',
    };
  });

  const handleBaseUrlChange = (provider: string, url: string) => {
    setBaseUrls((prev: Record<string, string>) => {
      const newUrls = { ...prev, [provider]: url };
      Cookies.set('providerBaseUrls', JSON.stringify(newUrls));

      return newUrls;
    });
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'chat-history', label: 'Chat History', icon: 'i-ph:book' },
    { id: 'providers', label: 'Providers', icon: 'i-ph:key' },
    { id: 'features', label: 'Features', icon: 'i-ph:star' },
    { id: 'connection', label: 'Connection', icon: 'i-ph:link' },
    ...(isDebugEnabled ? [{ id: 'debug' as TabType, label: 'Debug Tab', icon: 'i-ph:bug' }] : []),
  ];

  // Load providers from cookies on mount
  const [providers, setProviders] = useState(getProvidersInitialState(providersList));

  const handleToggleProvider = (providerName: string, enabled: boolean) => {
    setProviders((prevProviders) => {
      const newProviders = prevProviders.map((provider) =>
        provider.name === providerName ? { ...provider, isEnabled: enabled } : provider,
      );

      // Save to cookies
      const enabledStates = newProviders.reduce(
        (acc, provider) => ({
          ...acc,
          [provider.name]: provider.isEnabled,
        }),
        {},
      );
      Cookies.set('providers', JSON.stringify(enabledStates));

      return newProviders;
    });
  };

  const filteredProviders = providers
    .filter((provider) => {
      const isLocalModelProvider = ['OpenAILike', 'LMStudio', 'Ollama'].includes(provider.name);
      return isLocalModelsEnabled || !isLocalModelProvider;
    })
    .filter((provider) => provider.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleCopyToClipboard = () => {
    const debugInfo = {
      OS: navigator.platform,
      Browser: navigator.userAgent,
      ActiveFeatures: providers.filter((provider) => provider.isEnabled).map((provider) => provider.name),
      BaseURLs: {
        Ollama: process.env.REACT_APP_OLLAMA_URL,
        OpenAI: process.env.REACT_APP_OPENAI_URL,
        LMStudio: process.env.REACT_APP_LM_STUDIO_URL,
      },
      Version: versionHash,
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2)).then(() => {
      alert('Debug information copied to clipboard!');
    });
  };

  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAllChats = async () => {
    if (!db) {
      toast.error('Database is not available');
      return;
    }

    try {
      setIsDeleting(true);

      const allChats = await getAll(db);

      // Delete all chats one by one
      await Promise.all(allChats.map((chat) => deleteById(db!, chat.id)));

      toast.success('All chats deleted successfully');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error('Failed to delete chats');
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportAllChats = async () => {
    if (!db) {
      toast.error('Database is not available');
      return;
    }

    try {
      const allChats = await getAll(db);
      const exportData = {
        chats: allChats,
        exportDate: new Date().toISOString(),
      };

      downloadAsJson(exportData, `all-chats-${new Date().toISOString()}.json`);
      toast.success('Chats exported successfully');
    } catch (error) {
      toast.error('Failed to export chats');
      console.error(error);
    }
  };

  const versionHash = commit.commit; // Get the version hash from commit.json

  const handleSaveConnection = () => {
    Cookies.set('githubUsername', githubUsername);
    Cookies.set('githubToken', githubToken);
    toast.success('GitHub credentials saved successfully!');
  };

  const handleToggleDebug = (enabled: boolean) => {
    setIsDebugEnabled(enabled);
    Cookies.set('isDebugEnabled', String(enabled));
  };

  const handleToggleLocalModels = (enabled: boolean) => {
    setIsLocalModelsEnabled(enabled);
    Cookies.set('isLocalModelsEnabled', String(enabled));
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild onClick={onClose}>
          <motion.div
            className="bg-black/50 fixed inset-0 z-max backdrop-blur-sm"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogBackdropVariants}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content asChild>
          <motion.div
            className="fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] border border-bolt-elements-borderColor rounded-lg shadow-lg focus:outline-none overflow-hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
          >
            <div className="flex h-full">
              <div
                className={classNames(
                  'w-48 border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4 flex flex-col justify-between',
                  styles['settings-tabs'],
                )}
              >
                <DialogTitle className="flex-shrink-0 text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                  Settings
                </DialogTitle>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={classNames(activeTab === tab.id ? styles.active : '')}
                  >
                    <div className={tab.icon} />
                    {tab.label}
                  </button>
                ))}
                <div className="mt-auto flex flex-col gap-2">
                  <a
                    href="https://github.com/coleam00/bolt.new-any-llm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(styles['settings-button'], 'flex items-center gap-2')}
                  >
                    <div className="i-ph:github-logo" />
                    GitHub
                  </a>
                  <a
                    href="https://coleam00.github.io/bolt.new-any-llm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(styles['settings-button'], 'flex items-center gap-2')}
                  >
                    <div className="i-ph:book" />
                    Docs
                  </a>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-8 pt-10 bg-bolt-elements-background-depth-2">
                <div className="flex-1 overflow-y-auto">
                  {activeTab === 'chat-history' && (
                    <div className="p-4">
                      <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Chat History</h3>
                      <button
                        onClick={handleExportAllChats}
                        className={classNames(
                          'bg-bolt-elements-button-primary-background',
                          'rounded-lg px-4 py-2 mb-4 transition-colors duration-200',
                          'hover:bg-bolt-elements-button-primary-backgroundHover',
                          'text-bolt-elements-button-primary-text',
                        )}
                      >
                        Export All Chats
                      </button>

                      <div
                        className={classNames(
                          'text-bolt-elements-textPrimary rounded-lg py-4 mb-4',
                          styles['settings-danger-area'],
                        )}
                      >
                        <h4 className="font-semibold">Danger Area</h4>
                        <p className="mb-2">This action cannot be undone!</p>
                        <button
                          onClick={handleDeleteAllChats}
                          disabled={isDeleting}
                          className={classNames(
                            'bg-bolt-elements-button-danger-background',
                            'rounded-lg px-4 py-2 transition-colors duration-200',
                            isDeleting
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-bolt-elements-button-danger-backgroundHover',
                            'text-bolt-elements-button-danger-text',
                          )}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete All Chats'}
                        </button>
                      </div>
                    </div>
                  )}
                  {activeTab === 'providers' && (
                    <div className="p-4">
                      <div className="flex mb-4">
                        <input
                          type="text"
                          placeholder="Search providers..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
                        />
                      </div>
                      {filteredProviders.map((provider) => (
                        <div
                          key={provider.name}
                          className="flex flex-col mb-2 provider-item hover:bg-bolt-elements-bg-depth-3 p-4 rounded-lg border border-bolt-elements-borderColor "
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-bolt-elements-textPrimary">{provider.name}</span>
                            <Switch
                              className="ml-auto"
                              checked={provider.isEnabled}
                              onCheckedChange={(enabled) => handleToggleProvider(provider.name, enabled)}
                            />
                          </div>
                          {/* Base URL input for configurable providers */}
                          {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && provider.isEnabled && (
                            <div className="mt-2">
                              <label className="block text-sm text-bolt-elements-textSecondary mb-1">Base URL:</label>
                              <input
                                type="text"
                                value={baseUrls[provider.name]}
                                onChange={(e) => handleBaseUrlChange(provider.name, e.target.value)}
                                placeholder={`Enter ${provider.name} base URL`}
                                className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'features' && (
                    <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg mb-4">
                      <div className="mb-6">
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Optional Features</h3>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-bolt-elements-textPrimary">Debug Info</span>
                          <Switch className="ml-auto" checked={isDebugEnabled} onCheckedChange={handleToggleDebug} />
                        </div>
                      </div>

                      <div className="mb-6 border-t border-bolt-elements-borderColor pt-4">
                        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">
                          Experimental Features
                        </h3>
                        <p className="text-sm text-bolt-elements-textSecondary mb-4">
                          Disclaimer: Experimental features may be unstable and are subject to change.
                        </p>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-bolt-elements-textPrimary">Enable Local Models</span>
                          <Switch
                            className="ml-auto"
                            checked={isLocalModelsEnabled}
                            onCheckedChange={handleToggleLocalModels}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === 'debug' && isDebugEnabled && (
                    <div className="p-4">
                      <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Debug Tab</h3>
                      <button
                        onClick={handleCopyToClipboard}
                        className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 mb-4 transition-colors duration-200"
                      >
                        Copy to Clipboard
                      </button>

                      <h4 className="text-md font-medium text-bolt-elements-textPrimary">System Information</h4>
                      <p className="text-bolt-elements-textSecondary">OS: {navigator.platform}</p>
                      <p className="text-bolt-elements-textSecondary">Browser: {navigator.userAgent}</p>

                      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">Active Features</h4>
                      <ul>
                        {providers
                          .filter((provider) => provider.isEnabled)
                          .map((provider) => (
                            <li key={provider.name} className="text-bolt-elements-textSecondary">
                              {provider.name}
                            </li>
                          ))}
                      </ul>

                      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">Base URLs</h4>
                      <ul>
                        <li className="text-bolt-elements-textSecondary">Ollama: {process.env.REACT_APP_OLLAMA_URL}</li>
                        <li className="text-bolt-elements-textSecondary">OpenAI: {process.env.REACT_APP_OPENAI_URL}</li>
                        <li className="text-bolt-elements-textSecondary">
                          LM Studio: {process.env.REACT_APP_LM_STUDIO_URL}
                        </li>
                      </ul>

                      <h4 className="text-md font-medium text-bolt-elements-textPrimary mt-4">Version Information</h4>
                      <p className="text-bolt-elements-textSecondary">Version Hash: {versionHash}</p>
                    </div>
                  )}
                  {activeTab === 'connection' && (
                    <div className="p-4 mb-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
                      <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">GitHub Connection</h3>
                      <div className="flex mb-4">
                        <div className="flex-1 mr-2">
                          <label className="block text-sm text-bolt-elements-textSecondary mb-1">
                            GitHub Username:
                          </label>
                          <input
                            type="text"
                            value={githubUsername}
                            onChange={(e) => setGithubUsername(e.target.value)}
                            className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm text-bolt-elements-textSecondary mb-1">
                            Personal Access Token:
                          </label>
                          <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
                          />
                        </div>
                      </div>
                      <div className="flex mb-4">
                        <button
                          onClick={handleSaveConnection}
                          className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text"
                        >
                          Save Connection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <RadixDialog.Close asChild onClick={onClose}>
              <IconButton icon="i-ph:x" className="absolute top-[10px] right-[10px]" />
            </RadixDialog.Close>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
