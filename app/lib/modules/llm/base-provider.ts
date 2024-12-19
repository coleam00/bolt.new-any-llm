import type { LanguageModelV1 } from 'ai';
import type { ProviderInfo, ProviderConfig, ModelInfo } from './types';
import type { IProviderSetting } from '~/types/model';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMManager } from './manager';

export abstract class BaseProvider implements ProviderInfo {
  abstract name: string;
  abstract staticModels: ModelInfo[];
  abstract config: ProviderConfig;

  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;

  getProviderBaseUrlAndKey(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: IProviderSetting;
    serverEnv?: Record<string, string>;
    defaultBaseUrlKey: string;
    defaultApiTokenKey: string;
  }) {
    const { apiKeys, providerSettings, serverEnv, defaultBaseUrlKey, defaultApiTokenKey } = options;
    let settingsBaseUrl = providerSettings?.baseUrl;
    const manager = LLMManager.getInstance();

    if (settingsBaseUrl && settingsBaseUrl.length == 0) {
      settingsBaseUrl = undefined;
    }

    const baseUrlKey = this.config.baseUrlKey || defaultBaseUrlKey;
    const baseUrl =
      settingsBaseUrl || serverEnv?.[baseUrlKey] || process?.env?.[baseUrlKey] || manager.env?.[baseUrlKey];

    const apiTokenKey = this.config.apiTokenKey || defaultApiTokenKey;
    const apiKey =
      apiKeys?.[this.name] || serverEnv?.[apiTokenKey] || process?.env?.[apiTokenKey] || manager.env?.[baseUrlKey];

    return {
      baseUrl,
      apiKey,
    };
  }

  // Declare the optional getDynamicModels method
  getDynamicModels?(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]>;

  abstract getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1;
}

type OptionalApiKey = string | undefined;

export function getOpenAILikeModel(baseURL: string, apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });

  return openai(model);
}
