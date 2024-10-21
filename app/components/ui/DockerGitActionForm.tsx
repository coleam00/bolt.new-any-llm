import { useState } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';

export function DockerGitActionForm({ artifactId }: { artifactId: string }) {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [branchName, setBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [pullRequestTitle, setPullRequestTitle] = useState('');
  const [pullRequestBody, setPullRequestBody] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actionId = generateUniqueId();

    workbenchStore.addAction({
      artifactId,
      messageId: 'some-message-id', // Replace with actual message ID
      actionId,
      action: {
        type: 'git',
        repositoryUrl,
        branchName,
        commitMessage,
        pullRequestTitle,
        pullRequestBody,
        token,
      },
    });

    // Reset form
    setRepositoryUrl('');
    setBranchName('');
    setCommitMessage('');
    setPullRequestTitle('');
    setPullRequestBody('');
    setToken('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Repository URL:</label>
        <input value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} required />
      </div>
      <div>
        <label>Branch Name:</label>
        <input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
      </div>
      <div>
        <label>Commit Message:</label>
        <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} />
      </div>
      <div>
        <label>Pull Request Title:</label>
        <input value={pullRequestTitle} onChange={(e) => setPullRequestTitle(e.target.value)} />
      </div>
      <div>
        <label>Pull Request Body:</label>
        <textarea value={pullRequestBody} onChange={(e) => setPullRequestBody(e.target.value)} />
      </div>
      <div>
        <label>GitHub Token:</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          placeholder="Personal Access Token"
        />
      </div>
      <button type="submit">Run Git Action</button>
    </form>
  );
}

// Utility function to generate unique IDs
function generateUniqueId(): string {
  return Math.random().toString(36).substr(2, 9);
}

