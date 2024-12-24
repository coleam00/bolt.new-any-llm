import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { ImportFolderButton } from '~/components/chat/ImportFolderButton';

const processChatData = (data: any): { description: string; messages: Message[] }[] => {
  // Handle Bolt standard format
  if (data.messages && Array.isArray(data.messages)) {
    return [{ description: data.description || 'Imported Chat', messages: data.messages }];
  }
  
  // Handle Chrome extension format
  if (data.boltHistory?.chats) {
    return Object.values(data.boltHistory.chats).map((chat: any) => ({
      description: chat.description || 'Imported Chat',
      messages: chat.messages
    }));
  }

  // Handle history array format
  if (data.history && Array.isArray(data.history)) {
    return data.history.map((chat: any) => ({
      description: chat.description || 'Imported Chat',
      messages: chat.messages
    }));
  }

  throw new Error('Unsupported chat format');
};

export function ImportButtons(importChat: ((description: string, messages: Message[]) => Promise<void>) | undefined) {
  return (
    <div className="flex flex-col items-center justify-center w-auto">
      <input
        type="file"
        id="chat-import"
        className="hidden"
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];

          if (file && importChat) {
            try {
              const reader = new FileReader();

              reader.onload = async (e) => {
                try {
                  const content = e.target?.result as string;
                  const data = JSON.parse(content);
                  const chats = processChatData(data);
                  
                  for (const chat of chats) {
                    await importChat(chat.description, chat.messages);
                  }
                  
                  toast.success(`Successfully imported ${chats.length} chat${chats.length > 1 ? 's' : ''}`);
                } catch (error: unknown) {
                  if (error instanceof Error) {
                    toast.error('Failed to parse chat file: ' + error.message);
                  } else {
                    toast.error('Failed to parse chat file');
                  }
                }
              };
              reader.onerror = () => toast.error('Failed to read chat file');
              reader.readAsText(file);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Failed to import chat');
            }
            e.target.value = ''; // Reset file input
          } else {
            toast.error('Something went wrong');
          }
        }}
      />
      <div className="flex flex-col items-center gap-4 max-w-2xl text-center">
        <div className="flex gap-2">
          <button
            onClick={() => {
              const input = document.getElementById('chat-import');
              input?.click();
            }}
            className="px-4 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-all flex items-center gap-2"
          >
            <div className="i-ph:upload-simple" />
            Import Chat
          </button>
          <ImportFolderButton
            importChat={importChat}
            className="px-4 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-all flex items-center gap-2"
          />
        </div>
      </div>
    </div>
  );
}
