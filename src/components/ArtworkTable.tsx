import React from 'react';
import { Star, Edit3, Eye, Trash2 } from 'lucide-react';
import { Artwork } from '../types';

interface ArtworkTableProps {
  artworks: Artwork[];
  onSelect: (art: Artwork) => void;
  onEdit: (art: Artwork) => void;
  onDelete: (art: Artwork) => void;
}

export const ArtworkTable: React.FC<ArtworkTableProps> = ({
  artworks,
  onSelect,
  onEdit,
  onDelete,
}) => {
  if (artworks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-md overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-medium">
              <th className="py-3 px-3 text-center w-12">순서</th>
              <th className="py-3 px-3 w-16">이미지</th>
              <th className="py-3 px-4 font-mono-code">작품번호 (Code)</th>
              <th className="py-3 px-4">작품 제목 (Title)</th>
              <th className="py-3 px-3">호수 규격</th>
              <th className="py-3 px-3">규격 (가로×세로 cm)</th>
              <th className="py-3 px-3">재료 (Material)</th>
              <th className="py-3 px-3 text-center">연도</th>
              <th className="py-3 px-3 text-center">대표작</th>
              <th className="py-3 px-4 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 text-neutral-800">
            {artworks.map((art) => (
              <tr
                key={art.id}
                id={`table-row-${art.id}`}
                className="hover:bg-neutral-50/80 transition-colors group cursor-pointer"
                onClick={() => onSelect(art)}
              >
                {/* Display Order */}
                <td className="py-2.5 px-3 text-center font-mono-code text-neutral-400">
                  {art.displayOrder}
                </td>

                {/* Thumbnail - strictly preserving aspect ratio */}
                <td className="py-2.5 px-3">
                  <div className="w-12 h-12 bg-neutral-100 rounded border border-neutral-200/80 flex items-center justify-center p-1 overflow-hidden">
                    <img
                      src={art.imageUrl}
                      alt={art.title}
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full w-auto h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                </td>

                {/* Artwork Code */}
                <td className="py-2.5 px-4 font-mono-code font-medium text-neutral-900 whitespace-nowrap">
                  <span className="bg-neutral-100 px-2 py-1 rounded border border-neutral-200 text-xs">
                    {art.code}
                  </span>
                </td>

                {/* Title */}
                <td className="py-2.5 px-4 font-serif-title text-sm font-medium text-neutral-900 group-hover:text-neutral-600">
                  {art.title}
                </td>

                {/* Canvas Size Code */}
                <td className="py-2.5 px-3 font-mono-code text-neutral-600 font-medium">
                  {art.canvasSizeCode}
                </td>

                {/* Width x Height cm */}
                <td className="py-2.5 px-3 text-neutral-700 whitespace-nowrap">
                  {art.widthCm} × {art.heightCm} cm
                </td>

                {/* Material */}
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200/60 text-[11px]">
                    {art.material} ({art.materialCode})
                  </span>
                </td>

                {/* Year */}
                <td className="py-2.5 px-3 text-center font-mono-code text-neutral-600">
                  {art.year}
                </td>

                {/* Featured */}
                <td className="py-2.5 px-3 text-center">
                  {art.isFeatured ? (
                    <Star className="w-4 h-4 fill-amber-400 text-amber-500 inline-block" />
                  ) : (
                    <span className="text-neutral-300">-</span>
                  )}
                </td>

                {/* Actions */}
                <td
                  className="py-2.5 px-4 text-right whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(art)}
                      className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                      title="A4 상세 팝업"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(art)}
                      className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                      title="작품 수정"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(art)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="작품 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
