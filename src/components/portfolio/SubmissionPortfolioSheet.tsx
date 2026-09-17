import React from 'react';
import { Artwork, CVSection, CVItem, ArtistNoteItem, SiteSettings, Submission } from '../../types';
import { formatMaterialOnCanvas } from '../../utils/formatters';
import { getArtistProfile } from '../../utils/artistProfile';

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

  // Hero Cover Artwork: explicitly specified coverArtwork -> featured artwork -> first selected artwork
  const heroArtwork =
    coverArtwork ||
    selectedArtworks.find((a) => a.isFeatured) ||
    selectedArtworks[0];

  return (
    <div id="submission-document-root" className="w-full text-neutral-900 bg-transparent">
      {/* ===================================================================
          PAGE 1: COVER (표지 - A4 Landscape)
          - 작가명: PARK JIN SOO / 박진수 · 朴鎭洙
          - 대표 이미지 1장 (정적 이미지)
          - 표지에는 페이지 번호 미표시
          =================================================================== */}
      <div className="no-print w-full max-w-[297mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 01</strong> · COVER (표지)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Landscape · 297 × 210 mm</span>
      </div>
      <section
        id="submission-page-1-cover"
        className="submission-a4-page relative w-full aspect-[297/210] max-w-[297mm] mx-auto bg-[#FAF9F6] border border-neutral-200/90 shadow-sm p-8 sm:p-12 md:p-14 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[194mm] print:max-h-[194mm] print:bg-white"
      >
        {/* Top Header info */}
        <div className="flex items-center justify-between border-b border-neutral-300/80 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono-code tracking-[0.25em] uppercase text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-neutral-900 inline-block" />
            <span>FINE ART PORTFOLIO & ARCHIVE</span>
          </div>
          <div className="text-xs font-mono-code text-neutral-500">
            {submission.targetOrganization ? `SUBMISSION TO: ${submission.targetOrganization}` : 'OFFICIAL SUBMISSION DOSSIER'}
          </div>
        </div>

        {/* Center Grid: Left Title & Info, Right Static Hero Artwork */}
        <div className="grid grid-cols-12 gap-8 items-center flex-1 my-4">
          {/* Left Column: Title & Artist Identification */}
          <div className="col-span-5 flex flex-col justify-center space-y-6">
            <div>
              <span className="text-[11px] font-mono-code uppercase tracking-[0.2em] text-neutral-400 block mb-1">
                CONTEMPORARY PAINTER
              </span>
              <h1 className="font-serif-title text-4xl sm:text-5xl font-normal text-neutral-950 tracking-tight leading-[1.08]">
                {artist.englishName}
              </h1>
              <p className="text-base sm:text-lg font-light tracking-[0.25em] text-neutral-600 mt-2">
                {artist.formattedKoHanja}
              </p>
            </div>

            {/* Submission Title Block */}
            <div className="pt-4 border-t border-neutral-200/80">
              <span className="text-[10px] font-mono-code uppercase tracking-widest text-neutral-400 block mb-1">
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
            <div className="pt-4 border-t border-neutral-200/80 space-y-1 text-xs font-mono-code text-neutral-600">
              {settings.contactEmail && (
                <p className="flex items-center gap-2">
                  <span className="text-neutral-400 uppercase tracking-wider text-[10px]">Email:</span>
                  <span className="text-neutral-900">{settings.contactEmail}</span>
                </p>
              )}
              {settings.websiteUrl && (
                <p className="flex items-center gap-2">
                  <span className="text-neutral-400 uppercase tracking-wider text-[10px]">Web:</span>
                  <span>{settings.websiteUrl}</span>
                </p>
              )}
              {settings.instagramUrl && (
                <p className="flex items-center gap-2">
                  <span className="text-neutral-400 uppercase tracking-wider text-[10px]">Insta:</span>
                  <span>{settings.instagramUrl}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Single Static Representative Artwork Image */}
          <div className="col-span-7 flex flex-col items-center justify-center h-full">
            {heroArtwork ? (
              <div className="w-full flex flex-col items-center">
                <div className="max-h-[115mm] sm:max-h-[125mm] w-full flex items-center justify-center p-2 bg-white/60 border border-neutral-200/80 shadow-xs print:border-none print:shadow-none">
                  <img
                    src={heroArtwork.imageUrl}
                    alt={heroArtwork.title}
                    className="max-h-[105mm] sm:max-h-[115mm] max-w-full w-auto h-auto object-contain"
                  />
                </div>
                <div className="mt-3 text-center text-xs text-neutral-600 font-serif-title">
                  <span className="font-mono-code text-[11px] font-semibold text-neutral-900 mr-2">
                    {heroArtwork.code}
                  </span>
                  <span className="font-medium text-neutral-950 mr-2">{heroArtwork.title}</span>
                  <span className="text-neutral-400 mr-2">|</span>
                  <span className="font-mono-code text-[11px] mr-2">
                    {heroArtwork.widthCm} × {heroArtwork.heightCm} cm
                  </span>
                  <span className="text-neutral-400 mr-2">|</span>
                  <span>{formatMaterialOnCanvas(heroArtwork.material)}</span>
                  <span className="text-neutral-400 mx-2">|</span>
                  <span className="font-mono-code">{heroArtwork.year}</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-64 border border-dashed border-neutral-300 rounded flex items-center justify-center text-neutral-400 text-xs">
                대표 작품 이미지가 등록되지 않았습니다.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-neutral-300/80 pt-3 flex items-center justify-between text-[11px] font-mono-code text-neutral-400">
          <span>PARK JIN SOO ARCHIVE</span>
          <span>A4 LANDSCAPE PORTFOLIO</span>
        </div>
      </section>

      {/* ===================================================================
          PAGE 2: CV (작가 이력 - A4 Landscape)
          - 기존 CV 데이터에서 selected = true 인 항목 (또는 제출용 선택 항목)
          - 6개 섹션 연도순 정렬
          - 페이지 번호: 02
          =================================================================== */}
      <div className="no-print w-full max-w-[297mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 02</strong> · CURRICULUM VITAE (이력)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Landscape · 297 × 210 mm</span>
      </div>
      <section
        id="submission-page-2-cv"
        className="submission-a4-page relative w-full aspect-[297/210] max-w-[297mm] mx-auto bg-white border border-neutral-200/90 shadow-sm p-8 sm:p-12 md:p-14 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[194mm] print:max-h-[194mm]"
      >
        {/* Page Top Header */}
        <div className="flex items-center justify-between border-b-2 border-neutral-900 pb-3">
          <div>
            <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block">
              CURRICULUM VITAE
            </span>
            <h2 className="font-serif-title text-2xl font-semibold text-neutral-950">
              {artist.englishName} ({artist.formattedKoHanja})
            </h2>
          </div>
          <div className="text-right text-xs font-mono-code text-neutral-500">
            <span>SELECTED CV / 아카이브 이력</span>
          </div>
        </div>

        {/* CV Content Grid: 2 Columns for A4 Landscape */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-6 my-4 flex-1 overflow-hidden">
          {cvSectionsWithSelected.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-neutral-400 text-xs font-mono-code">
              선택된 CV 항목이 없습니다.
            </div>
          ) : (
            cvSectionsWithSelected.map((sec) => (
              <div key={sec.id} className="submission-page-break-avoid space-y-2">
                <div className="flex items-baseline gap-2 border-b border-neutral-300 pb-1">
                  <span className="font-mono-code text-xs font-semibold text-neutral-400">
                    {sec.number}
                  </span>
                  <h3 className="text-xs font-bold font-sans tracking-[0.15em] uppercase text-neutral-900">
                    {sec.titleEn}
                  </h3>
                  <span className="text-[11px] text-neutral-400 font-sans">
                    {sec.titleKo}
                  </span>
                </div>
                <ul className="space-y-1 text-xs">
                  {sec.items.map((item) => (
                    <li key={item.id} className="submission-page-break-avoid grid grid-cols-12 gap-2 leading-relaxed">
                      <span className="col-span-2 font-mono-code text-neutral-500 font-medium">
                        {item.year}
                      </span>
                      <div className="col-span-10 text-neutral-800">
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
        <div className="border-t border-neutral-300/80 pt-3 flex items-center justify-between text-xs font-mono-code text-neutral-500">
          <span>PARK JIN SOO · CURRICULUM VITAE</span>
          <span className="font-bold text-neutral-900 tracking-widest">02</span>
        </div>
      </section>

      {/* ===================================================================
          PAGE 3: ARTIST NOTE (작가노트 - A4 Landscape)
          - 선택된 1개의 작가노트 (Note A or Note B)
          - 페이지 번호: 03
          =================================================================== */}
      <div className="no-print w-full max-w-[297mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 03</strong> · ARTIST NOTE (작가노트)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Landscape · 297 × 210 mm</span>
      </div>
      <section
        id="submission-page-3-artist-note"
        className="submission-a4-page relative w-full aspect-[297/210] max-w-[297mm] mx-auto bg-white border border-neutral-200/90 shadow-sm p-8 sm:p-12 md:p-14 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[194mm] print:max-h-[194mm]"
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

        {/* Note Body */}
        <div className="my-6 flex-1 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="submission-page-break-avoid mb-4">
              <h3 className="font-serif-title text-xl font-medium text-neutral-900 tracking-tight">
                {selectedArtistNote.title}
              </h3>
              {selectedArtistNote.critiqueAuthor && (
                <p className="text-xs text-neutral-500 mt-0.5 font-serif-title italic">
                  비평 / 평론: {selectedArtistNote.critiqueAuthor}
                </p>
              )}
            </div>

            <div className="font-serif-title text-sm sm:text-base text-neutral-800 leading-[1.8] whitespace-pre-line text-justify columns-2 gap-10">
              {selectedArtistNote.content}
            </div>
          </div>

          {/* Artist Signature Block */}
          <div className="submission-page-break-avoid pt-4 flex items-end justify-between border-t border-neutral-200/60">
            <div className="text-xs font-mono-code text-neutral-400">
              PARK JIN SOO FINE ART ARCHIVE
            </div>
            <div className="text-right">
              <p className="font-serif-title text-lg text-neutral-950 font-medium">
                {artist.englishName}
              </p>
              <p className="text-xs text-neutral-500 font-light">
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
          PAGE 4: WORKS LIST (출품작 목록 - A4 Landscape)
          - 선택된 작품들만의 목록
          - 번호, 도판, 작품번호, 작품명, Canvas Size(실제 cm), Material, Year
          - 페이지 번호: 04
          =================================================================== */}
      <div className="no-print w-full max-w-[297mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          <strong className="text-neutral-700">PAGE 04</strong> · WORKS LIST (출품작 목록)
        </span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Landscape · 297 × 210 mm</span>
      </div>
      <section
        id="submission-page-4-works-list"
        className="submission-a4-page relative w-full aspect-[297/210] max-w-[297mm] mx-auto bg-white border border-neutral-200/90 shadow-sm p-8 sm:p-12 md:p-14 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[194mm] print:max-h-[194mm]"
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
            <span>TOTAL {selectedArtworks.length} WORKS SUBMITTED</span>
          </div>
        </div>

        {/* Table of selected works */}
        <div className="my-4 flex-1 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-300 text-[11px] font-mono-code text-neutral-500 uppercase tracking-wider">
                <th className="py-2 px-2 w-10 text-center">NO.</th>
                <th className="py-2 px-2 w-14 text-center">도판</th>
                <th className="py-2 px-2 w-28">작품번호</th>
                <th className="py-2 px-3">작품명 (Title)</th>
                <th className="py-2 px-3 w-32">Canvas Size (cm)</th>
                <th className="py-2 px-3 w-40">Material</th>
                <th className="py-2 px-2 w-16 text-center">Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {selectedArtworks.map((art, idx) => (
                <tr key={art.id} className="submission-page-break-avoid hover:bg-neutral-50/50">
                  <td className="py-2 px-2 text-center font-mono-code text-neutral-400 font-semibold">
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="w-10 h-10 mx-auto bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                      <img
                        src={art.imageUrl}
                        alt={art.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono-code font-semibold text-neutral-900">
                    {art.code}
                  </td>
                  <td className="py-2 px-3 font-serif-title font-medium text-sm text-neutral-950">
                    {art.title}
                  </td>
                  <td className="py-2 px-3 font-mono-code text-neutral-700">
                    {art.widthCm} × {art.heightCm} cm
                  </td>
                  <td className="py-2 px-3 text-neutral-700">
                    {formatMaterialOnCanvas(art.material)}
                  </td>
                  <td className="py-2 px-2 text-center font-mono-code text-neutral-700">
                    {art.year}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Page Footer & Number */}
        <div className="border-t border-neutral-300/80 pt-3 flex items-center justify-between text-xs font-mono-code text-neutral-500">
          <span>PARK JIN SOO · LIST OF WORKS</span>
          <span className="font-bold text-neutral-900 tracking-widest">04</span>
        </div>
      </section>

      {/* ===================================================================
          PAGE 5+ : ARTWORK DETAIL PAGES (선택 작품별 A4 Landscape 상세 페이지)
          - 각 작품당 반드시 독립적인 한 페이지 (page-break)
          - 작품 이미지 원본 비율(contain)로 최대한 크게 배치
          - 캡션 2줄:
            줄 1: 작품번호 | 작품명 | widthCm × heightCm cm
            줄 2: Material on Canvas | Year
          - description: 있는 경우에만 표시 (없으면 완전 생략)
          - 페이지 번호: 05, 06, 07...
          =================================================================== */}
      {selectedArtworks.map((art, idx) => {
        const pageNum = String(idx + 5).padStart(2, '0');
        const hasDescription = Boolean(art.description && art.description.trim().length > 0);

        return (
          <React.Fragment key={art.id}>
            <div className="no-print w-full max-w-[297mm] mx-auto mb-2 flex items-center justify-between text-[11px] font-mono-code text-neutral-400 px-2 select-none">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                <strong className="text-neutral-700">PAGE {pageNum}</strong> · ARTWORK {String(idx + 1).padStart(2, '0')} ({art.code})
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">A4 Landscape · 297 × 210 mm</span>
            </div>
            <section
              id={`submission-page-artwork-${art.id}`}
              className="submission-a4-page relative w-full aspect-[297/210] max-w-[297mm] mx-auto bg-[#FAF9F6] border border-neutral-200/90 shadow-sm p-6 sm:p-10 md:p-12 flex flex-col justify-between mb-10 print:mb-0 print:border-none print:shadow-none print:p-0 print:w-full print:h-[194mm] print:max-h-[194mm] print:bg-white"
            >
              {/* Top Minimal Archive Bar */}
              <div className="flex items-center justify-between border-b border-neutral-200/80 pb-2 text-[11px] font-mono-code text-neutral-400">
                <span>
                  ARTWORK {String(idx + 1).padStart(2, '0')} / {String(selectedArtworks.length).padStart(2, '0')}
                </span>
                <span>{artist.englishName} ({artist.formattedKoHanja})</span>
              </div>

              {/* Main Stage: Large Contain Artwork Image (Original Aspect Ratio Preserved) */}
              <div className="w-full flex-1 flex items-center justify-center p-2 min-h-0 select-none">
                <div
                  className={`relative max-w-full h-full flex items-center justify-center ${
                    hasDescription
                      ? 'max-h-[96mm] sm:max-h-[102mm] print:max-h-[94mm]'
                      : 'max-h-[116mm] sm:max-h-[122mm] print:max-h-[114mm]'
                  }`}
                >
                  <img
                    src={art.imageUrl}
                    alt={art.title}
                    className={`max-w-full w-auto h-auto object-contain shadow-sm border border-neutral-200/80 bg-white print:shadow-none print:border print:border-neutral-300 ${
                      hasDescription
                        ? 'max-h-[96mm] sm:max-h-[102mm] print:max-h-[94mm]'
                        : 'max-h-[116mm] sm:max-h-[122mm] print:max-h-[114mm]'
                    }`}
                  />
                </div>
              </div>

              {/* Bottom Details: Museum Monograph Caption & Description (Aligned in width with Artwork) */}
              <div className="w-full max-w-2xl mx-auto pt-3 border-t border-neutral-300/80 text-left print:pt-2.5 print:border-neutral-800">
                {/* Line 1: 작품번호 | 작품명 | Canvas Size */}
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-neutral-900 leading-tight">
                  <span className="font-mono-code font-bold text-sm sm:text-base text-neutral-950 tracking-wide">
                    {art.code}
                  </span>
                  <span className="text-neutral-300 select-none print:text-neutral-400">|</span>
                  <h2 className="font-serif-title font-medium text-lg sm:text-xl text-neutral-950">
                    {art.title}
                  </h2>
                  <span className="text-neutral-300 select-none print:text-neutral-400">|</span>
                  <span className="font-mono-code font-semibold text-xs sm:text-sm text-neutral-800">
                    {art.widthCm} × {art.heightCm} cm
                  </span>
                </div>

                {/* Line 2: Material | Year */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-neutral-600 mt-1 font-sans">
                  <span className="text-neutral-800 font-medium">
                    {formatMaterialOnCanvas(art.material)}
                  </span>
                  <span className="text-neutral-300 select-none print:text-neutral-400">|</span>
                  <span className="font-mono-code text-neutral-700 font-medium">
                    {art.year}
                  </span>
                </div>

                {/* Description (Strictly only rendered if non-empty) */}
                {hasDescription && (
                  <div className="mt-2.5 pt-2 border-t border-neutral-200/80 text-left">
                    <span className="text-[10px] font-mono-code tracking-[0.2em] text-neutral-400 uppercase block mb-1 font-medium">
                      [작품 설명]
                    </span>
                    <p className="text-xs text-neutral-700 font-light leading-relaxed whitespace-pre-line text-justify">
                      {art.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Page Footer & Number */}
              <div className="border-t border-neutral-300/80 pt-2.5 mt-2 flex items-center justify-between text-xs font-mono-code text-neutral-500">
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
