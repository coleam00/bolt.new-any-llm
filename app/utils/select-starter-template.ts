import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';

interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags?: string[];
}

const starterTemplateSelectionPrompt = (templates: Template[]) => `
You are an experienced developer who helps people choose the best starter template for their projects.

Available templates:
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
</template>
${templates
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  ${template.tags ? `<tags>${template.tags.join(', ')}</tags>` : ''}
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <reasoning>{brief explanation for the choice}</reasoning>
</selection>

Examples:

<example>
User: I need to build a todo app
Response:
<selection>
  <templateName>react-basic-starter</templateName>
  <reasoning>Simple React setup perfect for building a todo application</reasoning>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <reasoning>This is a simple script that doesn't require any template setup</reasoning>
</selection>
</example>

Instructions:
1. For trivial tasks and simple scripts, always recommend the blank template
2. For more complex projects, recommend templates from the provided list
3. Follow the exact XML format
4. Consider both technical requirements and tags
5. If no perfect match exists, recommend the closest option

Important: Provide only the selection tags in your response, no additional text.
`;

// Example usage:
const templates: Template[] = [
  {
    name: 'vite-react-tailwind-ts',
    description:
      'A modern React template built with Vite, TypeScript, and TailwindCSS. Features hot module replacement, optimized build setup, TypeScript for type safety, and TailwindCSS for utility-first styling. Includes ESLint and Prettier configurations for code quality, and Jest with React Testing Library for testing. Perfect for building scalable React applications with a focus on developer experience.',
    label: 'Vite React TS',
    githubRepo: 'thecodacus/vite-react-ts-template',
    tags: ['react', 'vite', 'typescript', 'tailwindcss', 'testing', 'eslint'],
  },
];

const parseSelectedTemplate = (llmOutput: string): string | null => {
  try {
    // Extract content between <templateName> tags
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);

    if (!templateNameMatch) {
      return null;
    }

    return templateNameMatch[1].trim();
  } catch (error) {
    console.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;
  const requestBody = {
    message,
    model,
    provider,
    system: starterTemplateSelectionPrompt(templates),
  };
  const response = await fetch('/api/llmcall', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  const respJson: { text: string } = await response.json();
  console.log(respJson);

  const { text } = respJson;
  const selectedTemplate = parseSelectedTemplate(text);

  if (selectedTemplate) {
    return selectedTemplate;
  } else {
    console.log('No template selected, using blank template');

    return 'blank';
  }
};

const getGitHubRepoContent = async (
  repoName: string,
  path: string = '',
): Promise<{ name: string; path: string; content: string }[]> => {
  const baseUrl = 'https://api.github.com';

  try {
    // Fetch contents of the path
    const response = await fetch(`${baseUrl}/repos/${repoName}/contents/${path}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',

        // Add your GitHub token if needed
        Authorization: 'token ' + import.meta.env.VITE_GITHUB_ACCESS_TOKEN,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any = await response.json();

    // If it's a single file, return its content
    if (!Array.isArray(data)) {
      if (data.type === 'file') {
        // If it's a file, get its content
        const content = atob(data.content); // Decode base64 content
        return [
          {
            name: data.name,
            path: data.path,
            content,
          },
        ];
      }
    }

    // Process directory contents recursively
    const contents = await Promise.all(
      data.map(async (item: any) => {
        if (item.type === 'dir') {
          // Recursively get contents of subdirectories
          return await getGitHubRepoContent(repoName, item.path);
        } else if (item.type === 'file') {
          // Fetch file content
          const fileResponse = await fetch(item.url, {
            headers: {
              Accept: 'application/vnd.github.v3+json',
              Authorization: 'token ' + import.meta.env.VITE_GITHUB_ACCESS_TOKEN,
            },
          });
          const fileData: any = await fileResponse.json();
          const content = atob(fileData.content); // Decode base64 content

          return [
            {
              name: item.name,
              path: item.path,
              content,
            },
          ];
        }

        return [];
      }),
    );

    // Flatten the array of contents
    return contents.flat();
  } catch (error) {
    console.error('Error fetching repo contents:', error);
    throw error;
  }
};

export async function getTemplates(templateName: string) {
  const template = templates.find((t) => t.name == templateName);

  if (!template) {
    return null;
  }

  const githubRepo = template.githubRepo;
  const files = await getGitHubRepoContent(githubRepo);

  let filteredFiles = files;

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

  // exclude    lock files
  const comminLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  filteredFiles = filteredFiles.filter((x) => comminLockFiles.includes(x.name) == false);

  // exclude    .bolt
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);

  // check for ignore file in .bolt folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  const assistantMessage = `
<boltArtifact id="imported-files" title="Importing Starter Files" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;
  let userMessage = ``;
  const templatePromptFile = files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt');

  if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

IMPORTANT: Dont Forget to install the dependencies before running the app
---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
    userMessage += `
Now that the Template is imported please continue with my original request
`;
  }

  return {
    assistantMessage,
    userMessage,
  };
}
