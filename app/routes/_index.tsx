import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { IndexedDbProvider } from '~/lib/providers/IndexedDBProvider.client';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full">
      <ClientOnly
        fallback={
          <>
            <Header />
            <BaseChat />
          </>
        }
      >
        {() => (
          <>
            <IndexedDbProvider databaseName="boltHistory" version={2}>
              <Header />
              <Chat />
            </IndexedDbProvider>
          </>
        )}
      </ClientOnly>
    </div>
  );
}
