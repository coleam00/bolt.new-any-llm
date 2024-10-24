import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';

const logger = createScopedLogger('ChatHistory');

// Check if IndexedDB is available
function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  } catch {
    return false;
  }
}

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (!isIndexedDBAvailable()) {
    logger.warn('IndexedDB is not available');
    return undefined;
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('boltHistory', 2);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('chats')) {
            const store = db.createObjectStore('chats', { keyPath: 'id' });
            store.createIndex('id', 'id', { unique: true });
            store.createIndex('urlId', 'urlId', { unique: true });
          }

          if (!db.objectStoreNames.contains('promptCache')) {
            const store = db.createObjectStore('promptCache', { keyPath: 'hash' });
            store.createIndex('hash', 'hash', { unique: true });
            store.createIndex('timestamp', 'timestamp');
          }
        } catch (error) {
          logger.error('Error during database upgrade:', error);
        }
      };

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event: Event) => {
        logger.error('Database open error:', (event.target as IDBOpenDBRequest).error);
        resolve(undefined);
      };
    } catch (error) {
      logger.error('Error initializing database:', error);
      resolve(undefined);
    }
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
      request.onerror = () => {
        logger.error('Error getting all chats:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in getAll:', error);
      reject(error);
    }
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readwrite');
      const store = transaction.objectStore('chats');

      const request = store.put({
        id,
        messages,
        urlId,
        description,
        timestamp: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Error setting messages:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in setMessages:', error);
      reject(error);
    }
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const index = store.index('urlId');
      const request = index.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => {
        logger.error('Error getting messages by URL ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in getMessagesByUrlId:', error);
      reject(error);
    }
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => {
        logger.error('Error getting messages by ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in getMessagesById:', error);
      reject(error);
    }
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readwrite');
      const store = transaction.objectStore('chats');
      const request = store.delete(id);

      request.onsuccess = () => resolve(undefined);
      request.onerror = () => {
        logger.error('Error deleting by ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in deleteById:', error);
      reject(error);
    }
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
        resolve(String(+highestId + 1));
      };

      request.onerror = () => {
        logger.error('Error getting next ID:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in getNextId:', error);
      reject(error);
    }
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const idList: string[] = [];

      const request = store.openCursor();

      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          idList.push(cursor.value.urlId);
          cursor.continue();
        } else {
          resolve(idList);
        }
      };

      request.onerror = () => {
        logger.error('Error getting URL IDs:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in getUrlIds:', error);
      reject(error);
    }
  });
}

// Prompt cache functions
export interface CachedPrompt {
  hash: string;
  messages: Message[];
  response: string;
  timestamp: string;
}

export async function getCachedPrompt(db: IDBDatabase, hash: string): Promise<CachedPrompt | undefined> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('promptCache', 'readonly');
      const store = transaction.objectStore('promptCache');
      const request = store.get(hash);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        logger.error('Error getting cached prompt:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in getCachedPrompt:', error);
      reject(error);
    }
  });
}

export async function setCachedPrompt(
  db: IDBDatabase,
  hash: string,
  messages: Message[],
  response: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('promptCache', 'readwrite');
      const store = transaction.objectStore('promptCache');

      const request = store.put({
        hash,
        messages,
        response,
        timestamp: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        logger.error('Error setting cached prompt:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in setCachedPrompt:', error);
      reject(error);
    }
  });
}

// Clean up old cache entries (older than 24 hours)
export async function cleanupOldCache(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('promptCache', 'readwrite');
      const store = transaction.objectStore('promptCache');
      const index = store.index('timestamp');
      
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const range = IDBKeyRange.upperBound(oneDayAgo.toISOString());
      const request = index.openCursor(range);

      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        logger.error('Error cleaning up old cache:', request.error);
        reject(request.error);
      };
    } catch (error) {
      logger.error('Error in cleanupOldCache:', error);
      reject(error);
    }
  });
}
