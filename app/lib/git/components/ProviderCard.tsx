import React from 'react';
import type { GitProvider } from '~/lib/git/types';

interface ProviderCardProps {
  provider: GitProvider;
  credentials: {
    username: string;
    token: string;
    isConnected: boolean;
    isVerifying: boolean;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateCredentials: (updates: { username?: string; token?: string }) => void;
  onSave: () => void;
  onDisconnect: () => void;
}

export function ProviderCard({
  provider,
  credentials,
  isExpanded,
  onToggle,
  onUpdateCredentials,
  onSave,
  onDisconnect,
}: ProviderCardProps) {
  return (
    <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center">
          <div className={`${provider.icon} text-2xl mr-3 text-bolt-elements-textPrimary`} />
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{provider.title} Connection</h3>
          {credentials.username && (
            <span className="ml-2 text-sm text-bolt-elements-textSecondary">({credentials.username})</span>
          )}
        </div>
        <div className="flex items-center">
          {credentials.isConnected && (
            <div className="flex items-center mr-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <span className="text-sm text-bolt-elements-textSecondary">Connected</span>
            </div>
          )}
          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <div className="i-ph:caret-down text-bolt-elements-textSecondary" />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4">
          <div className="mb-4 p-3 bg-bolt-elements-background-depth-4 rounded border border-bolt-elements-borderColor">
            <p className="text-sm text-bolt-elements-textSecondary mb-2">{provider.instructions}</p>
            <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
              {provider.tokenSetupSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
            <p>
              <a
                href={provider.tokenSetupSetupUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-500 hover:underline"
              >
                {provider.tokenSetupSetupUrl}
              </a>
            </p>
          </div>

          <div className="flex mb-4">
            <div className="flex-1 mr-2">
              <label className="block text-sm text-bolt-elements-textSecondary mb-1">{provider.title} Username:</label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => onUpdateCredentials({ username: e.target.value })}
                disabled={credentials.isVerifying}
                className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-bolt-elements-textSecondary mb-1">Personal Access Token:</label>
              <input
                type="password"
                value={credentials.token}
                onChange={(e) => onUpdateCredentials({ token: e.target.value })}
                disabled={credentials.isVerifying}
                className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
              />
            </div>
          </div>

          <div className="flex">
            {!credentials.isConnected ? (
              <button
                onClick={onSave}
                disabled={credentials.isVerifying || !credentials.username || !credentials.token}
                className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text"
              >
                {credentials.isVerifying ? (
                  <>
                    <div className="i-ph:spinner animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="bg-red-500 text-white rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-red-600"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
