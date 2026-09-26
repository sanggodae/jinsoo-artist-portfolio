import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  Maximize2,
} from 'lucide-react';
import { Artwork, SiteSettings } from '../types';
import { formatMaterialOnCanvas } from '../utils/formatters';
import { getArtistProfile } from '../utils/artistProfile';

interface ArtworkDetailModalProps {
  artwork: Artwork | null;
  settings?: SiteSettings;
  isAdmin?: boolean;
  onClose: () => void;
  onEdit: (art: Artwork) => void;
  onDelete: (art: Artwork) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
}

export const ArtworkDetailModal: React.FC<ArtworkDetailModalProps> = ({
  artwork,
  settings,
  isAdmin = false,
  onClose,
  onEdit,
  onDelete,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
  currentIndex,
  totalCount,
}) => {
  const artist = getArtistProfile(settings);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset image loading states when artwork changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [artwork?.id, artwork?.imageUrl]);

  // Keyboard navigation: Escape to close, Left/Right arrows for prev/next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onNavigatePrev && hasPrev) onNavigatePrev();
      if (e.key === 'ArrowRight' && onNavigateNext && hasNext) onNavigateNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigatePrev, onNavigateNext, hasPrev, hasNext]);

  if (!artwork) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    const sanitizedTitle = (artwork.title || '')
      .replace(/[^a-zA-Z0-9가-힣\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    document.title = `PARK_JIN_SOO_${artwork.code}_${sanitizedTitle}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const hasDescription =
    artwork.description && artwork.description.trim().length > 0;

  const isVertical = Boolean(
    artwork.heightCm && artwork.widthCm && Number(artwork.heightCm) > Number(artwork.widthCm)
  );
  const isHorizontal = Boolean(
    artwork.heightCm && artwork.widthCm && Number(artwork.widthCm) > Number(artwork.heightCm)
  );

  return (
    <div
      id="artwork-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      {/* Modal Container: Adaptively sized for vertical or horizontal works without empty void */}
      <div
        id="artwork-detail-a4-container"
        className={`relative w-full ${
          isVertical
            ? 'max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl'
            : 'max-w-4xl sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl'
        } bg-[#FCFCFA] border border-neutral-300/80 rounded-xs shadow-2xl overflow-hidden flex flex-col my-auto transition-all text-neutral-900 max-h-[96vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================
            1. Top Navigation Toolbar (no-print)
            ========================================================= */}
        <div className="no-print border-b border-neutral-200 bg-white px-3.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between select-none shrink-0">
          {/* Back to WORKS LIST */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              id="detail-back-to-list-btn"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-mono-code text-neutral-600 hover:text-neutral-950 px-2 sm:px-2.5 py-1.5 rounded bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors"
              title="작품목록으로 돌아가기"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-neutral-700" />
              <span className="font-semibold">← WORKS LIST</span>
            </button>

            {/* Catalogue Raisonné Header tag */}
            <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-400 font-mono-code tracking-wider uppercase">
              <span>{artist.englishName}</span>
              <span>·</span>
              <span>{artist.formattedKoHanja}</span>
            </div>
          </div>

          {/* Right Action Controls: [PRINT / A4], [수정], [삭제], [닫기] */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Featured Badge */}
            {artwork.isFeatured && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/90 font-medium">
                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                대표작
              </span>
            )}

            {/* A4 Landscape Print Button */}
            <button
              type="button"
              id="detail-print-a4-btn"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-mono-code text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded transition-colors"
              title="A4 가로 도록 양식으로 인쇄 및 PDF 저장"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-600" />
              <span>PRINT / A4</span>
            </button>

            {/* ADMIN ONLY CONTROLS: [수정], [삭제] */}
            {isAdmin && (
              <div className="flex items-center gap-1 pl-1 border-l border-neutral-200">
                <button
                  type="button"
                  id="detail-admin-edit-btn"
                  onClick={() => onEdit(artwork)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded transition-colors shadow-2xs"
                  title="작품 정보 수정 (관리자 전용)"
                >
                  <Edit3 className="w-3 h-3 text-neutral-600" />
                  <span>수정</span>
                </button>
                <button
                  type="button"
                  id="detail-admin-delete-btn"
                  onClick={() => onDelete(artwork)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="작품 삭제 (관리자 전용)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Close Modal (ESC) */}
            <button
              type="button"
              id="detail-close-btn"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors ml-0.5"
              title="닫기 (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================
            2. Main Artwork Body: Scrollable area
            - Minimized top and bottom blank space
            - Maximized artwork image size (vertical and horizontal responsive)
            ========================================================= */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-col items-center justify-start bg-[#FAF9F6] print:p-0 print:m-0 print:bg-white print:overflow-visible">
          {/* Frame Sheet */}
          <div className="w-full flex flex-col items-center print:max-w-full print:w-full">
            {/* -----------------------------------------------------
                2-1. Artwork Image (Centerpiece, original aspect ratio, contain)
                - Minimized top and bottom gaps
                - Height expanded up to 84vh for vertical works, 80vh for horizontal works
                - Object-contain preserves exact 100% original aspect ratio without distortion
                ----------------------------------------------------- */}
            <div className="w-full flex items-center justify-center py-1 bg-transparent select-none relative print:min-h-0 print:p-0 print:h-[110mm] print:max-h-[110mm]">
              {imageError ? (
                /* Fallback for Image Load Failure */
                <div className="w-full max-w-md py-12 px-6 bg-white border border-neutral-200 rounded text-center flex flex-col items-center justify-center text-neutral-400">
                  <AlertCircle className="w-8 h-8 text-neutral-300 mb-2" />
                  <p className="text-xs sm:text-sm text-neutral-700 font-medium mb-1">
                    작품 이미지를 불러올 수 없습니다.
                  </p>
                  <p className="text-[11px] text-neutral-400 font-mono-code">
                    Storage 연결 상태를 확인해 주세요.
                  </p>
                </div>
              ) : (
                <div className="relative max-w-full flex items-center justify-center">
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    referrerPolicy="no-referrer"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                    className={`${
                      isVertical
                        ? 'max-h-[74vh] sm:max-h-[78vh] md:max-h-[82vh] lg:max-h-[84vh]'
                        : 'max-h-[70vh] sm:max-h-[74vh] md:max-h-[78vh] lg:max-h-[80vh]'
                    } max-w-full w-auto h-auto object-contain shadow-[0_12px_36px_rgba(0,0,0,0.12)] border border-neutral-200/80 bg-white transition-opacity duration-300 print:shadow-none print:border print:border-neutral-300 print:max-h-[108mm] ${
                      imageLoaded ? 'opacity-100' : 'opacity-80'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* -----------------------------------------------------
                2-2. Artwork Caption (가로형 2줄 구조: 이미지 바로 아래 배치)
                첫 번째 줄: 작품번호 | 작품명 | Canvas Size (가로 × 세로 cm)
                두 번째 줄: Material | Year
                ----------------------------------------------------- */}
            <div className={`w-full ${isVertical ? 'max-w-2xl sm:max-w-3xl' : 'max-w-4xl sm:max-w-5xl lg:max-w-6xl'} mt-2 sm:mt-2.5 pt-2 sm:pt-2.5 border-t border-neutral-300/80 text-left print:mt-4 print:pt-3 print:max-w-full print:border-t-2 print:border-neutral-800`}>
              {/* Line 1: 작품번호 | 작품명 | Canvas Size */}
              <div className="flex flex-wrap items-baseline gap-x-2.5 sm:gap-x-3 gap-y-1 text-neutral-900 leading-tight">
                {/* 작품번호 */}
                <span className="font-mono-code font-bold text-sm sm:text-base text-neutral-950 tracking-wider">
                  {artwork.code}
                </span>

                <span className="text-neutral-300 select-none print:text-neutral-500">|</span>

                {/* 작품명 (Title) */}
                <h2 className="font-serif-title font-medium text-base sm:text-xl md:text-2xl text-neutral-950">
                  {artwork.title}
                </h2>

                <span className="text-neutral-300 select-none print:text-neutral-500">|</span>

                {/* Canvas Size (Firestore의 widthCm × heightCm 사용, 가로 × 세로 cm 형식) */}
                <span className="font-mono-code font-semibold text-xs sm:text-sm text-neutral-800 whitespace-nowrap">
                  {artwork.widthCm} × {artwork.heightCm} cm
                </span>
              </div>

              {/* Line 2: Material | Year */}
              <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 text-xs sm:text-sm text-neutral-600 mt-1 font-sans print:mt-1.5 print:text-neutral-800">
                {/* Material (Acrylic on Canvas, Oil on Canvas, Mixed Material on Canvas 변환 표시) */}
                <span className="text-neutral-800 font-medium">
                  {formatMaterialOnCanvas(artwork.material)}
                </span>

                <span className="text-neutral-300 select-none print:text-neutral-500">|</span>

                {/* Year */}
                <span className="font-mono-code text-neutral-700 font-medium print:text-neutral-900">
                  {artwork.year}
                </span>

                {/* Display Order (보조 표기) */}
                {artwork.displayOrder !== undefined && (
                  <>
                    <span className="text-neutral-300 select-none no-print">·</span>
                    <span className="font-mono-code text-[11px] text-neutral-400 no-print">
                      No. #{artwork.displayOrder}
                    </span>
                  </>
                )}
              </div>

              {/* -----------------------------------------------------
                  2-3. Artwork Description (Year 아래 영역)
                  - 작품 설명 때문에 작품 이미지가 작아지지 않음
                  - 내용이 길어도 잘리지 않고 스크롤하여 전체 확인 가능
                  ----------------------------------------------------- */}
              {hasDescription && (
                <div className="mt-2.5 pt-2 border-t border-neutral-200/80 print:mt-3 print:pt-2 print:border-neutral-300">
                  <span className="text-[10px] sm:text-[11px] font-mono-code tracking-[0.2em] text-neutral-400 uppercase block mb-1 font-medium print:text-neutral-700">
                    [작품 설명]
                  </span>
                  <p className="text-xs sm:text-sm text-neutral-700 font-light leading-relaxed whitespace-pre-line text-justify break-words print:text-black">
                    {artwork.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================
            3. Bottom Navigation Bar (no-print)
            이전/다음 이동 (← PREVIOUS / NEXT →) & WORKS LIST 뒤로가기
            ========================================================= */}
        <div className="no-print border-t border-neutral-200 bg-white px-4 sm:px-6 py-3 flex items-center justify-between select-none">
          {/* Previous Artwork Button */}
          <button
            type="button"
            id="detail-prev-btn"
            onClick={onNavigatePrev}
            disabled={!hasPrev}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code text-neutral-700 hover:text-neutral-950 disabled:text-neutral-300 disabled:hover:text-neutral-300 hover:bg-neutral-100 disabled:hover:bg-transparent rounded transition-colors"
            title="이전 작품 (단축키: ←)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-semibold">PREVIOUS</span>
          </button>

          {/* Center: Return to WORKS LIST link & Sequence indicator */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-neutral-500 hover:text-neutral-900 font-mono-code underline underline-offset-4 transition-colors"
            >
              WORKS LIST
            </button>
            {currentIndex !== undefined && totalCount !== undefined && (
              <span className="text-[11px] font-mono-code text-neutral-400">
                ({currentIndex + 1} / {totalCount})
              </span>
            )}
          </div>

          {/* Next Artwork Button */}
          <button
            type="button"
            id="detail-next-btn"
            onClick={onNavigateNext}
            disabled={!hasNext}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-code text-neutral-700 hover:text-neutral-950 disabled:text-neutral-300 disabled:hover:text-neutral-300 hover:bg-neutral-100 disabled:hover:bg-transparent rounded transition-colors"
            title="다음 작품 (단축키: →)"
          >
            <span className="font-semibold">NEXT</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
