import React, { useState, useEffect, useMemo } from 'react';
import { Artwork, PortfolioMenu, SiteSettings } from '../../types';
import { ArrowRight, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { formatMaterialOnCanvas } from '../../utils/formatters';
import { getArtistProfile } from '../../utils/artistProfile';

interface CoverViewProps {
  artworks: Artwork[];
  settings: SiteSettings;
  onNavigate: (tab: PortfolioMenu) => void;
  onSelectArtwork?: (artwork: Artwork) => void;
}

export const CoverView: React.FC<CoverViewProps> = ({
  artworks,
  settings,
  onNavigate,
  onSelectArtwork,
}) => {
  const artist = getArtistProfile(settings);

  // 1. Filter only artworks with isFeatured === true, sorted strictly by displayOrder
  const featuredArtworks = useMemo(() => {
    const featured = artworks.filter((a) => a.isFeatured);
    if (featured.length > 0) {
      return featured.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    // Fallback if no artworks have isFeatured flag
    const sorted = [...artworks].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return sorted.slice(0, 1);
  }, [artworks]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Keep index within bounds if featured list changes
  useEffect(() => {
    if (currentIndex >= featuredArtworks.length && featuredArtworks.length > 0) {
      setCurrentIndex(0);
    }
  }, [featuredArtworks.length, currentIndex]);

  // 2. Auto slide every 6 seconds (between 5~8 seconds) with circular loop
  useEffect(() => {
    if (featuredArtworks.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredArtworks.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [featuredArtworks.length]);

  const currentArtwork = featuredArtworks[currentIndex] || featuredArtworks[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (featuredArtworks.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + featuredArtworks.length) % featuredArtworks.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (featuredArtworks.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % featuredArtworks.length);
  };

  return (
    <div id="portfolio-cover-view" className="w-full py-8 sm:py-14 md:py-18">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cover Canvas Layout - A4 Landscape Inspired Editorial Framing */}
        <div className="bg-[#FAF9F6] border border-neutral-200/90 rounded-xs shadow-[0_4px_30px_rgba(0,0,0,0.03)] p-6 sm:p-10 md:p-14 transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Artist Identity, Contact Info & Navigation (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-8 sm:space-y-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.28em] uppercase text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-neutral-900 inline-block" />
                  <span>Fine Art Portfolio</span>
                </div>

                {/* Artist Name & Adjacent Compact Contact Info */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <h1 className="font-serif-title text-3xl sm:text-4xl md:text-5xl font-normal text-neutral-950 tracking-tight leading-[1.08]">
                        {artist.englishName}
                      </h1>
                      <p className="text-sm font-light tracking-[0.25em] text-neutral-500 uppercase mt-1.5">
                        {artist.formattedKoHanja}
                      </p>
                    </div>

                    {/* CONTACT info displayed concisely in appropriate margin next to artist name */}
                    {settings && (
                      <div className="flex flex-col gap-1 text-[11px] font-mono-code text-neutral-500 sm:border-l sm:border-neutral-300/80 sm:pl-3.5 pt-0.5 sm:mt-1">
                        {settings.contactEmail && (
                          <a
                            href={`mailto:${settings.contactEmail}`}
                            className="hover:text-neutral-900 transition-colors flex items-center gap-1.5"
                            title="Email"
                          >
                            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Email</span>
                            <span className="font-medium text-neutral-800 truncate max-w-[170px]">
                              {settings.contactEmail}
                            </span>
                          </a>
                        )}
                        {settings.websiteUrl && (
                          <a
                            href={
                              settings.websiteUrl.startsWith('http')
                                ? settings.websiteUrl
                                : `https://${settings.websiteUrl}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-neutral-900 transition-colors flex items-center gap-1.5"
                            title="Website"
                          >
                            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Web</span>
                            <span className="text-neutral-700 truncate max-w-[170px]">
                              {settings.websiteUrl.replace(/^https?:\/\//, '')}
                            </span>
                          </a>
                        )}
                        {settings.instagramUrl && (
                          <a
                            href={
                              settings.instagramUrl.startsWith('http')
                                ? settings.instagramUrl
                                : `https://instagram.com/${settings.instagramUrl.replace('@', '')}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-neutral-900 transition-colors flex items-center gap-1.5"
                            title="Instagram"
                          >
                            <span className="text-[10px] text-neutral-400 uppercase tracking-wider">IG</span>
                            <span className="text-neutral-700 truncate max-w-[170px]">
                              {settings.instagramUrl}
                            </span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-300/80 max-w-sm">
                  <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
                    캔버스 위의 물질성과 시간의 층위를 탐구하는 한국 현대 회화 포트폴리오
                  </p>
                </div>
              </div>

              {/* Quick Entry Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  id="cover-enter-works-btn"
                  onClick={() => onNavigate('WORKS')}
                  className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-4 px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium tracking-[0.14em] uppercase transition-all shadow-xs group cursor-pointer"
                >
                  <span>작품 갤러리 탐색 (WORKS)</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-500">
                  <button
                    type="button"
                    onClick={() => onNavigate('WORKS_LIST')}
                    className="hover:text-neutral-900 hover:underline px-1.5 py-1 tracking-wider cursor-pointer"
                  >
                    작품목록 ({artworks.length}점)
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('CV')}
                    className="hover:text-neutral-900 hover:underline px-1.5 py-1 tracking-wider cursor-pointer"
                  >
                    작가 이력 (CV)
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('ARTIST_NOTE')}
                    className="hover:text-neutral-900 hover:underline px-1.5 py-1 tracking-wider cursor-pointer"
                  >
                    작가노트
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('CONTACT')}
                    className="hover:text-neutral-900 hover:underline px-1.5 py-1 tracking-wider cursor-pointer"
                  >
                    연락처
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Featured Painting Auto-Slide Showcase (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              {currentArtwork ? (
                <div
                  className="w-full group cursor-pointer"
                  onClick={() => onSelectArtwork && onSelectArtwork(currentArtwork)}
                  title="클릭하여 작품 상세 도록 보기"
                >
                  {/* Artwork Showcase Frame - Original Aspect Ratio Preserved strictly with object-contain */}
                  <div className="relative bg-[#F3F2EE] border border-neutral-200/80 p-4 sm:p-8 flex items-center justify-center min-h-[340px] sm:min-h-[440px] md:min-h-[500px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
                    <img
                      key={currentArtwork.id}
                      src={currentArtwork.imageUrl}
                      alt={currentArtwork.title}
                      referrerPolicy="no-referrer"
                      className="max-h-[420px] sm:max-h-[460px] max-w-full w-auto h-auto object-contain transition-all duration-700 ease-out shadow-[0_6px_25px_rgba(0,0,0,0.08)] bg-white"
                    />

                    {/* Subtle Featured Marker & Slide Counter */}
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs px-2.5 py-1 text-[10px] tracking-widest uppercase font-mono-code text-neutral-800 border border-neutral-200/90 flex items-center gap-1.5 shadow-2xs">
                      <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      <span>FEATURED</span>
                      {featuredArtworks.length > 1 && (
                        <span className="text-neutral-400 pl-1 border-l border-neutral-200">
                          {currentIndex + 1} / {featuredArtworks.length}
                        </span>
                      )}
                    </div>

                    {/* Subtle Manual Navigation Arrows (Visible when multiple featured works exist) */}
                    {featuredArtworks.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrev}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 hover:bg-white text-neutral-700 hover:text-neutral-950 shadow-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="이전 대표작"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNext}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 hover:bg-white text-neutral-700 hover:text-neutral-950 shadow-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="다음 대표작"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Slide Dots Indicator */}
                    {featuredArtworks.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-xs">
                        {featuredArtworks.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentIndex(idx);
                            }}
                            className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === currentIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                            }`}
                            title={`대표작 ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Artwork Dossier Caption */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline justify-between text-xs text-neutral-500 gap-1 px-1">
                    <div>
                      <span className="font-serif-title font-medium text-neutral-900 text-sm sm:text-base mr-2">
                        {currentArtwork.title}
                      </span>
                      <span className="text-neutral-400 font-mono-code">
                        ({currentArtwork.code})
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-neutral-700 font-mono-code">
                      <span>{formatMaterialOnCanvas(currentArtwork.material)}</span>
                      <span className="mx-1.5 text-neutral-300">·</span>
                      <span>{currentArtwork.widthCm} × {currentArtwork.heightCm} cm</span>
                      <span className="mx-1.5 text-neutral-300">·</span>
                      <span>{currentArtwork.year}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-80 bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
                  등록된 작품이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minimal Footnote / Spec summary */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 px-2 tracking-wider">
          <span>{artist.englishName} ARCHIVE & PORTFOLIO · ALL RIGHTS RESERVED</span>
          <span className="font-mono-code mt-1 sm:mt-0">
            FIREBASE FIRESTORE SYNCED · {artworks.length} WORKS
          </span>
        </div>
      </div>
    </div>
  );
};
