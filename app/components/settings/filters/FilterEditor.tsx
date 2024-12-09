import { useCallback, useState } from 'react';
import { EditorSelection } from '@codemirror/state';
import CodeMirrorEditor from '~/components/editor/codemirror/CodeMirrorEditor';
import { Panel, PanelGroup } from 'react-resizable-panels';

interface FilterEditorProps {
  initialCode: string;
  onChange: (code: string) => void;
}

const FilterEditor = ({ initialCode, onChange }: FilterEditorProps) => {
  const [editorScroll, setEditorScroll] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const onContentChange = useCallback(
    (change: { selection: EditorSelection; content: string }) => {
      onChange(change.content);
    },
    [onChange],
  );

  return (
    <div className="absolute top-0 bottom-0 left-0 right-0">
      <PanelGroup direction="vertical">
        <Panel className="flex flex-col" defaultSize={100} minSize={20}>
          <CodeMirrorEditor
            doc={{
              value: initialCode,
              isBinary: false,
              filePath: 'filter.js',
              scroll: editorScroll,
            }}
            theme="dark"
            onChange={onContentChange}
            onScroll={(scroll) => {
              setEditorScroll(scroll);
            }}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
};
export default FilterEditor;
