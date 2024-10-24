import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import type { Theme } from '~/types/theme.js';
import type { EditorSettings } from './CodeMirrorEditor.js';

export const darkTheme = EditorView.theme({}, { dark: true });
export const themeSelection = new Compartment();

export function getTheme(theme: Theme, settings: EditorSettings = {}): Extension {
  return [
    getEditorTheme(settings),
    theme === 'dark' ? themeSelection.of([getDarkTheme()]) : themeSelection.of([getLightTheme()]),
  ];
}

export function reconfigureTheme(theme: Theme) {
  return themeSelection.reconfigure(theme === 'dark' ? getDarkTheme() : getLightTheme());
}

function getEditorTheme(settings: EditorSettings) {
  return EditorView.theme({
    '&': {
      fontSize: settings.fontSize ?? '14px',
      fontFamily: '"Consolas", "Courier New", monospace',
    },
    '&.cm-editor': {
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--vscode-editor-foreground)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--vscode-editorCursor-foreground)',
    },
    '.cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--vscode-editor-selectionBackground)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground)',
    },
    '.cm-line': {
      padding: '0 4px',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--vscode-editorGutter-background)',
      color: 'var(--vscode-editorLineNumber-foreground)',
      border: 'none',
    },
    '.cm-gutter': {
      minWidth: '24px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 4px 0 24px',
    },
    '.cm-foldGutter': {
      fontSize: '12px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 5px',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'var(--vscode-editorBracketMatch-background)',
      outline: '1px solid var(--vscode-editorBracketMatch-border)',
    },
    '.cm-tooltip': {
      border: '1px solid var(--vscode-editorHoverWidget-border)',
      backgroundColor: 'var(--vscode-editorHoverWidget-background)',
      color: 'var(--vscode-editorHoverWidget-foreground)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li': {
        padding: '4px 8px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--vscode-list-activeSelectionBackground)',
        color: 'var(--vscode-list-activeSelectionForeground)',
      },
    },
    '.cm-panels': {
      backgroundColor: 'var(--vscode-editorWidget-background)',
      color: 'var(--vscode-editorWidget-foreground)',
    },
    '.cm-panels-top': {
      borderBottom: '1px solid var(--vscode-editorWidget-border)',
    },
    '.cm-panels-bottom': {
      borderTop: '1px solid var(--vscode-editorWidget-border)',
    },
    '.cm-search': {
      padding: '4px 8px',
      '& label': {
        fontSize: '13px',
      },
      '& input, & button, & select': {
        fontSize: '13px',
        background: 'var(--vscode-input-background)',
        border: '1px solid var(--vscode-input-border)',
        color: 'var(--vscode-input-foreground)',
      },
      '& input:focus, & select:focus': {
        outline: 'none',
        border: '1px solid var(--vscode-focusBorder)',
      },
      '& button:hover': {
        background: 'var(--vscode-button-hoverBackground)',
      },
    },
    '.cm-searchMatch': {
      backgroundColor: 'var(--vscode-editor-findMatchBackground)',
      outline: '1px solid var(--vscode-editor-findMatchBorder)',
    },
    '.cm-searchMatch-selected': {
      backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground)',
    },
    '.cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'var(--vscode-editor-selectionBackground)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--vscode-editor-foldBackground)',
      border: 'none',
      color: 'var(--vscode-editorGutter-foldingControlForeground)',
    },
  });
}

function getLightTheme() {
  return [vscodeLight];
}

function getDarkTheme() {
  return [vscodeDark];
}
