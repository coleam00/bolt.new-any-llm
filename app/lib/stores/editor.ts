import { atom, computed, map, type MapStore, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileMap, FilesStore } from './files';
import { versionHistoryStore } from './version-history';
import { workbenchStore } from './workbench';

export type EditorDocuments = Record<string, EditorDocument>;

type SelectedFile = WritableAtom<string | undefined>;

export class EditorStore {
  #filesStore: FilesStore;
  #originalContent: Map<string, string> = new Map();

  selectedFile: SelectedFile = import.meta.hot?.data.selectedFile ?? atom<string | undefined>();
  documents: MapStore<EditorDocuments> = import.meta.hot?.data.documents ?? map({});

  currentDocument = computed([this.documents, this.selectedFile], (documents, selectedFile) => {
    if (!selectedFile) {
      return undefined;
    }

    return documents[selectedFile];
  });

  constructor(filesStore: FilesStore) {
    this.#filesStore = filesStore;

    if (import.meta.hot) {
      import.meta.hot.data.documents = this.documents;
      import.meta.hot.data.selectedFile = this.selectedFile;
    }
  }

  setDocuments(files: FileMap) {
    const previousDocuments = this.documents.value;

    this.documents.set(
      Object.fromEntries<EditorDocument>(
        Object.entries(files)
          .map(([filePath, dirent]) => {
            if (dirent === undefined || dirent.type === 'folder') {
              return undefined;
            }

            const previousDocument = previousDocuments?.[filePath];

            // Store original content for reset functionality
            if (!this.#originalContent.has(filePath)) {
              this.#originalContent.set(filePath, dirent.content);
            }

            return [
              filePath,
              {
                value: dirent.content,
                filePath,
                scroll: previousDocument?.scroll,
                isBinary: dirent.isBinary,
              },
            ] as [string, EditorDocument];
          })
          .filter(Boolean) as Array<[string, EditorDocument]>,
      ),
    );
  }

  setSelectedFile(filePath: string | undefined) {
    this.selectedFile.set(filePath);
  }

  updateScrollPosition(filePath: string, position: ScrollPosition) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    this.documents.setKey(filePath, {
      ...documentState,
      scroll: position,
    });
  }

  updateFile(filePath: string, newContent: string) {
    const documents = this.documents.get();
    const documentState = documents[filePath];

    if (!documentState) {
      return;
    }

    const currentContent = documentState.value;
    const contentChanged = currentContent !== newContent;

    if (contentChanged) {
      // Add version when content changes
      versionHistoryStore.addVersion(filePath, newContent, 'Modified in editor');

      // Only mark as modified if it's an existing file
      if (this.#filesStore.isExistingFile(filePath)) {
        // Update both unsavedFiles and modifiedFiles
        const newUnsavedFiles = new Set(workbenchStore.unsavedFiles.get());
        newUnsavedFiles.add(filePath);
        workbenchStore.unsavedFiles.set(newUnsavedFiles);
        workbenchStore.modifiedFiles.add(filePath);
      }

      this.documents.setKey(filePath, {
        ...documentState,
        value: newContent,
      });
    }
  }

  resetFile(filePath: string) {
    const originalContent = this.#originalContent.get(filePath);
    if (originalContent) {
      this.updateFile(filePath, originalContent);
      // Clear both unsavedFiles and modifiedFiles
      const newUnsavedFiles = new Set(workbenchStore.unsavedFiles.get());
      newUnsavedFiles.delete(filePath);
      workbenchStore.unsavedFiles.set(newUnsavedFiles);
      workbenchStore.modifiedFiles.delete(filePath);
    }
  }
}
