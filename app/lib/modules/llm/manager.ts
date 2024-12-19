import type { IProviderSetting } from '~/types/model';
import { BaseProvider } from './base-provider';
import type { ModelInfo, ProviderInfo } from './types';

export class LLMManager {
  private static _instance: LLMManager;
  private _providers: Map<string, BaseProvider> = new Map();
  private _modelList: ModelInfo[] = [];
  private readonly _env: any = {};

  private constructor(_env: Record<string, string>) {
    this._registerProvidersFromDirectory();
    this._env = _env;
  }

  static getInstance(env: Record<string, string> = {}): LLMManager {
    if (!LLMManager._instance) {
      LLMManager._instance = new LLMManager(env);
    }

    return LLMManager._instance;
  }
  get env() {
    return this._env;
  }

  private async _registerProvidersFromDirectory() {
    try {
      // Dynamically import all files from the providers directory
      const providerModules = import.meta.glob('./providers/*.ts', { eager: true });

      for (const [path, module] of Object.entries(providerModules)) {
        // Skip base-provider.ts and index.ts
        if (path.includes('base-provider') || path.includes('index')) {
          continue;
        }

        const exportedItems = module as Record<string, any>;

        // Look for exported classes that extend BaseProvider
        for (const exportedItem of Object.values(exportedItems)) {
          if (typeof exportedItem === 'function' && exportedItem.prototype instanceof BaseProvider) {
            const provider = new exportedItem();

            try {
              this.registerProvider(provider);
            } catch (error: any) {
              console.log('Failed To Register Provider: ', provider.name, 'Path:', path, 'error:', error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error registering providers:', error);
    }
  }

  registerProvider(provider: BaseProvider) {
    if (this._providers.has(provider.name)) {
      console.warn(`Provider ${provider.name} is already registered. Skipping.`);
      return;
    }

    console.log('Registering Provider: ', provider.name);
    this._providers.set(provider.name, provider);
    this._modelList = [...this._modelList, ...provider.staticModels];
  }

  getProvider(name: string): BaseProvider | undefined {
    return this._providers.get(name);
  }

  getAllProviders(): BaseProvider[] {
    return Array.from(this._providers.values());
  }

  getModelList(): ModelInfo[] {
    return this._modelList;
  }

  async updateModelList(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    serverEnv?: Record<string, string>;
  }): Promise<ModelInfo[]> {
    const { apiKeys, providerSettings, serverEnv } = options;

    // Get dynamic models from all providers that support them
    const dynamicModels = await Promise.all(
      Array.from(this._providers.values())
        .filter(
          (provider): provider is BaseProvider & Required<Pick<ProviderInfo, 'getDynamicModels'>> =>
            !!provider.getDynamicModels,
        )
        .map((provider) => provider.getDynamicModels(apiKeys, providerSettings?.[provider.name], serverEnv)),
    );

    // Combine static and dynamic models
    const modelList = [...dynamicModels.flat(), ...Array.from(this._providers.values()).flatMap((p) => p.staticModels)];
    this._modelList = modelList;

    return modelList;
  }

  getDefaultProvider(): BaseProvider {
    const firstProvider = this._providers.values().next().value;

    if (!firstProvider) {
      throw new Error('No providers registered');
    }

    return firstProvider;
  }
}
