import type { ModelInfo } from './types';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';
export const DEFAULT_PROVIDER = 'Anthropic';

const staticModels: ModelInfo[] = [
  { name: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { name: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { name: 'deepseek/deepseek-coder', label: 'Deepseek-Coder V2 236B (OpenRouter)', provider: 'OpenRouter' },
  { name: 'google/gemini-flash-1.5', label: 'Google Gemini Flash 1.5 (OpenRouter)', provider: 'OpenRouter' },
  { name: 'google/gemini-pro-1.5', label: 'Google Gemini Pro 1.5 (OpenRouter)', provider: 'OpenRouter' },
  { name: 'mistralai/mistral-nemo', label: 'OpenRouter Mistral Nemo (OpenRouter)', provider: 'OpenRouter' },
  { name: 'qwen/qwen-110b-chat', label: 'OpenRouter Qwen 110b Chat (OpenRouter)', provider: 'OpenRouter' },
  { name: 'cohere/command', label: 'Cohere Command (OpenRouter)', provider: 'OpenRouter' },
  { name: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70b (Groq)', provider: 'Groq' },
  { name: 'llama-3.1-8b-instant', label: 'Llama 3.1 8b (Groq)', provider: 'Groq' },
  { name: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11b (Groq)', provider: 'Groq' },
  { name: 'llama-3.2-3b-preview', label: 'Llama 3.2 3b (Groq)', provider: 'Groq' },
  { name: 'llama-3.2-1b-preview', label: 'Llama 3.2 1b (Groq)', provider: 'Groq' },
  { name: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'Anthropic' },
  { name: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { name: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', provider: 'Anthropic' },
  { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { name: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI' },
  { name: 'gpt-4', label: 'GPT-4', provider: 'OpenAI' },
  { name: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI' },
];

export let MODEL_LIST: ModelInfo[] = [...staticModels];

async function getOllamaModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`http://localhost:11434/api/tags`);
    const data = await response.json();

    return data.models.map((model: any) => ({
      name: model.name,
      label: `${model.name} (${model.details.parameter_size})`,
      provider: 'Ollama',
    }));
  } catch (e) {
    return [];
  }
}

async function initializeModelList(): Promise<void> {
  const ollamaModels = await getOllamaModels();
  MODEL_LIST = [...ollamaModels, ...staticModels];
}
initializeModelList().then();
export { getOllamaModels, initializeModelList };
