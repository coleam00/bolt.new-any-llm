import { useCallback, useEffect, useState } from 'react';
import { useIndexedDB } from '~/lib/providers/IndexedDBProvider.client';
import type { FilterItem } from '~/components/settings/filters/types';
import type { FileMap } from '~/lib/stores/files';
import type { Message } from 'ai';

export interface FilterRequestObject {
  files: FileMap;
  messages: Message[];
  systemPrompt: string;
}

export interface IMiddleware {
  filter: (reqbj: any) => Promise<{ response?: string } | undefined>;
}

const getAllFilters = async (db: IDBDatabase) => {
  return new Promise<FilterItem[]>((resolve, reject) => {
    const transaction = db.transaction('filters', 'readonly');
    const store = transaction.objectStore('filters');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as FilterItem[]);
    request.onerror = () => reject(request.error);
  });
};

const addFilterToDB = async (db: IDBDatabase, filter: FilterItem) => {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('filters', 'readwrite');
    const store = transaction.objectStore('filters');
    const request = store.put({
      ...filter,
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const updateOrderInDB = async (db: IDBDatabase, items: FilterItem[]) => {
  const oldItems: FilterItem[] = await getAllFilters(db);
  const idsInOrder = items.map((item) => item.id);
  await Promise.all(
    idsInOrder.map(async (id, index) => {
      const item = oldItems.find((item) => item.id === id);

      if (item) {
        item.order = index;
        await addFilterToDB(db, item);
      }
    }),
  );
};

const deleteFilterFromDB = async (db: IDBDatabase, filterId: number) => {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('filters', 'readwrite');
    const store = transaction.objectStore('filters');
    const request = store.delete(filterId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const importModuleFromString = async (stringOfCode: string) => {
  // Create a Blob from the module code
  const blob = new Blob([stringOfCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  // Dynamically import the module
  const module: IMiddleware = await import(blobUrl);

  return {
    module,
    cleanup: () => {
      URL.revokeObjectURL(blobUrl);
    },
  };
};

export function useFilters() {
  const { db, error: dbError } = useIndexedDB();
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [error, setError] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    if (!db && dbError) {
      setError(dbError);
      setIsReady(false);

      return;
    }

    if (!db) {
      return;
    } //wait for the db to initialize

    setIsReady(true);
    getAllFilters(db).then((newFilters) => {
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    });
  }, [db, dbError]);

  const addFilter = useCallback(
    async (filter: FilterItem) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await addFilterToDB(db, { ...filter, order: filters.length });

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady, filters],
  );

  const deleteFilter = useCallback(
    async (filterId: number) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await deleteFilterFromDB(db, filterId);

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady],
  );
  const updateOrder = useCallback(
    async (items: FilterItem[]) => {
      if (!isReady) {
        return;
      }

      if (!db) {
        return;
      }

      await updateOrderInDB(db, items);

      const newFilters = await getAllFilters(db);
      newFilters.sort((a, b) => a.order - b.order);
      setFilters(newFilters);
    },
    [db, isReady],
  );

  const executeFilterChain = useCallback(
    async (reqbj: FilterRequestObject) => {
      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        const { module, cleanup } = await importModuleFromString(filter.content);
        const resp = await module.filter(reqbj);

        if (resp?.response) {
          cleanup();
          return resp;
        }

        cleanup();
      }
      return {};
    },
    [filters],
  );

  return { isReady, error, filters, addFilter, deleteFilter, updateOrder, executeFilterChain };
}
