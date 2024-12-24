import type { GitProvider, GitProviderAPI, GitPushResult } from '~/lib/git/types';
import axios, { Axios } from 'axios';

export const gitlabProvider: GitProvider = {
  name: 'gitlab',
  title: 'GitLab',
  url: 'gitlab.com',
  instructions: 'Create a Personal Access Token with api and write_repository scopes:',
  tokenSetupSetupUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
  tokenSetupSteps: [
    '1. Go to GitLab Settings > Access Tokens',
    '2. Create a new token with "api" and "write_repository" scopes',
    '3. Generate and copy the token',
  ],
  icon: 'i-ph:gitlab-logo-duotone',
};

let project: { id?: any; default_branch?: any; branch?: string; web_url?: any };
let gitlab: Axios;

export const gitlabAPI: GitProviderAPI = {
  setToken(token: string) {
    gitlab = axios.create({
      baseURL: 'https://gitlab.com/api/v4',
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  },
  async checkFileExistence(branchName: string, filePath: string): Promise<boolean> {
    try {
      await gitlab.get(`/projects/${project.id}/repository/files/${encodeURIComponent(filePath)}`, {
        params: {
          ref: branchName,
        },
      });

      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
        return false;
      } else {
        console.error('Error checking file existence:', error);
        throw error;
      }
    }
  },
  async push(files: Record<string, string>): Promise<GitPushResult> {
    return await this.createCommit(files, 'feat: initial commit');
  },
  async validateCredentials(username: string): Promise<boolean> {
    try {
      const response = await gitlab.get('/user');

      if (response.status !== 200) {
        return false;
      }

      const data: { username: string } = response.data;

      return data.username === username;
    } catch (error) {
      console.error('Error validating GitLab credentials:', error);
      return false;
    }
  },
  async getRepo(repoName: string, username: string): Promise<any> {
    try {
      const { data } = await gitlab.get(`/projects/${encodeURIComponent(`${username}/${repoName}`)}`);
      project = data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }

      console.error('Error getting GitLab repo:', error);

      return null;
    }
    return true;
  },
  async createCommit(files: Record<string, string>, commitMessage: string): Promise<any> {
    try {
      const actions: { action: string; file_path: string; content: string }[] = [];
      const branchToUse = project.branch || project.default_branch || 'main';

      if (!branchToUse) {
        throw new Error('No branch specified and no default branch found for project.');
      }

      for (const [filePath, content] of Object.entries(files)) {
        const fileExists = await this.checkFileExistence(branchToUse, filePath);

        const action = {
          action: fileExists ? 'update' : 'create',
          file_path: filePath,
          content,
        };

        actions.push(action);
      }

      const commitData = {
        branch: branchToUse,
        commit_message: commitMessage,
        actions,
      };

      const { data } = await gitlab.post(`/projects/${project.id}/repository/commits`, commitData);
      project = data;
    } catch (error) {
      console.error('Error creating commit:', error);
      throw error;
    }
  },
  async createBranch(branchName: string, ref: string): Promise<any> {
    try {
      const branchData = {
        branch: branchName,
        ref,
      };

      const { data } = await gitlab.post(`/projects/${project.id}/repository/branches`, branchData);
      project = data;
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  },
  async createMergeRequest(sourceBranch: string, targetBranch: string, title: string): Promise<any> {
    try {
      const mergeRequestData = {
        source_branch: sourceBranch,
        target_branch: targetBranch,
        title,
      };

      const { data } = await gitlab.post(`/projects/${project.id}/merge_requests`, mergeRequestData);
      project = data;
    } catch (error) {
      console.error('Error creating merge request:', error);
      throw error;
    }
  },
  async createRepo(repoName: string): Promise<any> {
    try {
      const { data } = await gitlab.post('/projects', {
        name: repoName,
        initialize_with_readme: true,
      });
      project = data;
    } catch (error) {
      console.error('Error creating repo:', error);
      throw error;
    }
  },
  async pushWithRepoHandling(
    repoName: string,
    username: string,
    files: Record<string, string>,
    token: string,
  ): Promise<any> {
    try {
      this.setToken(token);
      project = { id: undefined, default_branch: undefined, web_url: undefined };
      await this.getRepo(repoName, username);

      if (!project.id) {
        const shouldCreate = confirm(`Repository "${repoName}" doesn't exist. Would you like to create it?`);

        if (!shouldCreate) {
          throw new Error('Repository creation cancelled');
        }

        if (repoName) {
          await this.createRepo(repoName);

          if (project.id) {
            await this.push(files);
          } else {
            throw new Error('Failed to create new repository.');
          }
        } else {
          throw new Error('Repository name is required.');
        }

        return {
          success: true,
          message: `Repository created and code pushed: ${project.web_url}`,
        };
      }

      const commitMsg = prompt('Enter commit message:');

      if (commitMsg) {
        await this.createCommit(files, commitMsg);
        return {
          success: true,
          message: `Successfully commit to: ${project.web_url}`,
        };
      } else {
        throw new Error('Commit message is required.');
      }
    } catch (error: any) {
      console.error('Error pushing to GitLab:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  },
};
