[![Bolt.new: AI-Powered Full-Stack Web Development in the Browser](./public/social_preview_index.jpg)](https://bolt.new)

---

## Bolt.new Fork by Cole Medin - oTToDev Overview

This fork of Bolt.new (oTToDev) enhances flexibility by allowing you to select your preferred Large Language Model (LLM) for each prompt. Currently, supported models include OpenAI, Anthropic, Ollama, OpenRouter, Gemini, LMStudio, Mistral, xAI, HuggingFace, DeepSeek, and Groq. Additionally, it's easily extensible to support any model compatible with the Vercel AI SDK.

For full documentation, visit the [oTToDev Docs](https://coleam00.github.io/bolt.new-any-llm/).

---

## Community

Join the growing oTToDev community here: [oTToDev community](https://thinktank.ottomator.ai)

---

## Features

- **AI-powered full-stack web development** directly in your browser.
- **Support for multiple LLMs** with an extensible architecture to integrate additional models.
- **Attach images to prompts** for better contextual understanding.
- **Integrated terminal** to view output of LLM-run commands.
- **Revert code to earlier versions** for easier debugging and quicker changes.
- **Download projects as ZIP** for easy portability.
- **Integration-ready Docker support** for a hassle-free setup.

---

## Getting Started

You can quickly explore oTToDev using the [hosted version](https://ottodev.cyopsys.com/). Here is a link to a thread where [aliasfox](https://thinktank.ottomator.ai/t/no-setup-required-batteries-not-included/1852) posted the hosted version mentioned. 

To contribute or self-host, follow the instructions below.

### Quick Start Guide

The Quick Start Guide is below and [here is a link](https://coleam00.github.io/bolt.new-any-llm/#setup) to a more in deph guide if you experance any problems.

#### Prerequisites
- Install [Git](https://git-scm.com/downloads).
- Install [Node.js](https://nodejs.org/en/download/).

#### Clone the Repository
```bash
git clone https://github.com/coleam00/bolt.new-any-llm.git
cd bolt.new-any-llm/
```

#### Running the Application
**Note:** API keys are required for providers (free and paid options are available). Experimental local providers are also supported.

##### Option 1: Run Without Docker
1. Install `pnpm`:
   ```bash
   npm install -g pnpm
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the application:
   ```bash
   pnpm run dev
   ```

##### Option 2: Run With Docker Compose
1. Install [Docker](https://www.docker.com/).
2. Start the application in development mode:
   ```bash
   docker-compose --profile development up
   ```

With Docker, hot reloading applies—changes to the code will automatically reflect in the running container.

## Enabling Providers

To enable providers, navigate to the **Settings** menu and select the one(s) you would like to activate.  
Some model providers are hidden by default because they are experimental. To access them, you will need to enable experimental models in the **Settings** menu.


---

## Available Scripts

- **`pnpm run dev`**: Starts the development server.
- **`pnpm run build`**: Builds the project.
- **`pnpm run start`**: Runs the built application locally using Wrangler Pages.
- **`pnpm run preview`**: Builds and runs the production build locally.
- **`pnpm test`**: Runs the test suite using Vitest.
- **`pnpm run typecheck`**: Runs TypeScript type checking.
- **`pnpm run typegen`**: Generates TypeScript types using Wrangler.
- **`pnpm run deploy`**: Deploys the project to Cloudflare Pages.
- **`pnpm run lint:fix`**: Automatically fixes linting issues.

---

## Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

---

## Roadmap

Explore upcoming features and priorities on our [Roadmap](https://roadmap.sh/r/ottodev-roadmap-2ovzo).

---

## FAQ

For answers to common questions, visit our [FAQ Page](FAQ.md).

---

## Requested Additions

Completed features ✅ and upcoming priorities ⬜:

- ✅ OpenRouter Integration (@coleam00)
- ✅ Gemini Integration (@jonathands)
- ✅ Autogenerate Ollama models from what is downloaded (@yunatamos)
- ✅ Filter models by provider (@jasonm23)
- ✅ Download project as ZIP (@fabwaseem)
- ✅ Improvements to the main Bolt.new prompt in (@kofi-bhr)
- ✅ DeepSeek API Integration (@zenith110)
- ✅ Mistral API Integration (@ArulGandhi)
- ✅ "Open AI Like" API Integration (@ZerxZ)
- ✅ Ability to sync files (one way sync) to local folder (@muzafferkadir)
- ✅ Containerize the application with Docker for easy installation (@aaronbolton)
- ✅ Publish projects directly to GitHub (@goncaloalves)
- ✅ Ability to enter API keys in the UI (@ali00209)
- ✅ xAI Grok Beta Integration (@milutinke)
- ✅ LM Studio Integration (@karrot0)
- ✅ HuggingFace Integration (@ahsan3219)
- ✅ Bolt terminal to see the output of LLM run commands (@thecodacus)
- ✅ Streaming of code output (@thecodacus)
- ✅ Ability to revert code to earlier version (@wonderwhy-er)
- ✅ Cohere Integration (@hasanraiyan)
- ✅ Dynamic model max token length (@hasanraiyan)
- ✅ Better prompt enhancing (@SujalXplores)
- ✅ Prompt caching (@SujalXplores)
- ✅ Load local projects into the app (@wonderwhy-er)
- ✅ Together Integration (@mouimet-infinisoft)
- ✅ Mobile friendly (@qwikode)
- ✅ Better prompt enhancing (@SujalXplores)
- ✅ Attach images to prompts (@atrokhym)
- ✅ Detect package.json and commands to auto install & run preview for folder and git import (@wonderwhy-er)
- ⬜ **HIGH PRIORITY** - Prevent Bolt from rewriting files as often (file locking and diffs)
- ⬜ **HIGH PRIORITY** - Better prompting for smaller LLMs (code window sometimes doesn't start)
- ⬜ **HIGH PRIORITY** - Run agents in the backend as opposed to a single model call
- ⬜ Deploy directly to Vercel/Netlify/other similar platforms
- ⬜ Have LLM plan the project in a MD file for better results/transparency
- ⬜ VSCode Integration with git-like confirmations
- ⬜ Upload documents for knowledge - UI design templates, a code base to reference coding style, etc.
- ⬜ Voice prompting
