export type ActionType = 'shell' | 'file' | 'docker' | 'git';

export interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

export interface DockerAction extends BaseAction {
  type: 'docker';
  image: string;
  command: string[];
  env?: Record<string, string>;
}

export interface GitAction extends BaseAction {
  type: 'git';
  repositoryUrl: string;
  branchName?: string;
  commitMessage?: string;
  pullRequestTitle?: string;
  pullRequestBody?: string;
  token: string; // GitHub Personal Access Token
}

export type BoltAction = ShellAction | FileAction | DockerAction | GitAction;

export type BoltActionData = BoltAction | BaseAction;
