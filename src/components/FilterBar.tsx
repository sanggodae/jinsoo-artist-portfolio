import React from 'react';
import { Search, X, Star, ArrowUpDown } from 'lucide-react';
import { MaterialType, SortField } from '../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedMaterial: MaterialType | 'ALL';
  onMaterialChange: (mat: MaterialType | 'ALL') => void;
  selectedYear: number | 'ALL';
  onYearChange: (yr: number | 'ALL') => void;
  availableYears: number[];
  isFeaturedOnly: boolean;
  onToggleFeaturedOnly: () => void;
  sortField: SortField;
  onSortChange: (sort: SortField) => void;
  totalFiltered: number;
  totalAll: number;
  onResetFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedMaterial,
  onMaterialChange,
  selectedYear,
  onYearChange,
  availableYears,
  isFeaturedOnly,
  onToggleFeaturedOnly,
  sortField,
  onSortChange,
  totalFiltered,
  totalAll,
  onResetFilters,
}) => {
  const materials: Array<{ label: string; value: MaterialType | 'ALL'; code?: string }> = [
    { label: '전체 재료', value: 'ALL' },
    { label: 'Acrylic (아크릴릭)', value: 'Acrylic', code: 'A' },
    { label: 'Oil (유화)', value: 'Oil', code: 'O' },
    { label: 'Mixed (혼합재료)', value: 'Mixed', code: 'M' },
  ];

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedMaterial !== 'ALL' ||
    selectedYear !== 'ALL' ||
    isFeaturedOnly;

  return (
    <section className="bg-white border-b border-neutral-200 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-3.5">
        {/* Top Row: Search Input + Sort Dropdown */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="artwork-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="작품 제목, 작품번호(예: 26030PA), 규격, 재료, 작가노트 검색..."
              className="w-full pl-10 pr-9 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md placeholder-neutral-400 text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-800 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                id="artwork-search-clear-btn"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5"
                title="검색어 지우기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Sort field */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <span className="text-neutral-400 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              정렬:
            </span>
            <select
              id="artwork-sort-select"
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as SortField)}
              className="bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-neutral-800 cursor-pointer"
            >
              <option value="displayOrder">전시 순서 (Display Order)</option>
              <option value="yearDesc">제작연도 최신순 (2026 → 과거)</option>
              <option value="yearAsc">제작연도 오래된순</option>
              <option value="code">작품번호순 (코드 오름차순)</option>
              <option value="title">작품제목순 (가나다/ABC)</option>
            </select>
          </div>
        </div>

        {/* Bottom Row: Material Filter + Year Filter + Featured Toggle + Reset */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs pt-1">
          {/* Material Pills */}
          <div className="flex items-center gap-1 bg-neutral-100/80 p-0.5 rounded-md border border-neutral-200">
            {materials.map((m) => {
              const isActive = selectedMaterial === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  id={`material-filter-${m.value.toLowerCase()}`}
                  onClick={() => onMaterialChange(m.value)}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-neutral-900 font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Year Filter Pills or Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider pl-1">연도:</span>
            <button
              type="button"
              id="year-filter-all"
              onClick={() => onYearChange('ALL')}
              className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                selectedYear === 'ALL'
                  ? 'bg-neutral-900 text-white border-neutral-900 font-medium'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
              }`}
            >
              전체
            </button>
            {availableYears.map((yr) => {
              const isYearActive = selectedYear === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  id={`year-filter-${yr}`}
                  onClick={() => onYearChange(yr)}
                  className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                    isYearActive
                      ? 'bg-neutral-900 text-white border-neutral-900 font-medium'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {yr}
                </button>
              );
            })}
          </div>

          {/* Featured Filter Toggle */}
          <button
            type="button"
            id="featured-filter-toggle-btn"
            onClick={onToggleFeaturedOnly}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs transition-all ${
              isFeaturedOnly
                ? 'bg-amber-50 text-amber-900 border-amber-300 font-medium'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isFeaturedOnly ? 'fill-amber-500 text-amber-500' : 'text-neutral-400'
              }`}
            />
            <span>대표작만 표시 (Featured)</span>
          </button>

          {/* Reset button when filtered */}
          {hasActiveFilters && (
            <button
              type="button"
              id="reset-all-filters-btn"
              onClick={onResetFilters}
              className="text-neutral-500 hover:text-neutral-900 underline underline-offset-2 ml-auto text-xs flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              필터 초기화 ({totalFiltered}/{totalAll}점 표시)
            </button>
          )}

          {!hasActiveFilters && (
            <span className="text-neutral-400 ml-auto text-[11px]">
              전체 {totalAll}점의 작품
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
