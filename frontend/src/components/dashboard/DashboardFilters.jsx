import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardFilters({ filters = [], onFilterChange, activeFilters = {} }) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(activeFilters).filter(v =>
    v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const handleClear = () => {
    onFilterChange({});
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
          open || activeCount > 0
            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        )}
      >
        <Filter size={14} />
        Filters
        {activeCount > 0 && (
          <span className="bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {activeCount > 0 && (
        <button onClick={handleClear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
          <X size={12} /> Clear all
        </button>
      )}

      {open && filters.length > 0 && (
        <div className="w-full mt-2 p-4 card flex flex-wrap gap-4">
          {filters.map((filter) => (
            <FilterControl
              key={filter.column}
              filter={filter}
              value={activeFilters[filter.column]}
              onChange={(val) => onFilterChange({ ...activeFilters, [filter.column]: val })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterControl({ filter, value, onChange }) {
  if (filter.type === 'date_range') {
    return (
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="label text-xs">{filter.label}</label>
        <div className="flex gap-2">
          <input
            type="date"
            className="input text-xs py-1.5"
            value={value?.min || ''}
            onChange={(e) => onChange({ ...value, min: e.target.value })}
            placeholder="From"
          />
          <input
            type="date"
            className="input text-xs py-1.5"
            value={value?.max || ''}
            onChange={(e) => onChange({ ...value, max: e.target.value })}
            placeholder="To"
          />
        </div>
      </div>
    );
  }

  if (filter.type === 'multi_select') {
    return (
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="label text-xs">{filter.label}</label>
        <div className="flex flex-wrap gap-1.5">
          {filter.options?.slice(0, 8).map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(selected ? current.filter((v) => v !== opt) : [...current, opt]);
                }}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  selected
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
