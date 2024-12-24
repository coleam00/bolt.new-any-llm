import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { IconButton } from '~/components/ui/IconButton';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, setMessages, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-150px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

export function Menu() {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    if (db) {
      deleteById(db, item.id)
        .then(() => {
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    }
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const exportChatHistory = useCallback(async () => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const history = await getAll(db);
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        history,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Chat history exported successfully');
    } catch (error) {
      logger.error('Failed to export chat history:', error);
      toast.error('Failed to export chat history');
    }
  }, []);

  const importChatHistory = useCallback(async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            throw new Error('No file selected');
          }

          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const content = e.target?.result as string;
              logger.info('Parsing backup file content:', content.slice(0, 200) + '...');
              const backupData = JSON.parse(content);

              // Basic validation with detailed logging
              logger.info('Validating backup data:', {
                hasVersion: !!backupData.version,
                version: backupData.version,
                hasHistory: !!backupData.history,
                historyIsArray: Array.isArray(backupData.history),
                historyLength: backupData.history?.length,
                rawKeys: Object.keys(backupData)
              });

              if (!db) {
                throw new Error('Database not initialized');
              }

              let chatHistory;

              // Handle different backup formats
              if (backupData.version && backupData.history) {
                // Our standard format
                chatHistory = backupData.history;
              } else if (backupData.boltHistory) {
                // Chrome extension IndexedDB backup format
                chatHistory = Object.values(backupData.boltHistory.chats || {});
                logger.info('Detected Chrome extension backup format', {
                  itemCount: chatHistory.length,
                  sampleItem: chatHistory[0]
                });
              } else if (Array.isArray(backupData)) {
                // Direct array format
                chatHistory = backupData;
              } else {
                // Try to find any object with chat-like properties
                const possibleChats = Object.values(backupData).find(value =>
                  Array.isArray(value) ||
                  (typeof value === 'object' && value !== null && 'messages' in value)
                );

                if (possibleChats) {
                  chatHistory = Array.isArray(possibleChats) ? possibleChats : [possibleChats];
                  logger.info('Found possible chat data in alternate format', {
                    itemCount: chatHistory.length,
                    sampleItem: chatHistory[0]
                  });
                } else {
                  throw new Error('Unrecognized backup file format');
                }
              }

              // Validate and normalize chat items
              const normalizedHistory = chatHistory.map(item => {
                if (!item.id || !Array.isArray(item.messages)) {
                  throw new Error('Invalid chat item format');
                }
                return {
                  id: item.id,
                  messages: item.messages,
                  urlId: item.urlId || item.id,
                  description: item.description || `Imported chat ${item.id}`
                };
              });

              // Store each chat history item
              logger.info('Starting import of chat history items');
              for (const item of normalizedHistory) {
                logger.info('Importing chat item:', { id: item.id, description: item.description });
                await setMessages(db, item.id, item.messages, item.urlId, item.description);
              }

              toast.success(`Successfully imported ${normalizedHistory.length} chats`);
              // Reload the page to show imported chats
              window.location.reload();
            } catch (error) {
              logger.error('Failed to process backup file:', error);
              // More detailed error message
              if (error instanceof Error) {
                toast.error(`Failed to process backup file: ${error.message}`);
              } else {
                toast.error('Failed to process backup file');
              }
            }
          };
          reader.readAsText(file);
        } catch (error) {
          logger.error('Failed to read backup file:', error);
          if (error instanceof Error) {
            toast.error(`Failed to read backup file: ${error.message}`);
          } else {
            toast.error('Failed to read backup file');
          }
        }
      };

      input.click();
    } catch (error) {
      logger.error('Failed to import chat history:', error);
      if (error instanceof Error) {
        toast.error(`Failed to import chat history: ${error.message}`);
      } else {
        toast.error('Failed to import chat history');
      }
    }
  }, []);

  const handleDeleteClick = (event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();
    setDialogContent({ type: 'delete', item });
  };

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  return (
    <motion.div
      ref={menuRef}
      initial="closed"
      animate={open ? 'open' : 'closed'}
      variants={menuVariants}
      className="flex selection-accent flex-col side-menu fixed top-0 w-[350px] h-full bg-bolt-elements-background-depth-2 border-r rounded-r-3xl border-bolt-elements-borderColor z-sidebar shadow-xl shadow-bolt-elements-sidebar-dropdownShadow text-sm"
    >
      <div className="flex items-center h-[var(--header-height)]">{/* Placeholder */}</div>
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <div className="p-4 select-none">
          <a
            href="/"
            className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
          >
            <span className="inline-block i-bolt:chat scale-110" />
            Start new chat
          </a>
        </div>
        <div className="pl-4 pr-4 my-2">
          <div className="relative w-full">
            <input
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor"
              type="search"
              placeholder="Search"
              onChange={handleSearchChange}
              aria-label="Search chats"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pl-6 pr-5 my-2">
          <div className="text-bolt-elements-textPrimary font-medium">Your Chats</div>
          <div className="flex gap-2">
            <IconButton
              title="Import Chat History"
              onClick={importChatHistory}
              icon="i-ph-upload-simple-bold"
              className="text-bolt-elements-textPrimary hover:text-bolt-elements-textTertiary transition-theme"
              size="xxl"
              iconClassName="scale-125"
            />
            <IconButton
              title="Export Chat History"
              onClick={exportChatHistory}
              icon="i-ph-download-simple-bold"
              className="text-bolt-elements-textPrimary hover:text-bolt-elements-textTertiary transition-theme"
              size="xxl"
              iconClassName="scale-125"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto pl-4 pr-5 pb-5">
          {filteredList.length === 0 && (
            <div className="pl-2 text-bolt-elements-textTertiary">
              {list.length === 0 ? 'No previous conversations' : 'No matches found'}
            </div>
          )}
          <DialogRoot open={dialogContent !== null}>
            {binDates(filteredList).map(({ category, items }) => (
              <div key={category} className="mt-4 first:mt-0 space-y-1">
                <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-background-depth-2 pl-2 pt-2 pb-1">
                  {category}
                </div>
                {items.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    exportChat={exportChat}
                    onDelete={(event) => handleDeleteClick(event, item)}
                    onDuplicate={() => handleDuplicate(item.id)}
                  />
                ))}
              </div>
            ))}
            <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
              {dialogContent?.type === 'delete' && (
                <>
                  <DialogTitle>Delete Chat?</DialogTitle>
                  <DialogDescription asChild>
                    <div>
                      <p>
                        You are about to delete <strong>{dialogContent.item.description}</strong>.
                      </p>
                      <p className="mt-1">Are you sure you want to delete this chat?</p>
                    </div>
                  </DialogDescription>
                  <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                    <DialogButton type="secondary" onClick={closeDialog}>
                      Cancel
                    </DialogButton>
                    <DialogButton
                      type="danger"
                      onClick={(event) => {
                        deleteItem(event, dialogContent.item);
                        closeDialog();
                      }}
                    >
                      Delete
                    </DialogButton>
                  </div>
                </>
              )}
            </Dialog>
          </DialogRoot>
        </div>
        <div className="flex items-center border-t border-bolt-elements-borderColor p-4">
          <ThemeSwitch className="ml-auto" />
        </div>
      </div>
    </motion.div>
  );
}
