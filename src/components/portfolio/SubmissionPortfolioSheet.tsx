import React from 'react';
import { Artwork, CVSection, CVItem, ArtistNoteItem, SiteSettings, Submission } from '../../types';
import { formatMaterialOnCanvas, formatCanvasDimensions } from '../../utils/formatters';
import { getArtistProfile } from '../../utils/artistProfile';
import { DEFAULT_ARTIST_NOTES } from '../../data/defaultPortfolioData';

interface SubmissionPortfolioSheetProps {
  submission: Submission;
  selectedArtworks: Artwork[];
  cvSections: CVSection[];
  selectedCvIds: string[];
  selectedArtistNote: ArtistNoteItem;
  coverArtwork?: Artwork;
  settings: SiteSettings;
}

// Canonical CV Section Metadata
const CANONICAL_SECTIONS = [
  { id: 'education', category: 'education', number: '01', titleEn: 'EDUCATION', titleKo: '학력' },
  { id: 'soloExhibitions', category: 'soloExhibitions', number: '02', titleEn: 'SOLO EXHIBITIONS', titleKo: '개인전' },
  { id: 'groupExhibitions', category: 'groupExhibitions', number: '03', titleEn: 'GROUP EXHIBITIONS', titleKo: '단체전' },
  { id: 'awards', category: 'awards', number: '04', titleEn: 'AWARDS', titleKo: '수상 및 선정' },
  { id: 'collections', category: 'collections', number: '05', titleEn: 'COLLECTIONS', titleKo: '작품 소장' },
  { id: 'otherActivities', category: 'otherActivities', number: '06', titleEn: 'OTHER ACTIVITIES', titleKo: '기타 활동 및 레지던시' },
];

/**
 * Calculates estimated row height in pixels for an artwork in the Works List table.
 * Standard A4 Portrait column width:
 * NO: 32px | Thumbnail: 56px | Code: 96px | Title: ~220px | Canvas: 128px | Material: 128px | Year: 48px
 */
export const calculateArtworkRowHeight = (art: Artwork): number => {
  const baseHeight = 58; // 40px thumbnail + 16px py-2.5 padding + 2px border

  // Title wrapping estimate in ~220px column: approx 18 Korean / 26 English chars per line
  const title = (art.title || '').trim();
  const titleLines = Math.max(1, Math.ceil(title.length / 18));

  // Material wrapping estimate in ~128px column: approx 16 chars per line
  const mat = formatMaterialOnCanvas(art.material) || '';
  const matLines = Math.max(1, Math.ceil(mat.length / 16));

  const maxLines = Math.max(titleLines, matLines);
  if (maxLines > 2) {
    return baseHeight + (maxLines - 2) * 18;
  }
  return baseHeight;
};

/**
 * Dynamically packs artworks into A4 Portrait pages based on available height.
 * In A4 portrait printable area (278mm), available tbody height is approx 740px-760px.
 * Works are added to page 1 until space runs out, then moved to page 2, and so on.
 */
export const paginateWorksList = (artworks: Artwork[], maxTbodyHeight: number = 740): Artwork[][] => {
  if (artworks.length === 0) return [[]];

  const pages: Artwork[][] = [];
  let currentPage: Artwork[] = [];
  let currentHeight = 0;

  for (const art of artworks) {
    const rowHeight = calculateArtworkRowHeight(art);
    // If adding this row exceeds available height, move to next page
    if (currentPage.length > 0 && currentHeight + rowHeight > maxTbodyHeight) {
      pages.push(currentPage);
      currentPage = [art];
      currentHeight = rowHeight;
    } else {
      currentPage.push(art);
      currentHeight += rowHeight;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

export const SubmissionPortfolioSheet: React.FC<SubmissionPortfolioSheetProps> = ({
  submission,
  selectedArtworks,
  cvSections,
  selectedCvIds,
  selectedArtistNote,
  coverArtwork,
  settings,
}) => {
  const artist = getArtistProfile(settings);

  // Group selected CV items by section
  const selectedCvIdSet = new Set(selectedCvIds);
  const cvSectionsWithSelected = CANONICAL_SECTIONS.map((sec) => {
    const foundSec = cvSections.find((s) => s.id === sec.id || s.category === sec.category);
    const allItems = foundSec?.items || [];
    const filtered = allItems
      .filter((item) => selectedCvIdSet.has(item.id))
      .sort((a, b) => {
        const yearA = parseInt(a.year?.match(/\d{4}/)?.[0] || '0', 10);
        const yearB = parseInt(b.year?.match(/\d{4}/)?.[0] || '0', 10);
        if (yearB !== yearA) return yearB - yearA;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });
    return {
      ...sec,
      items: filtered,
    };
  }).filter((sec) => sec.items.length > 0);

  // Total count of selected CV items for adaptive vertical spacing
  const totalCvItemsCount = cvSectionsWithSelected.reduce((sum, sec) => sum + sec.items.length, 0);

  // Hero Cover Artwork: explicitly specified coverArtwork -> featured artwork -> first selected artwork
  const heroArtwork =
    coverArtwork ||
    selectedArtworks.find((a) => a.isFeatured) ||
    selectedArtworks[0];

  // Resolve Artist Note: Ensure latest Korean original and complete English translation from Firestore are used in print/PDF
  const defArtistNote =
    DEFAULT_ARTIST_NOTES.find((d) => d.key === selectedArtistNote?.key) || DEFAULT_ARTIST_NOTES[0];
  const resolvedNoteKo =
    (selectedArtistNote?.contentKo || selectedArtistNote?.content || defArtistNote.content || '').trim();
  const resolvedNoteEn =
    (selectedArtistNote?.contentEn && selectedArtistNote.contentEn.trim().length > 0)
      ? selectedArtistNote.contentEn.trim()
      : (defArtistNote.contentEn || '').trim();

  const koParas = resolvedNoteKo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const enParas = resolvedNoteEn.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  // Dynamically chunk Works List based on actual available A4 Portrait height
  const worksListChunks = React.useMemo(() => paginateWorksList(selectedArtworks), [selectedArtworks]);

  // Compute cumulative start index for each chunk
  const chunkStartIndices = React.useMemo(() => {
    let running = 0;
    return worksListChunks.map((chunk) => {
      const start = running;
      running += chunk.length;
      return start;
    });
  }, [worksListChunks]);

  // Calculate starting page numbers:
  // Cover: Page 1 (No number displayed)
  // CV: Page 2 (02)
  // Artist Note: Page 3 (03)
  // Works List: Page 4 ... (04, 05 if 2 pages)
  // Artwork detail pages: Starts right after Works List
  const artworkPageStartNum = 4 + worksListChunks.length;

  return (
    <div id="submission-document-root" className="w-full text-neutral-900 bg-transparent">
      {/* ===================================================================
          PAGE 1: COVER (표지 - A4 Portrait 210 × 297 mm)
          - 작가명: PARK JIN SOO / 박진수 · 朴鎭洙
          - 대표 이미지 1장 (정적 이미지, 비율 왜곡 없음)
          - 표지에는 페이지 번호 미표시
          =================================================================== */}
      <div className="no-print w-full max-w-[210mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 01</strong> · COVER (표지)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Portrait · 210 × 297 mm</span>
      </div>
      <section
        id="submission-page-1-cover"
        className="submission-a4-page relative w-full aspect-[210/297] max-w-[210mm] mx-auto bg-[#FAF9F6] border border-neutral-200/90 shadow-sm p-6 sm:p-10 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[278mm] print:max-h-[278mm] print:bg-white"
      >
        {/* Top Header info */}
        <div className="flex items-center justify-between border-b border-neutral-300/80 pb-3">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono-code tracking-[0.2em] uppercase text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-neutral-900 inline-block" />
            <span>FINE ART PORTFOLIO & ARCHIVE</span>
          </div>
          <div className="text-[10px] sm:text-xs font-mono-code text-neutral-500">
            {submission.targetOrganization ? `SUBMISSION: ${submission.targetOrganization}` : 'OFFICIAL SUBMISSION DOSSIER'}
          </div>
        </div>

        {/* Center Content: Artist Name, Hero Image, Title Block */}
        <div className="flex-1 flex flex-col justify-between my-3 py-1">
          {/* Artist Identification */}
          <div className="text-center pt-2">
            <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block mb-1">
              CONTEMPORARY PAINTER
            </span>
            <h1 className="font-serif-title text-3xl sm:text-4xl font-normal text-neutral-950 tracking-tight leading-tight">
              {artist.englishName}
            </h1>
            <p className="text-sm sm:text-base font-light tracking-[0.25em] text-neutral-600 mt-1">
              {artist.formattedKoHanja}
            </p>
          </div>

          {/* Representative Artwork (Hero Image) */}
          <div className="w-full my-3 flex flex-col items-center">
            {heroArtwork ? (
              <div className="w-full flex flex-col items-center">
                <div className="w-full h-[105mm] sm:h-[115mm] print:h-[110mm] flex items-center justify-center p-2 bg-white/70 border border-neutral-200/80 shadow-xs print:border-none print:shadow-none">
                  <img
                    src={heroArtwork.imageUrl}
                    alt={heroArtwork.title}
                    className="max-h-full max-w-full w-auto h-auto object-contain"
                  />
                </div>
                <div className="mt-2 text-center text-xs text-neutral-600 font-serif-title">
                  <span className="font-mono-code text-[11px] font-semibold text-neutral-900 mr-2">
                    {heroArtwork.code}
                  </span>
                  <span className="font-medium text-neutral-950 mr-2">{heroArtwork.title}</span>
                  <span className="text-neutral-400 mr-2">|</span>
                  <span className="font-mono-code text-[11px] mr-2 whitespace-nowrap">
                    {heroArtwork.widthCm} × {heroArtwork.heightCm} cm
                  </span>
                  <span className="text-neutral-400 mr-2">|</span>
                  <span>{formatMaterialOnCanvas(heroArtwork.material)}</span>
                  <span className="text-neutral-400 mx-2">|</span>
                  <span className="font-mono-code">{heroArtwork.year}</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-48 border border-dashed border-neutral-300 rounded flex items-center justify-center text-neutral-400 text-xs">
                대표 작품 이미지가 등록되지 않았습니다.
              </div>
            )}
          </div>

          {/* Portfolio Title Block */}
          <div className="border-t border-neutral-300/80 pt-3 text-center">
            <span className="text-[10px] font-mono-code uppercase tracking-widest text-neutral-400 block mb-0.5">
              PORTFOLIO TITLE
            </span>
            <p className="font-serif-title text-xl sm:text-2xl font-medium text-neutral-900 leading-snug">
              {submission.title}
            </p>
            {submission.submissionDeadline && (
              <p className="text-xs font-mono-code text-neutral-500 mt-1">
                제출기한: {submission.submissionDeadline}
              </p>
            )}
          </div>

          {/* Artist Contact Info */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-mono-code text-neutral-600 pt-3 border-t border-neutral-200/80">
            {settings.contactEmail && (
              <p className="flex items-center gap-1.5">
                <span className="text-neutral-400 uppercase tracking-wider text-[10px]">Email:</span>
                <span className="text-neutral-900 font-medium">{settings.contactEmail}</span>
              </p>
            )}
            {settings.websiteUrl && (
              <p className="flex items-center gap-1.5">
                <span className="text-neutral-400 uppercase tracking-wider text-[10px]">Web:</span>
                <span>{settings.websiteUrl}</span>
              </p>
            )}
            {settings.instagramUrl && (
              <p className="flex items-center gap-1.5">
                <span className="text-neutral-400 uppercase tracking-wider text-[10px]">Insta:</span>
                <span>{settings.instagramUrl}</span>
              </p>
            )}
          </div>
        </div>

        {/* Bottom Bar (No page number on cover) */}
        <div className="border-t border-neutral-300/80 pt-3 flex items-center justify-between text-[11px] font-mono-code text-neutral-400">
          <span>PARK JIN SOO ARCHIVE</span>
          <span>A4 PORTFOLIO DOSSIER</span>
        </div>
      </section>

      {/* ===================================================================
          PAGE 2: CV (작가 이력 - A4 Portrait 210 × 297 mm)
          - 기존 CV 데이터에서 selected = true 인 항목
          - 작가 사진 포함 (비율 왜곡 없이 object-contain 유지)
          - 큰 섹션 사이에 내용 양에 맞는 적절한 세로 여백 자동 배치
          - 내용이 적으면 페이지 공간을 자연스럽게 활용하고, 많으면 다음 A4 페이지로 분할
          - 페이지 번호: 02
          =================================================================== */}
      <div className="no-print w-full max-w-[210mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 02</strong> · CURRICULUM VITAE (이력)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Portrait · 210 × 297 mm</span>
      </div>
      <section
        id="submission-page-2-cv"
        className="submission-a4-page submission-flow-page relative w-full min-h-[297mm] max-w-[210mm] mx-auto bg-white border border-neutral-200/90 shadow-sm p-6 sm:p-10 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:min-h-[278mm] print:h-auto"
      >
        {/* Page Top Header with Artist Portrait */}
        <div className="submission-page-break-avoid flex items-center justify-between border-b-2 border-neutral-900 pb-3">
          <div>
            <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block">
              CURRICULUM VITAE
            </span>
            <h2 className="font-serif-title text-2xl font-semibold text-neutral-950">
              {artist.englishName} ({artist.formattedKoHanja})
            </h2>
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono-code text-neutral-500 mt-1">
              <span>CONTEMPORARY PAINTER</span>
              {settings.contactEmail && <span>· {settings.contactEmail}</span>}
              {settings.websiteUrl && <span>· {settings.websiteUrl}</span>}
            </div>
          </div>

          {/* Artist Portrait Photo on CV Sheet (Preserves natural aspect ratio with object-contain) */}
          {settings.artistPhotoUrl ? (
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-right text-xs font-mono-code text-neutral-400 hidden sm:block">
                <span className="text-[9px] uppercase tracking-widest block text-neutral-400">ARTIST PORTRAIT</span>
                <span className="text-[11px] text-neutral-700 font-medium">{artist.koreanName} 작가</span>
              </div>
              <div className="w-[24mm] h-[32mm] bg-white border border-neutral-300 p-0.5 shadow-2xs shrink-0 flex items-center justify-center overflow-hidden rounded-xs print:border-neutral-400">
                <img
                  src={settings.artistPhotoUrl}
                  alt={`${artist.englishName} (${artist.formattedKoHanja}) 작가 사진`}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          ) : (
            <div className="text-right text-xs font-mono-code text-neutral-500">
              <span>SELECTED CV / 아카이브 이력</span>
            </div>
          )}
        </div>

        {/* CV Content Sections for A4 Portrait:
            - Dynamically adapts vertical spacing between major sections based on total items
            - Prevents clumping at top and empty dead-space at bottom
            - Keeps internal item spacing compact and clean
            - Flows cleanly if content exceeds one page without clipping */}
        <div
          className={`flex-1 flex flex-col ${
            totalCvItemsCount === 0
              ? 'justify-center'
              : totalCvItemsCount <= 6
              ? 'justify-around py-6 gap-y-10'
              : totalCvItemsCount <= 12
              ? 'justify-around py-4 gap-y-8'
              : totalCvItemsCount <= 18
              ? 'justify-between py-3 gap-y-6'
              : 'py-2 gap-y-5 my-2'
          }`}
        >
          {cvSectionsWithSelected.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 text-xs font-mono-code">
              선택된 CV 항목이 없습니다.
            </div>
          ) : (
            cvSectionsWithSelected.map((sec) => (
              <div key={sec.id} className="submission-page-break-avoid space-y-2">
                <div className="flex items-baseline gap-2 border-b border-neutral-300/80 pb-1.5">
                  <span className="font-mono-code text-[11px] font-semibold text-neutral-400">
                    {sec.number}
                  </span>
                  <h3 className="text-xs font-bold font-sans tracking-[0.15em] uppercase text-neutral-900">
                    {sec.titleEn}
                  </h3>
                  <span className="text-[11px] text-neutral-400 font-sans">
                    {sec.titleKo}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs">
                  {sec.items.map((item) => (
                    <li key={item.id} className="submission-page-break-avoid flex items-baseline gap-3 leading-relaxed">
                      <span className="font-mono-code text-neutral-500 font-medium w-14 shrink-0 text-left">
                        {item.year}
                      </span>
                      <div className="text-neutral-800 flex-1">
                        <span className="font-medium text-neutral-950 mr-1.5">{item.title}</span>
                        {item.institution && (
                          <span className="text-neutral-600 mr-1.5">, {item.institution}</span>
                        )}
                        {item.location && (
                          <span className="text-neutral-400">({item.location})</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Page Footer & Number */}
        <div className="submission-page-break-avoid border-t border-neutral-300/80 pt-3 flex items-center justify-between text-xs font-mono-code text-neutral-500">
          <span>PARK JIN SOO · CURRICULUM VITAE</span>
          <span className="font-bold text-neutral-900 tracking-widest">02</span>
        </div>
      </section>

      {/* ===================================================================
          PAGE 3: ARTIST NOTE (작가노트 - A4 Portrait 210 × 297 mm)
          - 한국어 원문 전체 + 영어 번역 전체
          - 한국어 아래 영어 표시 (별도 라벨 없음)
          - 내용이 길어질 경우 다음 페이지로 자연스럽게 분리 (submission-flow-page)
          - 페이지 번호: 03
          =================================================================== */}
      <div className="no-print w-full max-w-[210mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 03</strong> · ARTIST NOTE (작가노트)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Portrait · 210 × 297 mm</span>
      </div>
      <section
        id="submission-page-3-artist-note"
        className="submission-a4-page submission-flow-page relative w-full min-h-[297mm] max-w-[210mm] mx-auto bg-white border border-neutral-200/90 shadow-sm p-6 sm:p-10 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:min-h-[278mm] print:h-auto"
      >
        {/* Page Top Header */}
        <div className="submission-page-break-avoid flex items-center justify-between border-b-2 border-neutral-900 pb-3">
          <div>
            <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block">
              ARTIST STATEMENT
            </span>
            <h2 className="font-serif-title text-2xl font-semibold text-neutral-950">
              작가노트 (Artist Note)
            </h2>
          </div>
          <div className="text-right text-xs font-mono-code text-neutral-500">
            <span>WRITTEN YEAR: {selectedArtistNote.writtenYear}</span>
          </div>
        </div>

        {/* Note Body: Korean Original followed directly by English Translation (Strictly NO labels) */}
        <div className="my-4 flex-1 flex flex-col justify-between">
          <div className="w-full">
            <div className="submission-page-break-avoid mb-4">
              <h3 className="font-serif-title text-xl sm:text-2xl font-medium text-neutral-900 tracking-tight">
                {selectedArtistNote.title}
              </h3>
              {selectedArtistNote.critiqueAuthor && (
                <p className="text-xs text-neutral-500 mt-0.5 font-serif-title italic">
                  비평 / 평론: {selectedArtistNote.critiqueAuthor}
                </p>
              )}
            </div>

            {/* 1. Korean Original Text (All paragraphs displayed in full) */}
            <div className="space-y-3 font-serif-title text-xs sm:text-[12px] text-neutral-900 leading-[1.68] font-light">
              {koParas.map((paragraph, pIdx) => (
                <p key={`ko-p-${pIdx}`} className="submission-paragraph text-justify">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* 2. English Translation (Displayed directly below Korean, strictly NO labels) */}
            {enParas.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-neutral-300/80 space-y-2.5 font-serif-title text-[11px] sm:text-[11.5px] text-neutral-700 leading-[1.62] font-light">
                {enParas.map((paragraph, pIdx) => (
                  <p key={`en-p-${pIdx}`} className="submission-paragraph text-justify">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Artist Signature Block */}
          <div className="submission-page-break-avoid pt-4 mt-4 flex items-end justify-between border-t border-neutral-200/80 w-full">
            <div className="text-[11px] font-mono-code text-neutral-400">
              PARK JIN SOO FINE ART ARCHIVE
            </div>
            <div className="text-right">
              <p className="font-serif-title text-base text-neutral-950 font-medium">
                {artist.englishName}
              </p>
              <p className="text-[11px] text-neutral-500 font-light">
                {artist.formattedKoHanja}
              </p>
            </div>
          </div>
        </div>

        {/* Page Footer & Number */}
        <div className="border-t border-neutral-300/80 pt-3 flex items-center justify-between text-xs font-mono-code text-neutral-500">
          <span>PARK JIN SOO · ARTIST NOTE</span>
          <span className="font-bold text-neutral-900 tracking-widest">03</span>
        </div>
      </section>

      {/* ===================================================================
          PAGE 4+ : WORKS LIST (출품작 목록 - A4 Portrait 210 × 297 mm)
          - A4 세로 실제 사용 가능 높이에 맞춰 동적 자동 분할
          - 고정된 작품 수(7점, 8점 등)가 아닌 페이지 실제 공간에 맞춰 작품 배치
          - 사용 가능한 공간이 찰 때까지 작품을 채우고 초과분은 다음 페이지로 자동 이동
          - Canvas Size는 반드시 "가로 × 세로 cm" 형식으로 한 줄 표시 (줄바꿈 방지)
          =================================================================== */}
      {worksListChunks.map((chunk, pageIdx) => {
        const pageNum = String(4 + pageIdx).padStart(2, '0');
        const startItemNum = (chunkStartIndices[pageIdx] ?? 0) + 1;
        const endItemNum = (chunkStartIndices[pageIdx] ?? 0) + chunk.length;

        return (
          <React.Fragment key={`works-list-page-${pageIdx}`}>
            <div className="no-print w-full max-w-[210mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                <strong className="text-neutral-700">PAGE {pageNum}</strong> · WORKS LIST ({pageIdx + 1}/{worksListChunks.length})
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Portrait · 210 × 297 mm</span>
            </div>
            <section
              id={`submission-page-works-list-${pageIdx + 1}`}
              className="submission-a4-page relative w-full aspect-[210/297] max-w-[210mm] mx-auto bg-white border border-neutral-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[278mm] print:max-h-[278mm]"
            >
              {/* Page Top Header */}
              <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3">
                <div>
                  <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block">
                    LIST OF WORKS
                  </span>
                  <h2 className="font-serif-title text-2xl font-semibold text-neutral-950">
                    출품 작품 목록 ({selectedArtworks.length}점)
                  </h2>
                </div>
                <div className="text-right text-xs font-mono-code text-neutral-500">
                  {worksListChunks.length > 1 ? (
                    <span>PAGE {pageIdx + 1} OF {worksListChunks.length} ({startItemNum}–{endItemNum}번)</span>
                  ) : (
                    <span>TOTAL {selectedArtworks.length} WORKS SUBMITTED</span>
                  )}
                </div>
              </div>

              {/* Table of selected works (Optimized for A4 Portrait with dynamic space filling) */}
              <div className="my-3 flex-1 flex flex-col justify-start overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-300 text-[10px] sm:text-[11px] font-mono-code text-neutral-500 uppercase tracking-wider">
                      <th className="py-2.5 px-1 w-8 text-center">NO.</th>
                      <th className="py-2.5 px-2 w-14 text-center">도판</th>
                      <th className="py-2.5 px-2 w-24">작품번호</th>
                      <th className="py-2.5 px-2">작품명 (Title)</th>
                      <th className="py-2.5 px-2 w-32 whitespace-nowrap">Canvas Size</th>
                      <th className="py-2.5 px-2 w-32">Material</th>
                      <th className="py-2.5 px-1 w-12 text-center">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {chunk.map((art, itemOffset) => {
                      const overallIdx = (chunkStartIndices[pageIdx] ?? 0) + itemOffset;
                      return (
                        <tr key={art.id} className="submission-page-break-avoid hover:bg-neutral-50/50">
                          <td className="py-2.5 px-1 text-center font-mono-code text-neutral-400 font-semibold text-[11px]">
                            {String(overallIdx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <div className="w-10 h-10 mx-auto bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden rounded-xs">
                              <img
                                src={art.imageUrl}
                                alt={art.title}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono-code font-semibold text-neutral-900 text-xs">
                            {art.code}
                          </td>
                          <td className="py-2.5 px-2 font-serif-title font-medium text-xs sm:text-sm text-neutral-950">
                            {art.title}
                          </td>
                          {/* Canvas Size: 반드시 "가로 × 세로 cm" 형식으로 한 줄 표시 (whitespace-nowrap) */}
                          <td className="py-2.5 px-2 whitespace-nowrap font-mono-code text-[11px] text-neutral-800 font-medium">
                            {art.widthCm} × {art.heightCm} cm
                          </td>
                          <td className="py-2.5 px-2 text-neutral-700 text-xs">
                            {formatMaterialOnCanvas(art.material)}
                          </td>
                          <td className="py-2.5 px-1 text-center font-mono-code text-neutral-700 text-xs">
                            {art.year}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Page Footer & Number */}
              <div className="border-t border-neutral-300/80 pt-3 flex items-center justify-between text-xs font-mono-code text-neutral-500">
                <span>PARK JIN SOO · LIST OF WORKS</span>
                <span className="font-bold text-neutral-900 tracking-widest">{pageNum}</span>
              </div>
            </section>
          </React.Fragment>
        );
      })}

      {/* ===================================================================
          PAGE 5+ : ARTWORK DETAIL PAGES (선택 작품별 A4 Portrait 상세 페이지)
          - 각 작품당 반드시 독립적인 한 페이지 (page-break)
          - 작품 이미지 원본 비율(contain)로 최대한 크게 배치 (세로형/가로형/정방형 최적화)
          - 작품 설명의 유무와 관계없이 작품 이미지 영역의 크기와 기준을 동일하게 유지
          - 작품 설명은 이미지 아래쪽에 배치
          - 캡션:
            줄 1: 작품번호 | 작품명 | widthCm × heightCm cm
            줄 2: Material on Canvas | Year
          =================================================================== */}
      {selectedArtworks.map((art, idx) => {
        const pageNum = String(artworkPageStartNum + idx).padStart(2, '0');
        const hasDescription = Boolean(art.description && art.description.trim().length > 0);

        return (
          <React.Fragment key={art.id}>
            <div className="no-print w-full max-w-[210mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                <strong className="text-neutral-700">PAGE {pageNum}</strong> · ARTWORK {String(idx + 1).padStart(2, '0')} ({art.code})
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Portrait · 210 × 297 mm</span>
            </div>
            <section
              id={`submission-page-artwork-${art.id}`}
              className="submission-a4-page submission-artwork-page relative w-full aspect-[210/297] max-w-[210mm] mx-auto bg-white border border-neutral-200/90 shadow-sm px-6 pt-3.5 pb-4 sm:px-8 sm:pt-4 sm:pb-5 flex flex-col mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[278mm] print:max-h-[278mm] print:bg-white"
            >
              {/* Top Minimal Archive Bar */}
              <div className="flex items-center justify-between border-b border-neutral-300/80 pb-1.5 text-[10.5px] font-mono-code text-neutral-400 shrink-0">
                <span>
                  ARTWORK {String(idx + 1).padStart(2, '0')} / {String(selectedArtworks.length).padStart(2, '0')}
                </span>
                <span>{artist.englishName} ({artist.formattedKoHanja})</span>
              </div>

              {/* Main Stage: Large Contain Artwork Image
                  - Maximized vertical and horizontal available space
                  - Minimized top and bottom gaps
                  - Standardized height of 180mm-188mm in A4 portrait
                  - Does NOT shrink when description is present
                  - Vertical works: maximize vertical space within height
                  - Horizontal works: maximize horizontal space within width
                  - Square works: balanced and centered
                  - object-contain: no distortion, no cropping */}
              <div className="w-full h-[180mm] sm:h-[188mm] print:h-[184mm] shrink-0 flex items-center justify-center mt-2 p-0 bg-transparent select-none">
                <img
                  src={art.imageUrl}
                  alt={art.title}
                  className="max-w-full max-h-full w-auto h-auto object-contain drop-shadow-xs print:drop-shadow-none"
                />
              </div>

              {/* Bottom Details: Museum Monograph Caption & Description (Directly below image with minimal gap) */}
              <div className="w-full mt-2 pt-2 border-t border-neutral-900/80 text-left print:border-neutral-900 shrink-0">
                {/* Line 1: 작품번호 | 작품명 | Canvas Size (한 줄 표시) */}
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-neutral-900 leading-tight">
                  <span className="font-mono-code font-bold text-sm sm:text-base text-neutral-950 tracking-wide">
                    {art.code}
                  </span>
                  <span className="text-neutral-300 select-none print:text-neutral-400">|</span>
                  <h2 className="font-serif-title font-medium text-base sm:text-lg text-neutral-950">
                    {art.title}
                  </h2>
                  <span className="text-neutral-300 select-none print:text-neutral-400">|</span>
                  <span className="font-mono-code font-semibold text-xs sm:text-sm text-neutral-800 whitespace-nowrap">
                    {art.widthCm} × {art.heightCm} cm
                  </span>
                </div>

                {/* Line 2: Material | Year */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-neutral-600 mt-1 font-sans">
                  <span className="text-neutral-800 font-medium">
                    {formatMaterialOnCanvas(art.material)}
                  </span>
                  <span className="text-neutral-300 select-none print:text-neutral-400">|</span>
                  <span className="font-mono-code text-neutral-700 font-medium">
                    {art.year}
                  </span>
                </div>

                {/* Description (Strictly rendered below image and caption lines without reducing image size) */}
                {hasDescription && (
                  <div className="mt-1.5 pt-1 border-t border-neutral-200/80 text-left max-h-[30mm] overflow-hidden">
                    <span className="text-[9px] font-mono-code tracking-[0.2em] text-neutral-400 uppercase block mb-0.5 font-medium">
                      [작품 설명]
                    </span>
                    <p className="text-[11px] sm:text-xs text-neutral-700 font-light leading-relaxed whitespace-pre-line text-justify">
                      {art.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Page Footer & Number */}
              <div className="submission-artwork-footer mt-auto pt-2 border-t border-neutral-300/80 flex items-center justify-between text-xs font-mono-code text-neutral-500 shrink-0">
                <span>
                  {art.code} · {art.title}
                </span>
                <span className="font-bold text-neutral-900 tracking-widest">{pageNum}</span>
              </div>
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
};
