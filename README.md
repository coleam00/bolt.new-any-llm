[![Bolt.new: AI-Powered Full-Stack Web Development in the Browser](./public/social_preview_index.jpg)](https://bolt.new)

# Bolt.new Fork by Cole Medin

This fork of bolt.new allows you to choose the LLM that you use for each prompt! Currently you can use OpenAI, Anthropic, Ollama, OpenRouter, Gemini, or Groq models - and it is easily extended to use any other model supported by the Vercel AI SDK! See instructions below for running this locally and extending to include more models.

# Requested Additions to this Fork - Feel Free to Contribute!!

- ✅ OpenRouter Integration (@coleam00)
- ✅ Gemini Integration (@jonathands)
- ✅ Autogenerate Ollama models from what is downloaded (@mosquet)
- ✅ Filter models by provider (@jasonm23)
- ✅ Download project as ZIP (@fabwaseem)
- ⬜ LM Studio Integration
- ⬜ DeepSeek API Integration
- ⬜ Together Integration
- ⬜ Azure Open AI API Integration
- ⬜ HuggingFace Integration
- ⬜ Perplexity Integration
- ⬜ Containerize the application with Docker for easy installation
- ⬜ Better prompting for smaller LLMs (code window sometimes doesn't start)
- ⬜ Attach images to prompts
- ⬜ Run agents in the backend instead of a single model call
- ⬜ Publish projects directly to GitHub
- ⬜ Deploy directly to Vercel/Netlify/other similar platforms
- ⬜ Load local projects into the app
- ⬜ Improvements to the main Bolt.new prompt in `app\lib\.server\llm\prompts.ts` (there is definitely opportunity there)
- ⬜ Ability to revert code to earlier version
- ⬜ Prompt caching
- ⬜ Ability to entire API keys in the UI
- ⬜ Prevent Bolt from rewriting files so often

# Bolt.new: AI-Powered Full-Stack Web Development in the Browser

Bolt.new is an AI-powered web development agent that allows you to prompt, run, edit, and deploy full-stack applications directly from your browser—no local setup required. If you're here to build your own AI-powered web dev agent using the Bolt open source codebase, [click here to get started!](./CONTRIBUTING.md)

## What Makes Bolt.new Different

Claude, v0, etc are incredible- but you can't install packages, run backends or edit code. That’s where Bolt.new stands out:

- **Full-Stack in the Browser**: Bolt.new integrates cutting-edge AI models with an in-browser development environment powered by **StackBlitz’s WebContainers**. This allows you to:
  - Install and run npm tools and libraries (like Vite, Next.js, and more)
  - Run Node.js servers
  - Interact with third-party APIs
  - Deploy to production from chat
  - Share your work via a URL

- **AI with Environment Control**: Unlike traditional dev environments where the AI can only assist in code generation, Bolt.new gives AI models **complete control** over the entire  environment including the filesystem, node server, package manager, terminal, and browser console. This empowers AI agents to handle the entire app lifecycle—from creation to deployment.

Whether you’re an experienced developer, a PM or designer, Bolt.new allows you to build production-grade full-stack applications with ease.

For developers interested in building their own AI-powered development tools with WebContainers, check out the open-source Bolt codebase in this repo!

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v20.15.1)
- pnpm (v9.4.0)

## Setup

1. Clone the repository (if you haven't already):

```bash
git clone https://github.com/coleam00/bolt.new-any-llm.git
```

2. Install dependencies:

```bash
pnpm install
```

3. Rename `.env.example` to .env.local and add your LLM API keys (you only have to set the ones you want to use and Ollama doesn't need an API key because it runs locally on your computer):

```
GROQ_API_KEY=XXX
OPENAI_API_KEY=XXX
ANTHROPIC_API_KEY=XXX
```

Optionally, you can set the debug level:

```
VITE_LOG_LEVEL=debug
```

**Important**: Never commit your `.env.local` file to version control. It's already included in .gitignore.

## Adding New LLMs:

To make new LLMs available to use in this version of Bolt.new, head on over to `app/utils/constants.ts` and find the constant MODEL_LIST. Each element in this array is an object that has the model ID for the name (get this from the provider's API documentation), a lable for the frontend model dropdown, and the provider. 

By default, Anthropic, OpenAI, Groq, and Ollama are implemented as providers, but the YouTube video for this repo covers how to extend this to work with more providers if you wish!

When you add a new model to the MODEL_LIST array, it will immediately be available to use when you run the app locally or reload it. For Ollama models, make sure you have the model installed already before trying to use it here!

## Available Scripts

- `pnpm run dev`: Starts the development server.
- `pnpm run build`: Builds the project.
- `pnpm run start`: Runs the built application locally using Wrangler Pages. This script uses `bindings.sh` to set up necessary bindings so you don't have to duplicate environment variables.
- `pnpm run preview`: Builds the project and then starts it locally, useful for testing the production build. Note, HTTP streaming currently doesn't work as expected with `wrangler pages dev`.
- `pnpm test`: Runs the test suite using Vitest.
- `pnpm run typecheck`: Runs TypeScript type checking.
- `pnpm run typegen`: Generates TypeScript types using Wrangler.
- `pnpm run deploy`: Builds the project and deploys it to Cloudflare Pages.

## Development

To start the development server:

```bash
pnpm run dev
```

This will start the Remix Vite development server. You will need Google Chrome Canary to run this locally! It's a very easy install and a good browser for web development anyway.

## Tips and Tricks

Here are some tips to get the most out of Bolt.new:

- **Be specific about your stack**: If you want to use specific frameworks or libraries (like Astro, Tailwind, ShadCN, or any other popular JavaScript framework), mention them in your initial prompt to ensure Bolt scaffolds the project accordingly.

- **Use the enhance prompt icon**: Before sending your prompt, try clicking the 'enhance' icon to have the AI model help you refine your prompt, then edit the results before submitting.

- **Scaffold the basics first, then add features**: Make sure the basic structure of your application is in place before diving into more advanced functionality. This helps Bolt understand the foundation of your project and ensure everything is wired up right before building out more advanced functionality.

- **Batch simple instructions**: Save time by combining simple instructions into one message. For example, you can ask Bolt to change the color scheme, add mobile responsiveness, and restart the dev server, all in one go saving you time and reducing API credit consumption significantly.

## Running Backend Agents with Docker

Bolt.new now supports running backend agents within Docker containers. This allows for isolated and reproducible environments for your agents.

### **Prerequisites**

- Docker must be installed and running on your development machine.
- Ensure Docker is accessible to your application (e.g., appropriate permissions).

### **Using Docker Actions**

1. **Create a Docker Action:**
   - Specify the Docker image you want to use.
   - Provide the command to run inside the container.
   - Optionally, add environment variables.

2. **Example:**

   ```json
   {
     "type": "docker",
     "image": "node:14",
     "command": ["node", "agent.js"],
     "env": {
       "API_KEY": "your-api-key"
     }
   }
   ```

3. **Running the Action:**
   - Use the provided Docker Action Form in the UI to create and submit your Docker action.
   - The agent will run inside the specified Docker container, and its input/output will be connected to the LLM's prompt and response mechanisms.

### **Important Notes**

- **Resource Management:** Ensure that Docker containers are properly managed to avoid resource leaks. Containers are automatically stopped when actions are completed or aborted.
- **Security:** Running containers can pose security risks. Ensure that the Docker images you use are from trusted sources and that you handle sensitive information securely.

## Running Backend Agents with Git Integration

Bolt.new now supports Git integration within Docker containers, allowing agents to manage branches and create pull requests seamlessly.

### **Prerequisites**

- Docker must be installed and running on your development machine.
- Git must be available in the Docker containers (using the custom Docker image `my-node-git:latest`).

### **Using Git Actions**

1. **Create a Git Action:**
   - **Repository URL:** The HTTPS URL of your GitHub repository.
   - **Branch Name (Optional):** The name of the branch to create.
   - **Commit Message (Optional):** The commit message for changes.
   - **Pull Request Title (Optional):** The title of the pull request.
   - **Pull Request Body (Optional):** The body description of the pull request.
   - **GitHub Token:** A Personal Access Token with appropriate permissions.

2. **Example:**

   ```json
   {
     "type": "git",
     "repositoryUrl": "https://github.com/your-username/your-repo.git",
     "branchName": "feature/new-feature",
     "commitMessage": "Add new feature",
     "pullRequestTitle": "Add New Feature",
     "pullRequestBody": "This pull request adds a new feature.",
     "token": "your-github-personal-access-token"
   }
   ```

3. **Running the Action:**
   - Use the **Git Action Form** in the UI to input the required details and submit the Git action.
   - The agent will perform the following:
     - Clone the specified repository.
     - Create a new branch (if provided).
     - Commit changes (if a commit message is provided).
     - Push the branch to the remote repository.
     - Create a pull request (if pull request details are provided).

### **Important Notes**

- **Token Security:** For enhanced security, it's recommended to implement OAuth authentication instead of directly using personal access tokens.
- **Permissions:** Ensure your GitHub token has the necessary permissions to perform repository operations such as cloning, pushing, and creating pull requests.
- **Error Handling:** Monitor action statuses to ensure Git operations complete successfully. Errors will be reported if any issues occur during the process.

### **Security Considerations**

- **Sensitive Data:** Avoid exposing sensitive information like GitHub tokens. Implement secure authentication mechanisms to protect user credentials.
- **Repository Access:** Ensure that only authorized agents can perform Git operations on your repositories to maintain code integrity.

### **Contact and Support**

If you encounter any issues or need assistance with Git integration, feel free to open an issue or contact the maintainers for support.
