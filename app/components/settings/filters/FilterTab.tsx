import FilterList from './FilterList';
import { useFilters } from '~/lib/hooks/useFilters';

export default function FilterTab() {
  const { filters, addFilter, deleteFilter, updateOrder } = useFilters();
  return (
    <div>
      <FilterList
        onFilterCreate={addFilter}
        onFilterUpdate={addFilter}
        onFilterDelete={deleteFilter}
        onFilterOrderChange={updateOrder}
        listItems={filters}
      />
    </div>
  );
}
