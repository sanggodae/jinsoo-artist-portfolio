import React from 'react';
import { Star, Edit3, Eye } from 'lucide-react';
import { Artwork } from '../types';

interface ArtworkCardProps {
  artwork: Artwork;
  onSelect: (art: Artwork) => void;
  onEdit: (art: Artwork, e: React.MouseEvent) => void;
}

export const ArtworkCard: React.FC<ArtworkCardProps> = ({ artwork, onSelect, onEdit }) => {
  return (
    <article
      id={`artwork-card-${artwork.id}`}
      onClick={() => onSelect(artwork)}
      className="group cursor-pointer bg-white border border-neutral-200/80 hover:border-neutral-400 rounded-sm transition-all duration-200 flex flex-col overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
    >
      {/* Artwork Display Frame - Strict No-Crop Aspect Ratio Preservation */}
      <div className="relative w-full h-72 sm:h-80 bg-[#F7F7F6] border-b border-neutral-100 flex items-center justify-center p-4 sm:p-5 select-none overflow-hidden">
        {/* The Painting: object-contain guarantees original aspect ratio is never cropped or distorted */}
        <img
          src={artwork.imageUrl}
          alt={artwork.title}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full w-auto h-auto object-contain shadow-[0_2px_12px_rgba(0,0,0,0.08)] group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition-all duration-300 group-hover:scale-[1.015]"
          loading="lazy"
        />

        {/* Featured Badge */}
        {artwork.isFeatured && (
          <div
            className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded text-[10px] font-medium tracking-wide flex items-center gap-1 shadow-xs"
            title="대표작 (Featured)"
          >
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            <span>FEATURED</span>
          </div>
        )}

        {/* Display Order Pill */}
        <div className="absolute top-3 right-3 bg-neutral-900/70 text-white text-[10px] font-mono-code px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          #{artwork.displayOrder}
        </div>

        {/* Quick Action Overlay on hover */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(artwork);
            }}
            className="p-1.5 bg-white/90 hover:bg-white text-neutral-800 rounded text-xs shadow-xs flex items-center gap-1 transition-colors"
            title="A4 가로형 상세 팝업 열기"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium pr-1">A4 상세</span>
          </button>
          <button
            type="button"
            onClick={(e) => onEdit(artwork, e)}
            className="p-1.5 bg-white/90 hover:bg-white text-neutral-800 rounded text-xs shadow-xs flex items-center gap-1 transition-colors"
            title="작품 정보 수정"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium pr-1">수정</span>
          </button>
        </div>
      </div>

      {/* Artwork Metadata Caption */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-2 bg-white">
        <div>
          {/* Top Line: Artwork Code */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono-code font-medium text-neutral-500 tracking-wider text-[11px] bg-neutral-100/90 px-1.5 py-0.5 rounded border border-neutral-200/60">
              {artwork.code}
            </span>
            <span className="text-neutral-400 text-[11px]">
              {artwork.year}년
            </span>
          </div>

          {/* Title */}
          <h3 className="font-serif-title text-base sm:text-lg font-medium text-neutral-900 leading-snug tracking-tight line-clamp-1 group-hover:text-neutral-600 transition-colors">
            {artwork.title}
          </h3>
        </div>

        {/* Bottom Line: Size & Material */}
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">
            {artwork.widthCm} × {artwork.heightCm} cm
            <span className="text-neutral-400 font-mono-code ml-1 font-normal">
              ({artwork.canvasSizeCode})
            </span>
          </span>
          <span className="px-1.5 py-0.5 bg-neutral-50 border border-neutral-200/60 rounded text-[11px] text-neutral-600 font-medium">
            {artwork.material}
          </span>
        </div>
      </div>
    </article>
  );
};
