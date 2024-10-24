import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

export default function Index() {
  // Define the model and setModel properties
  const model = "defaultModel"; // Replace with your actual model
  const setModel = (newModel: string) => {
    console.log("Model set to:", newModel);
    // Implement your logic to update the model
  };

  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<BaseChat model={model} setModel={setModel} />}>
        {() => <Chat />}
      </ClientOnly>
    </div>
  );
}
