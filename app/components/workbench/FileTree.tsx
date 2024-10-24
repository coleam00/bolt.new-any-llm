import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 16; // Adjusted padding for VSCode-like appearance
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  className?: string;
  hoverClassName?: string;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
    hoverClassName,
  }: Props) => {
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => buildFileList(files, rootFolder, hideRoot, computedHiddenFiles), [files, rootFolder, hideRoot, computedHiddenFiles]);

    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => 
      collapsed ? new Set(fileList.filter((item): item is FolderNode => item.kind === 'folder').map(item => item.fullPath)) : new Set()
    );

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(fileList.filter((item): item is FolderNode => item.kind === 'folder').map(item => item.fullPath)));
      } else {
        setCollapsedFolders(prevCollapsed => {
          const newCollapsed = new Set<string>();
          for (const folder of fileList) {
            if (folder.kind === 'folder' && prevCollapsed.has(folder.fullPath)) {
              newCollapsed.add(folder.fullPath);
            }
          }
          return newCollapsed;
        });
      }
    }, [fileList, collapsed]);

    const filteredFileList = useMemo(() => {
      const list: Node[] = [];
      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const node of fileList) {
        if (lastDepth === node.depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        if (node.kind === 'folder' && collapsedFolders.has(node.fullPath)) {
          lastDepth = Math.min(lastDepth, node.depth);
        }

        if (lastDepth < node.depth) continue;

        list.push(node);
      }

      return list;
    }, [fileList, collapsedFolders]);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders(prevSet => {
        const newSet = new Set(prevSet);
        newSet.has(fullPath) ? newSet.delete(fullPath) : newSet.add(fullPath);
        return newSet;
      });
    };

    return (
      <div className={classNames('py-1', className)}>
        {filteredFileList.map((item) => 
          item.kind === 'folder' ? (
            <Folder
              key={item.fullPath}
              folder={item}
              collapsed={collapsedFolders.has(item.fullPath)}
              selected={allowFolderSelection && item.fullPath === selectedFile}
              onClick={() => {
                toggleCollapseState(item.fullPath);
                if (allowFolderSelection) onFileSelect?.(item.fullPath);
              }}
              hoverClassName={hoverClassName}
            />
          ) : (
            <File
              key={item.fullPath}
              file={item}
              selected={item.fullPath === selectedFile}
              unsavedChanges={unsavedFiles?.has(item.fullPath)}
              onClick={() => onFileSelect?.(item.fullPath)}
              hoverClassName={hoverClassName}
            />
          )
        )}
      </div>
    );
  },
);

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onClick: () => void;
  hoverClassName?: string;
}

function Folder({ folder: { depth, name }, collapsed, selected = false, onClick, hoverClassName }: FolderProps) {
  const folderIcon = getFileIcon(name, true, !collapsed);
  return (
    <NodeButton
      className={classNames('group transition-colors duration-75', {
        [`bg-transparent text-bolt-elements-item-contentDefault ${hoverClassName}`]: !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={folderIcon}
      onClick={onClick}
    >
      {name}
    </NodeButton>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  onClick: () => void;
  hoverClassName?: string;
}

function File({ file: { depth, name }, onClick, selected, unsavedChanges = false, hoverClassName }: FileProps) {
  const fileIcon = getFileIcon(name, false);
  return (
    <NodeButton
      className={classNames('group transition-colors duration-75', {
        [`bg-transparent ${hoverClassName} text-bolt-elements-item-contentDefault`]: !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={fileIcon}
      onClick={onClick}
    >
      <div
        className={classNames('flex items-center', {
          'group-hover:text-bolt-elements-item-contentActive': !selected,
        })}
      >
        <div className="flex-1 truncate pr-2">{name}</div>
        {unsavedChanges && <span className="i-ph:circle-fill scale-75 shrink-0 text-bolt-elements-item-contentAccent" />}
      </div>
    </NodeButton>
  );
}

function getFileIcon(fileName: string, isFolder: boolean, isFolderOpen?: boolean): string {
  if (isFolder) {
    const folderName = fileName.toLowerCase();
    const icon = isFolderOpen ? 'i-mdi:folder-open' : 'i-mdi:folder';
    const colorMap: Record<string, string> = {
      src: 'text-blue-500',
      components: 'text-green-500',
      pages: 'text-purple-500',
      assets: 'text-yellow-500',
      styles: 'text-pink-500',
      css: 'text-pink-500',
      js: 'text-yellow-400',
      javascript: 'text-yellow-400',
      ts: 'text-blue-600',
      typescript: 'text-blue-600',
      test: 'text-red-500',
      tests: 'text-red-500',
      __tests__: 'text-red-500',
      public: 'text-green-600',
      docs: 'text-blue-400',
      documentation: 'text-blue-400',
      node_modules: 'text-gray-500',
      build: 'text-orange-500',
      dist: 'text-orange-500',
    };
    
    const color = colorMap[folderName] || 'text-yellow-500';
    return `${icon} ${color}`;
  }

  const extension = fileName.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    js: 'i-mdi:language-javascript text-yellow-400',
    jsx: 'i-mdi:react text-blue-400',
    ts: 'i-mdi:language-typescript text-blue-600',
    tsx: 'i-mdi:react text-blue-500',
    css: 'i-mdi:language-css3 text-blue-500',
    scss: 'i-mdi:sass text-pink-400',
    sass: 'i-mdi:sass text-pink-400',
    less: 'i-mdi:language-css3 text-indigo-400',
    html: 'i-mdi:language-html5 text-orange-500',
    md: 'i-mdi:language-markdown text-blue-300',
    markdown: 'i-mdi:language-markdown text-blue-300',
    svg: 'i-mdi:svg text-orange-400',
    json: 'i-mdi:code-json text-yellow-300',
    yaml: 'i-mdi:file-code-outline text-purple-400',
    yml: 'i-mdi:file-code-outline text-purple-400',
    php: 'i-mdi:language-php text-indigo-400',
    py: 'i-mdi:language-python text-blue-500',
    rb: 'i-mdi:language-ruby text-red-500',
    'webpack.config.js': 'i-mdi:webpack text-blue-300',
    'package.json': 'i-mdi:nodejs text-green-600',
    'yarn.lock': 'i-mdi:package-variant-closed text-blue-400',
    env: 'i-mdi:file-cog-outline text-yellow-600',
    gitignore: 'i-mdi:git text-orange-600',
    eslintrc: 'i-mdi:eslint text-purple-500',
    eslintignore: 'i-mdi:eslint text-purple-500',
    prettierrc: 'i-mdi:code-tags-check text-green-400',
    png: 'i-mdi:file-image-outline text-purple-400',
    jpg: 'i-mdi:file-image-outline text-purple-400',
    jpeg: 'i-mdi:file-image-outline text-purple-400',
    gif: 'i-mdi:file-image-outline text-purple-400',
    ttf: 'i-mdi:font-awesome text-red-300',
    otf: 'i-mdi:font-awesome text-red-300',
    woff: 'i-mdi:font-awesome text-red-300',
    woff2: 'i-mdi:font-awesome text-red-300',
    astro: 'i-mdi:rocket-launch text-orange-500',
    vue: 'i-mdi:vuejs text-green-400',
    go: 'i-mdi:language-go text-blue-400',
    rs: 'i-mdi:language-rust text-orange-600',
    java: 'i-mdi:language-java text-red-400',
    kt: 'i-mdi:language-kotlin text-purple-500',
    swift: 'i-mdi:language-swift text-orange-500',
    c: 'i-mdi:language-c text-blue-500',
    cpp: 'i-mdi:language-cpp text-blue-600',
    cs: 'i-mdi:language-csharp text-green-600',
    'docker-compose.yml': 'i-mdi:docker text-blue-400',
    dockerfile: 'i-mdi:docker text-blue-400',
    graphql: 'i-mdi:graphql text-pink-600',
    sql: 'i-mdi:database text-blue-400',
    toml: 'i-mdi:file-code-outline text-gray-500',
    'tsconfig.json': 'i-mdi:language-typescript text-blue-600',
    'babel.config.js': 'i-mdi:babel text-yellow-400',
    'angular.json': 'i-mdi:angular text-red-600',
    'tailwind.config.js': 'i-mdi:tailwind text-teal-400',
  };

  return iconMap[extension || ''] || 'i-mdi:file-outline text-gray-400';
}

interface ButtonProps {
  depth: number;
  iconClasses: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function NodeButton({ depth, iconClasses, onClick, className, children }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-2 w-full pr-2 text-left py-[3px] hover:bg-bolt-elements-item-backgroundHover',
        className,
      )}
      style={{ paddingLeft: `${depth * NODE_PADDING_LEFT}px` }}
      onClick={onClick}
    >
      <div className={classNames('scale-90 shrink-0', iconClasses)}></div>
      <div className="truncate w-full text-sm">{children}</div>
    </button>
  );
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter(Boolean);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    segments.forEach((name, index) => {
      currentPath += `/${name}`;
      const depth = index + defaultDepth;

      if (!currentPath.startsWith(rootFolder) || (hideRoot && currentPath === rootFolder)) {
        return;
      }

      if (index === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath: currentPath,
          depth,
        });
      } else if (!folderPaths.has(currentPath)) {
        folderPaths.add(currentPath);
        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath: currentPath,
          depth,
        });
      }
    });
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => 
    typeof pathOrRegex === 'string' ? fileName === pathOrRegex : pathOrRegex.test(filePath)
  );
}

function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}
