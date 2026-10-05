import { FiltersDropdown } from "./helpers/dropdown";
import { FilterSelection } from "./selection";

export function IssueFiltersDropdown() {
  return (
    <div className="relative">
      <FiltersDropdown title="Filters" placement="bottom-end">
        <FilterSelection />
      </FiltersDropdown>
    </div>
  );
}
