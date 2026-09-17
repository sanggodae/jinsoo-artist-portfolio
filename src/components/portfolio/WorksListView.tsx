import React, { useState, useMemo } from 'react';
import { Artwork, MaterialType, SiteSettings } from '../../types';
import {
  Search,
  Eye,
  Filter,
  ArrowUpDown,
  Edit3,
  Trash2,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { formatMaterialOnCanvas } from '../../utils/formatters';
import { getArtistProfile } from '../../utils/artistProfile';

interface WorksListViewProps {
  artworks: Artwork[];
  settings?: SiteSettings;
  onSelectArtwork: (artwork: Artwork) => void;
  isAdmin?: boolean;
  onEditArtwork?: (artwork: Artwork) => void;
  onDeleteArtwork?: (artwork: Artwork) => void;
}

type SortOption = 'displayOrder' | 'yearDesc' | 'yearAsc' | 'code' | 'title';

export const WorksListView: React.FC<WorksListViewProps> = ({
  artworks,
  settings,
  onSelectArtwork,
  isAdmin,
  onEditArtwork,
  onDeleteArtwork,
}) => {
  const artist = getArtistProfile(settings);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState<MaterialType | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = useState<number | 'ALL'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('displayOrder');

  // Available years extracted dynamically from all artworks (sorted descending: 2026, 2025, ...)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    artworks.forEach((a) => {
      if (typeof a.year === 'number') {
        yearsSet.add(a.year);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [artworks]);

  // Sorting logic (Default: displayOrder 우선, 없으면 등록순/최신작 우선)
  const sortedArtworks = useMemo(() => {
    const list = [...artworks];
    return list.sort((a, b) => {
      switch (sortOption) {
        case 'displayOrder': {
          const orderA =
            a.displayOrder !== undefined && a.displayOrder !== null
              ? a.displayOrder
              : 999999;
          const orderB =
            b.displayOrder !== undefined && b.displayOrder !== null
              ? b.displayOrder
              : 999999;
          if (orderA !== orderB) return orderA - orderB;
          // 2차 정렬: 최신 제작연도
          if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
          // 3차 정렬: 등록일시 최신순
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        case 'yearDesc':
          return (
            (b.year || 0) - (a.year || 0) ||
            (a.displayOrder || 0) - (b.displayOrder || 0)
          );
        case 'yearAsc':
          return (
            (a.year || 0) - (b.year || 0) ||
            (a.displayOrder || 0) - (b.displayOrder || 0)
          );
        case 'code':
          return a.code.localeCompare(b.code, undefined, { numeric: true });
        case 'title':
          return a.title.localeCompare(b.title, 'ko');
        default:
          return 0;
      }
    });
  }, [artworks, sortOption]);

  // Combined Search & Filter logic (Year, Material, Code, Title, etc.)
  const filteredList = useMemo(() => {
    return sortedArtworks.filter((art) => {
      // 1. Material Filter
      if (materialFilter !== 'ALL' && art.material !== materialFilter) {
        return false;
      }

      // 2. Year Filter
      if (yearFilter !== 'ALL' && art.year !== yearFilter) {
        return false;
      }

      // 3. Search Query (작품번호, 작품명, 재료, 연도, 규격)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();

        // 작품번호 검색 (기존 및 신규 체계 모두 대응)
        const matchCode = art.code ? art.code.toLowerCase().includes(q) : false;

        // 작품명 검색
        const matchTitle = art.title ? art.title.toLowerCase().includes(q) : false;

        // Material 검색 (영문, Canvas 접미사, 한국어 대응)
        const rawMat = (art.material || '').toLowerCase();
        const formattedMat = formatMaterialOnCanvas(art.material).toLowerCase();
        const matchMat =
          rawMat.includes(q) ||
          formattedMat.includes(q) ||
          (q.includes('아크릴') && rawMat === 'acrylic') ||
          (q.includes('유화') && rawMat === 'oil') ||
          (q.includes('혼합') && rawMat === 'mixed');

        // Year 검색 (예: 2026, 2025)
        const matchYear = String(art.year).includes(q);

        // Size cm 검색 (예: 65.1, 90.9, 116.7)
        const matchSize =
          String(art.widthCm).includes(q) || String(art.heightCm).includes(q);

        if (!matchCode && !matchTitle && !matchMat && !matchYear && !matchSize) {
          return false;
        }
      }

      return true;
    });
  }, [sortedArtworks, materialFilter, yearFilter, searchQuery]);

  // Check if any filter or search is currently active
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    materialFilter !== 'ALL' ||
    yearFilter !== 'ALL' ||
    sortOption !== 'displayOrder';

  const handleResetFilters = () => {
    setSearchQuery('');
    setMaterialFilter('ALL');
    setYearFilter('ALL');
    setSortOption('displayOrder');
  };

  return (
    <div id="portfolio-works-list-view" className="w-full py-8 sm:py-14 bg-[#FAF9F6] min-h-[70vh]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =========================================================
            1. Header Section: Fine Art Catalogue Header
            ========================================================= */}
        <div className="border-b border-neutral-300/80 pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono-code tracking-[0.25em] uppercase text-neutral-400 block mb-1">
              CATALOGUE RAISONNÉ INDEX · 정식 작품목록
            </span>
            <h1 className="font-serif-title text-3xl sm:text-4xl text-neutral-950 font-normal tracking-tight">
              WORKS LIST
            </h1>
            <p className="text-xs text-neutral-500 font-light tracking-widest uppercase mt-1.5 flex items-center gap-2">
              <span className="font-medium text-neutral-700">{artist.englishName}</span>
              <span>({artist.formattedKoHanja})</span>
              <span>·</span>
              <span>총 {artworks.length}점 아카이브</span>
            </p>
          </div>

          {/* Archive Status Counter */}
          <div className="text-xs text-neutral-500 font-mono-code flex items-center gap-3">
            <span className="px-2.5 py-1 bg-white border border-neutral-200 rounded text-neutral-700 font-medium">
              표시 중: <strong className="text-neutral-950">{filteredList.length}</strong> / {artworks.length} WORKS
            </span>
          </div>
        </div>

        {/* =========================================================
            2. Search & Filter Bar (검색, 연도 필터, 재료 필터, 정렬)
            ========================================================= */}
        <div className="bg-white border border-neutral-200/90 p-4 sm:p-5 rounded-xs mb-8 shadow-xs space-y-3.5">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* 2-1. Search Input (작품번호, 작품명, 재료, 연도 검색) */}
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                id="works-list-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="작품번호 (예: 26030PA), 작품명, 재료, 제작연도 검색..."
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-300 rounded focus:outline-none focus:bg-white focus:border-neutral-900 transition-colors text-neutral-900 placeholder-neutral-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5"
                  title="검색어 지우기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2-2. Filters: YEAR & MATERIAL & SORT */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Year Filter */}
              <div className="relative">
                <select
                  id="works-list-year-filter"
                  value={yearFilter}
                  onChange={(e) =>
                    setYearFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                  className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs text-neutral-800 font-mono-code focus:outline-none focus:border-neutral-900 cursor-pointer"
                  title="제작연도 필터"
                >
                  <option value="ALL">전체 연도 (Year: All)</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}년
                    </option>
                  ))}
                </select>
              </div>

              {/* Material Filter */}
              <div className="relative">
                <select
                  id="works-list-material-filter"
                  value={materialFilter}
                  onChange={(e) => setMaterialFilter(e.target.value as any)}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer"
                  title="재료 필터"
                >
                  <option value="ALL">전체 재료 (Material: All)</option>
                  <option value="Acrylic">Acrylic on Canvas</option>
                  <option value="Oil">Oil on Canvas</option>
                  <option value="Mixed">Mixed Material on Canvas</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="relative flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 hidden sm:inline" />
                <select
                  id="works-list-sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded text-xs text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer font-medium"
                  title="목록 정렬"
                >
                  <option value="displayOrder">기본 전시순 (최신작 우선)</option>
                  <option value="yearDesc">제작연도 최신순 (2026 → 과거)</option>
                  <option value="yearAsc">제작연도 오래된순</option>
                  <option value="code">작품번호 오름차순</option>
                  <option value="title">작품명 가나다순</option>
                </select>
              </div>

              {/* Reset Filter Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                  title="필터 초기화"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">초기화</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
              <span className="text-neutral-400 font-medium">적용 필터:</span>
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-neutral-800">
                  검색어: "{searchQuery}"
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setSearchQuery('')}
                  />
                </span>
              )}
              {yearFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-neutral-800 font-mono-code">
                  연도: {yearFilter}년
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setYearFilter('ALL')}
                  />
                </span>
              )}
              {materialFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-neutral-800">
                  재료: {formatMaterialOnCanvas(materialFilter)}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-neutral-950"
                    onClick={() => setMaterialFilter('ALL')}
                  />
                </span>
              )}
              {sortOption !== 'displayOrder' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-neutral-800">
                  정렬 변경됨
                </span>
              )}
            </div>
          )}
        </div>

        {/* =========================================================
            3. Desktop View: Catalogue Raisonné Table (md 이상)
            ========================================================= */}
        <div className="hidden md:block border border-neutral-300/80 bg-white rounded-xs overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-[#FAF9F6] text-neutral-600 font-mono-code text-[11px] uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4 w-12 text-center text-neutral-400">#</th>
                  <th className="py-3.5 px-4 w-28 text-center font-semibold text-neutral-800">
                    작품 도판
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-neutral-800 min-w-[130px]">
                    작품번호
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-neutral-800 min-w-[200px]">
                    작품명 (Title)
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-neutral-800 min-w-[140px]">
                    Canvas Size
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-neutral-800 min-w-[170px]">
                    Material
                  </th>
                  <th className="py-3.5 px-4 text-center font-semibold text-neutral-800 w-20">
                    Year
                  </th>
                  <th className="py-3.5 px-4 text-right font-semibold text-neutral-800 w-28">
                    {isAdmin ? '관리' : '상세보기'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-neutral-400">
                      <p className="text-sm text-neutral-600 mb-2">
                        조건에 일치하는 작품이 없습니다.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-neutral-900 underline hover:text-neutral-600 font-medium"
                      >
                        필터 초기화
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredList.map((artwork, idx) => (
                    <tr
                      key={artwork.id}
                      onClick={() => onSelectArtwork(artwork)}
                      className="hover:bg-neutral-50/90 cursor-pointer transition-colors group"
                      title="클릭하여 작품 상세 도록 보기"
                    >
                      {/* 1. Sequence / Order Index */}
                      <td className="py-4 px-4 text-center font-mono-code text-neutral-400 text-xs">
                        {artwork.displayOrder ?? idx + 1}
                      </td>

                      {/* 2. Artwork Thumbnail (눈에 가장 먼저 들어오도록 넉넉한 도판 프레임 + contain 비율 보존) */}
                      <td className="py-3 px-4 text-center">
                        <div className="w-20 h-20 mx-auto bg-[#F8F7F4] border border-neutral-200/90 rounded-xs flex items-center justify-center p-1 overflow-hidden shadow-2xs group-hover:border-neutral-400 transition-colors">
                          <img
                            src={artwork.imageUrl}
                            alt={artwork.title}
                            referrerPolicy="no-referrer"
                            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                      </td>

                      {/* 3. 작품번호 (기존 번호 엄격 유지, 신규 번호 체계와 혼합되어도 깔끔한 표시) */}
                      <td className="py-4 px-4 font-mono-code font-semibold text-neutral-950 text-xs tracking-wide whitespace-nowrap">
                        {artwork.code}
                      </td>

                      {/* 4. 작품명 (Title) + Featured 배지 */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-serif-title font-medium text-neutral-950 text-sm sm:text-base leading-snug group-hover:text-neutral-700 transition-colors">
                            {artwork.title}
                          </span>
                          {artwork.isFeatured && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/90 font-medium">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              대표작
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Canvas Size (050P 등의 코드 대신 실제 widthCm × heightCm cm 표시) */}
                      <td className="py-4 px-4 font-mono-code font-medium text-neutral-900 text-xs whitespace-nowrap">
                        {artwork.widthCm} × {artwork.heightCm} cm
                      </td>

                      {/* 6. Material (Acrylic on Canvas, Oil on Canvas, Mixed Material on Canvas) */}
                      <td className="py-4 px-4 text-neutral-800 text-xs">
                        <span className="font-sans font-normal text-neutral-800">
                          {formatMaterialOnCanvas(artwork.material)}
                        </span>
                      </td>

                      {/* 7. Year */}
                      <td className="py-4 px-4 text-center font-mono-code font-medium text-neutral-700 text-xs">
                        {artwork.year}
                      </td>

                      {/* 8. Action (일반 방문자: 상세 아이콘 / 관리자: [수정] [삭제]) */}
                      <td className="py-4 px-4 text-right">
                        {isAdmin ? (
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onEditArtwork?.(artwork)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-2xs"
                              title="작품 정보 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
                              <span>수정</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteArtwork?.(artwork)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition-colors shadow-2xs"
                              title="작품 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              <span>삭제</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-neutral-500 group-hover:text-neutral-900 group-hover:bg-neutral-100 rounded transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                              <span>상세</span>
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================
            4. Mobile / Tablet View: Catalogue Card Rows (md 미만)
            ========================================================= */}
        <div className="block md:hidden space-y-3.5">
          {filteredList.length === 0 ? (
            <div className="py-12 bg-white border border-neutral-200 rounded text-center text-neutral-400 p-6">
              <p className="text-sm text-neutral-600 mb-2">
                조건에 일치하는 작품이 없습니다.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-neutral-900 underline hover:text-neutral-600 font-medium"
              >
                필터 초기화
              </button>
            </div>
          ) : (
            filteredList.map((artwork, idx) => (
              <div
                key={artwork.id}
                onClick={() => onSelectArtwork(artwork)}
                className="bg-white border border-neutral-200/90 rounded-xs p-3.5 flex gap-3.5 hover:border-neutral-400 transition-all cursor-pointer shadow-2xs group"
              >
                {/* 1. Large Artwork Thumbnail (가장 먼저 시선 집중) */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#F8F7F4] border border-neutral-200 rounded-xs flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* 2. Information Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    {/* Top line: Code + Year + Featured */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono-code text-xs font-semibold text-neutral-950 tracking-wide">
                        {artwork.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {artwork.isFeatured && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-sans px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-medium">
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            대표작
                          </span>
                        )}
                        <span className="font-mono-code text-[11px] text-neutral-500 font-medium">
                          {artwork.year}년
                        </span>
                      </div>
                    </div>

                    {/* Artwork Title */}
                    <h3 className="font-serif-title font-medium text-neutral-950 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-neutral-700 transition-colors">
                      {artwork.title}
                    </h3>
                  </div>

                  {/* Size & Material */}
                  <div>
                    <div className="text-[11px] text-neutral-700 font-mono-code">
                      <span className="font-medium text-neutral-900">
                        {artwork.widthCm} × {artwork.heightCm} cm
                      </span>
                      <span className="text-neutral-300 mx-1.5">·</span>
                      <span className="font-sans text-neutral-600">
                        {formatMaterialOnCanvas(artwork.material)}
                      </span>
                    </div>

                    {/* Admin Actions (관리자만 노출) */}
                    {isAdmin && (
                      <div
                        className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onEditArtwork?.(artwork)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-100 shadow-2xs"
                        >
                          <Edit3 className="w-3 h-3 text-neutral-500" />
                          <span>수정</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteArtwork?.(artwork)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 shadow-2xs"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                          <span>삭제</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* =========================================================
            5. Footer Meta & Status Note
            ========================================================= */}
        <div className="mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 font-mono-code gap-2 px-1">
          <span>{artist.englishName} CATALOGUE RAISONNÉ INDEX</span>
          <span>FIREBASE STORAGE IMAGES PRESERVED IN ORIGINAL ASPECT RATIO</span>
        </div>
      </div>
    </div>
  );
};
