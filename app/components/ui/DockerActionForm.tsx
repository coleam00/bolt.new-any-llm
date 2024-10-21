import { useState } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';

export function DockerActionForm({ artifactId }: { artifactId: string }) {
  const [image, setImage] = useState('');
  const [command, setCommand] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [envs, setEnvs] = useState<Record<string, string>>({});

  const addEnv = () => {
    if (envKey && envValue) {
      setEnvs({ ...envs, [envKey]: envValue });
      setEnvKey('');
      setEnvValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actionId = generateUniqueId(); // Implement a unique ID generator

    workbenchStore.addAction({
      artifactId,
      messageId: 'some-message-id', // Replace with actual message ID
      actionId,
      action: {
        type: 'docker',
        image,
        command: command.split(' '),
        env: envs,
      },
    });

    // Reset form
    setImage('');
    setCommand('');
    setEnvs({});
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Docker Image:</label>
        <input value={image} onChange={(e) => setImage(e.target.value)} required />
      </div>
      <div>
        <label>Command:</label>
        <input value={command} onChange={(e) => setCommand(e.target.value)} required />
      </div>
      <div>
        <label>Environment Variables:</label>
        <input
          value={envKey}
          onChange={(e) => setEnvKey(e.target.value)}
          placeholder="Key"
        />
        <input
          value={envValue}
          onChange={(e) => setEnvValue(e.target.value)}
          placeholder="Value"
        />
        <button type="button" onClick={addEnv}>
          Add Env
        </button>
      </div>
      <button type="submit">Run Docker Agent</button>
    </form>
  );
}

// Utility function to generate unique IDs
function generateUniqueId(): string {
  return Math.random().toString(36).substr(2, 9);
}

