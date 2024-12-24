import { Octokit } from '@octokit/rest';
import type { GitProvider, GitProviderAPI, GitPushResult } from '~/lib/git/types';
import type { Endpoints } from '@octokit/types';

export const githubProvider: GitProvider = {
  name: 'github',
  title: 'GitHub',
  url: 'github.com',
  instructions: 'Create a Personal Access Token with repo scope:',
  tokenSetupSetupUrl: 'https://github.com/settings/tokens',
  tokenSetupSteps: [
    '1. Go to GitHub Settings > Developer settings > Personal access tokens',
    '2. Generate a new token with "repo" scope',
    '3. Copy the token',
  ],
  icon: 'i-ph:github-logo-duotone',
};

let project: Endpoints['GET /repos/{owner}/{repo}']['response']['data'] | any = null;
let octokit: Octokit;

export const githubAPI: GitProviderAPI = {
  setToken(token: string) {
    octokit = new Octokit({ auth: token });
  },
  async checkFileExistence(branchName: string, filePath: string): Promise<boolean> {
    if (!project) {
      throw new Error('Project not set. Please call getRepo first.');
    }

    try {
      await octokit.repos.getContent({
        owner: project.owner.login,
        repo: project.name,
        path: filePath,
        ref: branchName,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }

      console.error('Error checking file existence:', error);
      throw error;
    }
  },
  async push(files: Record<string, string>): Promise<GitPushResult> {
    return await this.createCommit(files, 'feat: initial commit');
  },
  async validateCredentials(username: string, token: string): Promise<boolean> {
    this.setToken(token);

    try {
      const { data } = await octokit.users.getAuthenticated();
      return data.login === username;
    } catch (error) {
      console.error('Error validating GitHub credentials:', error);
      return false;
    }
  },
  async getRepo(repoName: string, username: string): Promise<any> {
    try {
      const { data } = await octokit.repos.get({
        owner: username,
        repo: repoName,
      });
      project = data;

      return project;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }

      console.error('Error getting GitHub repo:', error);

      return null;
    }
  },
  async createCommit(files: Record<string, string>, commitMessage: string): Promise<any> {
    if (!project) {
      throw new Error('Project not set. Please call getRepo first.');
    }

    try {
      const branchToUse = project.default_branch || 'main';

      const tree = await octokit.git.createTree({
        owner: project.owner.login,
        repo: project.name,
        tree: Object.entries(files).map(([path, content]) => ({
          path,
          mode: '100644', // blob (file)
          type: 'blob',
          content,
        })),
        base_tree: project.default_branch,
      });

      const commit = await octokit.git.createCommit({
        owner: project.owner.login,
        repo: project.name,
        message: commitMessage,
        tree: tree.data.sha,
        parents: project.default_branch
          ? [
              (
                await octokit.git.getRef({
                  owner: project.owner.login,
                  repo: project.name,
                  ref: `heads/${project.default_branch}`,
                })
              ).data.object.sha,
            ]
          : [],
      });
      await octokit.git.updateRef({
        owner: project.owner.login,
        repo: project.name,
        ref: `heads/${branchToUse}`,
        sha: commit.data.sha,
      });
    } catch (error) {
      console.error('Error creating commit:', error);
      throw error;
    }
  },
  async createBranch(branchName: string, ref: string): Promise<any> {
    if (!project) {
      throw new Error('Project not set. Please call getRepo first.');
    }

    try {
      await octokit.git.createRef({
        owner: project.owner.login,
        repo: project.name,
        ref: `refs/heads/${branchName}`,
        sha: ref,
      });
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  },
  async createMergeRequest(sourceBranch: string, targetBranch: string, title: string): Promise<any> {
    if (!project) {
      throw new Error('Project not set. Please call getRepo first.');
    }

    try {
      await octokit.pulls.create({
        owner: project.owner.login,
        repo: project.name,
        head: sourceBranch,
        base: targetBranch,
        title,
      });
    } catch (error) {
      console.error('Error creating merge request:', error);
      throw error;
    }
  },
  async createRepo(repoName: string): Promise<any> {
    try {
      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        auto_init: true,
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
      project = null;
      await this.getRepo(repoName, username);

      if (!project) {
        const shouldCreate = confirm(`Repository "${repoName}" doesn't exist. Would you like to create it?`);

        if (!shouldCreate) {
          throw new Error('Repository creation cancelled');
        }

        await this.createRepo(repoName);

        if (project) {
          await this.push(files);
        } else {
          throw new Error('Failed to create new repository.');
        }

        return {
          success: true,
          message: `Repository created and code pushed: ${project.html_url}`,
        };
      }

      const commitMsg = prompt('Enter commit message:');

      if (commitMsg) {
        try {
          await this.createCommit(files, commitMsg);
          return {
            success: true,
            message: `Successfully commit to: ${project.html_url}`,
          };
        } catch (error: any) {
          if (error.message.includes('Update is not a fast-forward')) {
            console.error('Error: Update is not a fast-forward. Consider pulling changes first.');

            const pull = confirm('Do you want to pull changes and try pushing again?');

            if (pull) {
              try {
                await this.getRepo(repoName, username);
                await this.pushWithRepoHandling(repoName, username, files, token);
              } catch (pullError) {
                console.error('Error pulling changes:', pullError);
                return {
                  success: false,
                  message: `Error pulling changes: ${(pullError as Error).message}`,
                };
              }
            } else {
              return {
                success: false,
                message: 'Push failed. Consider pulling changes and trying again.',
              };
            }
          } else {
            throw error; // Re-throw other errors
          }
        }
      } else {
        throw new Error('Commit message is required.');
      }

      return {
        success: true,
        message: `Successfully commit to: ${project.html_url}`,
      };
    } catch (error: any) {
      console.error('Error pushing to GitHub:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  },
};
