import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import { Octokit } from "@octokit/rest";

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const [isSyncing, setIsSyncing] = useState(false);
  const [isGitHubPushing, setIsGitHubPushing] = useState(false);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);
  const [githubRepoName, setGithubRepoName] = useState('bolt-generated-project');
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [isNewBranch, setIsNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);

  const setSelectedView = (view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  };

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore.saveCurrentDocument().catch(() => {
      toast.error('Failed to update file content');
    });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  const handleSyncFiles = useCallback(async () => {
    setIsSyncing(true);

    try {
      const directoryHandle = await window.showDirectoryPicker();
      await workbenchStore.syncFiles(directoryHandle);
      toast.success('Files synced successfully');
    } catch (error) {
      console.error('Error syncing files:', error);
      toast.error('Failed to sync files');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const isValidBranchName = (branchName: string) => {
    // Git branch names must not contain these characters: ~ ^ : ? * [ \ and must not end with a dot.
    const invalidCharacters = /[~^:?*[\]\\]/;
    return branchName.length > 0 && !invalidCharacters.test(branchName) && !branchName.endsWith('.');
  };
  
  const handleGitHubPush = useCallback(async () => {
    if (!githubRepoName || !githubUsername || !githubToken) {
      toast.error('Please fill in all GitHub details');
      return;
    }
  
    if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      toast.error('Invalid token format. Please use a GitHub Personal Access Token');
      return;
    }
  
    if (isNewBranch) {
      if (!newBranchName) {
        toast.error('Please enter a name for the new branch');
        return;
      }
      if (!isValidBranchName(newBranchName)) {
        toast.error('Invalid branch name. Please ensure it does not contain invalid characters or end with a dot.');
        return;
      }
    }
  
    setIsGitHubPushing(true);
    try {
      const repoUrl = await workbenchStore.pushToGitHub(
        githubRepoName.trim(),
        githubUsername.trim(),
        githubToken.trim(),
        isPrivateRepo,
        isNewBranch ? newBranchName.trim() : undefined,
        isNewBranch
      );
  
      toast.success(
        <div>
          Successfully pushed to GitHub!{' '}
          <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="underline">
            View Repository
          </a>
        </div>
      );
      setShowGitHubDialog(false);
    } catch (error) {
      console.error('GitHub push error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to push to GitHub';
  
      // Add specific error handling for common cases
      if (errorMessage.includes('Repository does not exist')) {
        toast.error('Cannot create a new branch in a non-existent repository. Please create the repository first.');
      } else if (errorMessage.includes('rate limit')) {
        toast.error('GitHub API rate limit exceeded. Please try again later.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsGitHubPushing(false);
    }
  }, [githubRepoName, githubUsername, githubToken, isPrivateRepo, isNewBranch, newBranchName]);

  const handleCancelPush = useCallback(() => {
    if (isGitHubPushing) {
      // Cancel the ongoing push operation
      setIsGitHubPushing(false);
      toast.info('GitHub push operation cancelled');
    }
    setShowGitHubDialog(false);
  }, [isGitHubPushing]);

  const fetchBranches = useCallback(async () => {
    if (!githubUsername || !githubToken || !githubRepoName) return;
    
    try {
      const octokit = new Octokit({ auth: githubToken });
      const { data } = await octokit.rest.repos.listBranches({
        owner: githubUsername,
        repo: githubRepoName
      });
      setBranches(data.map(branch => branch.name));
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([]);
    }
  }, [githubUsername, githubToken, githubRepoName]);

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <DialogRoot open={showGitHubDialog} onOpenChange={setShowGitHubDialog}>
          <Dialog>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <div className="i-ph:github-logo text-xl" />
                Push to GitHub
              </div>
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-4">
                <div className="text-sm text-bolt-elements-textSecondary">
                  Push your project to a new or existing GitHub repository. You'll need a GitHub account and a personal access token with repo permissions.
                </div>
                
                {/* Repository Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">Repository Name</label>
                  <input
                    type="text"
                    value={githubRepoName}
                    onChange={(e) => setGithubRepoName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-bolt-elements-background-depth-1 focus:outline-none focus:ring-2 focus:ring-bolt-elements-button-primary-background"
                    placeholder="bolt-generated-project"
                  />
                </div>

                {/* GitHub Username */}
                <div>
                  <label className="block text-sm font-medium mb-1">GitHub Username</label>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-bolt-elements-background-depth-1 focus:outline-none focus:ring-2 focus:ring-bolt-elements-button-primary-background"
                    placeholder="username"
                  />
                </div>

                {/* Repository Visibility */}
                <div>
                  <label className="block text-sm font-medium mb-2">Repository Visibility</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!isPrivateRepo}
                        onChange={() => setIsPrivateRepo(false)}
                        className="mr-2"
                      />
                      Public
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={isPrivateRepo}
                        onChange={() => setIsPrivateRepo(true)}
                        className="mr-2"
                      />
                      Private
                    </label>
                  </div>
                </div>

                {/* Branch Options */}
                <div>
                  <label className="block text-sm font-medium mb-2">Branch Options</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!isNewBranch}
                        onChange={() => setIsNewBranch(false)}
                        className="mr-2"
                      />
                      Default Branch (main)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={isNewBranch}
                        onChange={() => setIsNewBranch(true)}
                        className="mr-2"
                      />
                      New Branch
                    </label>
                  </div>
                  
                  {isNewBranch && (
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-bolt-elements-background-depth-1 focus:outline-none focus:ring-2 focus:ring-bolt-elements-button-primary-background"
                      placeholder="Enter new branch name"
                    />
                  )}
                </div>

                {/* Personal Access Token */}
                <div>
                  <label className="block text-sm font-medium mb-1">Personal Access Token</label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-bolt-elements-background-depth-1 focus:outline-none focus:ring-2 focus:ring-bolt-elements-button-primary-background"
                    placeholder="ghp_xxxxxxxxxxxx"
                  />
                  <a 
                    href="https://github.com/settings/tokens/new"
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="text-xs text-bolt-elements-textSecondary hover:underline mt-1 inline-block"
                  >
                    Generate a new token
                  </a>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <DialogButton type="secondary" onClick={handleCancelPush}>
                    Cancel
                  </DialogButton>
                  <DialogButton type="primary" onClick={handleGitHubPush}>
                    {isGitHubPushing ? (
                      <>
                        <div className="i-ph:spinner animate-spin mr-2" />
                        Pushing...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:github-logo mr-2" />
                        Push to GitHub
                      </>
                    )}
                  </DialogButton>
                </div>
              </div>
            </DialogDescription>
          </Dialog>
        </DialogRoot>

        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
            {
              'left-[var(--workbench-left)]': showWorkbench,
              'left-[100%]': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-6">
            <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
                <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                <div className="ml-auto" />
                {selectedView === 'code' && (
                  <>
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        workbenchStore.downloadZip();
                      }}
                    >
                      <div className="i-ph:code" />
                      Download Code
                    </PanelHeaderButton>
                    <PanelHeaderButton className="mr-1 text-sm" onClick={handleSyncFiles} disabled={isSyncing}>
                      {isSyncing ? <div className="i-ph:spinner animate-spin" /> : <div className="i-ph:cloud-arrow-down" />}
                      {isSyncing ? 'Syncing...' : 'Sync Files'}
                    </PanelHeaderButton>
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                      }}
                    >
                      <div className="i-ph:terminal" />
                      Toggle Terminal
                    </PanelHeaderButton>
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => setShowGitHubDialog(true)}
                    >
                      <div className="i-ph:github-logo" />
                      Push to GitHub
                    </PanelHeaderButton>
                  </>
                )}
                <IconButton
                  icon="i-ph:x-circle"
                  className="-mr-1"
                  size="xl"
                  onClick={() => {
                    workbenchStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <View
                  initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
                  animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
                >
                  <EditorPanel
                    editorDocument={currentDocument}
                    isStreaming={isStreaming}
                    selectedFile={selectedFile}
                    files={files}
                    unsavedFiles={unsavedFiles}
                    onFileSelect={onFileSelect}
                    onEditorScroll={onEditorScroll}
                    onEditorChange={onEditorChange}
                    onFileSave={onFileSave}
                    onFileReset={onFileReset}
                  />
                </View>
                <View
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <Preview />
                </View>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
