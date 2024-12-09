import type { FilterItem } from './types';

interface FilterCardProps {
  item: FilterItem;
  onDragStart: (e: React.DragEvent, item: FilterItem) => void;
  onDragEnter: (e: React.DragEvent, item: FilterItem) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onEdit: (item: FilterItem) => void;
  onDelete: (id: number) => void;
  isDragging: boolean;
}

export const FilterCard: React.FC<FilterCardProps> = ({
  item,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDragEnd,
  onEdit,
  onDelete,
  isDragging,
}) => {
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnter={(e) => onDragEnter(e, item)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`
        group
        p-4 
        bg-bolt-elements-background-depth-2
        rounded-lg 
        hover:bg-bolt-elements-background-depth-1
        transition-all 
        duration-200
        cursor-move
        text-bolt-elements-textPrimary
        border border-bolt-elements-borderColor
        ${isDragging ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{item.name}</span>
        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-1 hover:bg-gray-100 rounded">
            <div className="w-4 h-4 text-blue-500 i-ph:pencil-thin" />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1 hover:bg-gray-100 rounded">
            <div className="w-4 h-4 text-red-500 i-ph:trash-light" />
          </button>
        </div>
      </div>
    </li>
  );
};
