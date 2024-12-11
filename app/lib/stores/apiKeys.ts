import { map } from 'nanostores';
import { encrypt, decrypt } from '~/lib/crypto';

const API_KEYS_DB_NAME = 'boltApiKeys';
const API_KEYS_STORE_NAME = 'apiKeys';
const ENCRYPTION_KEY_ENV = 'VITE_BOLT_ENCRYPTION_KEY';
const WRITE_DELAY = 1000; // ms

export const apiKeysStore = map<Record<string, string>>({});

let db: IDBDatabase | undefined;
let writeTimeout: NodeJS.Timeout | undefined;
let isWriting = false;
const pendingWrites = new Map<string, string>();
const lastSavedValues = new Map<string, string>();

async function getEncryptionKey(): Promise<string> {
  const key = import.meta.env[ENCRYPTION_KEY_ENV];
  if (!key) {
    throw new Error('VITE_BOLT_ENCRYPTION_KEY non impostata in .env.local');
  }
  return key;
}

async function flushWrites(): Promise<void> {
  if (!db || isWriting || pendingWrites.size === 0) return;

  isWriting = true;
  const encryptionKey = await getEncryptionKey();
  const transaction = db!.transaction(API_KEYS_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(API_KEYS_STORE_NAME);

  try {
    for (const [provider, apiKey] of pendingWrites.entries()) {
      // Scrivi solo se il valore è cambiato
      if (lastSavedValues.get(provider) !== apiKey) {
        const encryptedKey = await encrypt(encryptionKey, apiKey);
        await new Promise<void>((resolve, reject) => {
          const request = store.put(encryptedKey, provider);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        lastSavedValues.set(provider, apiKey);
      }
    }
    pendingWrites.clear();
  } finally {
    isWriting = false;
  }
}

export async function initApiKeysStore(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.open(API_KEYS_DB_NAME, 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(API_KEYS_STORE_NAME)) {
        db.createObjectStore(API_KEYS_STORE_NAME);
      }
    };

    request.onsuccess = (event: Event) => {
      db = (event.target as IDBOpenDBRequest).result;
      loadApiKeys().then(() => resolve());
    };

    request.onerror = () => {
      console.error('Failed to open API keys database');
      resolve();
    };
  });
}

async function loadApiKeys(): Promise<void> {
  if (!db) {
    console.error('Database not initialized');
    return;
  }

  return new Promise<void>((resolve) => {
    const transaction = db!.transaction(API_KEYS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(API_KEYS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async () => {
      const encryptedKeys = request.result;
      const decryptedKeys: Record<string, string> = {};
      
      try {
        const encryptionKey = await getEncryptionKey();
        for (const [provider, encryptedKey] of Object.entries(encryptedKeys)) {
          try {
            const decryptedKey = await decrypt(encryptionKey, encryptedKey as string);
            decryptedKeys[provider] = decryptedKey;
            lastSavedValues.set(provider, decryptedKey);
          } catch (error) {
            console.error(`Failed to decrypt API key for ${provider}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to get encryption key:', error);
      }
      
      apiKeysStore.set(decryptedKeys);
      resolve();
    };

    request.onerror = () => {
      console.error('Failed to load API keys');
      resolve();
    };
  });
}

export async function setApiKey(provider: string, apiKey: string): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Non aggiungere alla coda se il valore non è cambiato
  if (lastSavedValues.get(provider) === apiKey) {
    return;
  }

  // Aggiungi alla coda di scrittura
  pendingWrites.set(provider, apiKey);

  // Aggiorna immediatamente lo store in memoria
  apiKeysStore.setKey(provider, apiKey);

  // Resetta il timer di scrittura
  if (writeTimeout) {
    clearTimeout(writeTimeout);
  }

  // Programma la scrittura
  return new Promise<void>((resolve) => {
    writeTimeout = setTimeout(async () => {
      await flushWrites();
      resolve();
    }, WRITE_DELAY);
  });
}

export async function getApiKey(provider: string): Promise<string | undefined> {
  return apiKeysStore.get()[provider];
} 