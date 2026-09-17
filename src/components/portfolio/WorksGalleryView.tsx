import React, { useState, useMemo } from 'react';
import { Artwork, MaterialType, SiteSettings } from '../../types';
import { Search, Sparkles, Filter } from 'lucide-react';
import { formatMaterialOnCanvas } from '../../utils/formatters';
import { getArtistProfile } from '../../utils/artistProfile';

interface WorksGalleryViewProps {
  artworks: Artwork[];
  settings?: SiteSettings;
  onSelectArtwork: (artwork: Artwork) => void;
  isAdmin?: boolean;
  onEditArtwork?: (artwork: Artwork) => void;
}

export const WorksGalleryView: React.FC<WorksGalleryViewProps> = ({
  artworks,
  settings,
  onSelectArtwork,
  isAdmin,
  onEditArtwork,
}) => {
  const artist = getArtistProfile(settings);
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState<MaterialType | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = useState<number | 'ALL'>('ALL');
  const [isFeaturedOnly, setIsFeaturedOnly] = useState(false);

  // Maintain displayOrder ascending
  const sortedArtworks = useMemo(() => {
    return [...artworks].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [artworks]);

  const availableYears = useMemo(() => {
    const list: number[] = Array.from(
      new Set(artworks.map((a) => a.year).filter((y): y is number => typeof y === 'number'))
    );
    return list.sort((a, b) => b - a);
  }, [artworks]);

  const filteredList = useMemo(() => {
    return sortedArtworks.filter((art) => {
      if (isFeaturedOnly && !art.isFeatured) return false;
      if (materialFilter !== 'ALL' && art.material !== materialFilter) return false;
      if (yearFilter !== 'ALL' && art.year !== yearFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = art.title.toLowerCase().includes(q);
        const matchCode = art.code.toLowerCase().includes(q);
        const matchSize = art.canvasSizeCode.toLowerCase().includes(q);
        const matchMat = art.material.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchSize && !matchMat) return false;
      }
      return true;
    });
  }, [sortedArtworks, isFeaturedOnly, materialFilter, yearFilter, searchQuery]);

  return (
    <div id="portfolio-works-gallery-view" className="w-full py-8 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="border-b border-neutral-300 pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono-code tracking-[0.25em] uppercase text-neutral-400 block mb-1">
              GALLERY EXHIBITION · 작품 갤러리
            </span>
            <h1 className="font-serif-title text-3xl sm:text-4xl text-neutral-950 font-normal">
              SELECTED WORKS
            </h1>
            <p className="text-xs text-neutral-500 font-light tracking-widest uppercase mt-1">
              {artist.englishName} ({artist.formattedKoHanja}) · {filteredList.length}점 전시 중
            </p>
          </div>

          <div className="text-xs text-neutral-500 font-mono-code">
            <span>PRESERVED ASPECT RATIO · ORIGINAL SCALE</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-neutral-50 border border-neutral-200 p-3 sm:p-4 rounded-xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="작품 검색 (제목, 작품번호)..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 text-xs"
            />
          </div>

          {/* Filter Dropdowns & Featured Pill */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => setIsFeaturedOnly(!isFeaturedOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors border ${
                isFeaturedOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-medium'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>대표작품 (Featured)</span>
            </button>

            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-white border border-neutral-300 rounded text-neutral-700 focus:outline-none"
            >
              <option value="ALL">전체 재료 (Material)</option>
              <option value="Acrylic">Acrylic (아크릴)</option>
              <option value="Oil">Oil (유화)</option>
              <option value="Mixed">Mixed (혼합재료)</option>
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-neutral-300 rounded text-neutral-700 focus:outline-none font-mono-code"
            >
              <option value="ALL">전체 연도 (Year)</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}년
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gallery Grid: Artwork aspect ratio strictly preserved */}
        {filteredList.length === 0 ? (
          <div className="py-20 text-center text-neutral-400 text-xs">
            일치하는 작품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
            {filteredList.map((art) => (
              <div
                key={art.id}
                id={`gallery-artwork-${art.id}`}
                onClick={() => onSelectArtwork(art)}
                className="group cursor-pointer bg-white border border-neutral-200/90 rounded-xs shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all flex flex-col justify-between overflow-hidden"
                title="클릭하여 작품 상세 도록 보기"
              >
                {/* Wall Stage: Object-contain preserves original aspect ratio strictly */}
                <div className="relative bg-[#F5F4F0] p-4 sm:p-6 flex items-center justify-center min-h-[280px] sm:min-h-[320px] max-h-[380px] border-b border-neutral-200/80 overflow-hidden">
                  <img
                    src={art.imageUrl}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[260px] sm:max-h-[300px] max-w-full w-auto h-auto object-contain transition-transform duration-500 group-hover:scale-[1.02] shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white"
                  />

                  {/* Badge */}
                  {art.isFeatured && (
                    <div className="absolute top-3 right-3 bg-amber-50/95 border border-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-mono-code flex items-center gap-1 shadow-xs">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      <span>대표작</span>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-3 text-[10px] font-mono-code text-neutral-400">
                    {art.widthCm} × {art.heightCm} cm
                  </div>
                </div>

                {/* Museum Label / Caption Area */}
                <div className="p-4 sm:p-5 space-y-2 bg-white">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono-code text-xs font-semibold text-neutral-900 tracking-wider">
                      {art.code}
                    </span>
                    <span className="font-mono-code text-xs text-neutral-400">
                      {art.year}
                    </span>
                  </div>

                  <h3 className="font-serif-title text-base sm:text-lg font-medium text-neutral-950 group-hover:text-neutral-700 transition-colors line-clamp-1">
                    {art.title}
                  </h3>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 font-light">
                    <span>
                      {formatMaterialOnCanvas(art.material)}
                    </span>
                    <span className="font-mono-code text-neutral-700 font-medium">
                      {art.widthCm} × {art.heightCm} cm
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Minimal Footer */}
        <div className="mt-12 pt-6 border-t border-neutral-200 text-center text-[11px] text-neutral-400 font-mono-code tracking-wider">
          {artist.englishName} ARCHIVE · FIREBASE STORAGE IMAGES PRESERVED IN ORIGINAL ASPECT RATIO
        </div>
      </div>
    </div>
  );
};
