export interface GitProvider {
  name: string;
  title: string;
  url: string;
  instructions: string;
  tokenSetupSetupUrl: string;
  tokenSetupSteps: string[];
  icon: string; // CSS class name for the icon
}

export interface GitPushResult {
  success: boolean;
  message: string;
}

export interface GitProviderAPI {
  setToken(token: string): void;
  checkFileExistence(branchName: string, filePath: string): Promise<boolean>;
  push(files: Record<string, string>): Promise<GitPushResult>;
  validateCredentials(username: string, token: string): Promise<boolean>;
  getRepo(repoName: string, username: string): Promise<any>;
  createCommit(files: Record<string, string>, commitMessage: string): Promise<any>;
  createBranch(branchName: string, ref: string): Promise<any>;
  createMergeRequest(sourceBranch: string, targetBranch: string, title: string): Promise<any>;
  createRepo(repoName: string): Promise<any>;
  pushWithRepoHandling(repoName: string, username: string, files: Record<string, string>, token: string): Promise<any>;
}

export interface GitProviderPlugin {
  provider: GitProvider;
  api: GitProviderAPI;
}
