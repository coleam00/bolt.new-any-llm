import React, { createContext, useContext, useEffect, useState } from 'react';
import { type IndexedDBContextType } from './types';
import { openDatabase } from '~/lib/persistence';

const IndexedDbContext = createContext<IndexedDBContextType | null>(null);

interface IndexedDBProviderProps {
  children: React.ReactNode;
  databaseName?: string;
  version?: number;
}

export const IndexedDbProvider = ({
  children,
  databaseName = 'YourDatabaseName',
  version = 1,
}: IndexedDBProviderProps) => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openDatabase(databaseName, version).then((newDb) => {
      if (!newDb) {
        setError('Error opening IndexedDB');
        return;
      }

      setDb(newDb);
      console.log(newDb);
    });

    return () => {
      if (db) {
        db.close();
      }
    };
  }, [databaseName, version]);

  return <IndexedDbContext.Provider value={{ db, error }}>{children}</IndexedDbContext.Provider>;
};

// Custom hook to use the IndexedDB context
export function useIndexedDB(): IndexedDBContextType {
  const context = useContext(IndexedDbContext);

  if (context === null) {
    throw new Error('useIndexedDB must be used within an IndexedDBProvider');
  }

  return context;
}
