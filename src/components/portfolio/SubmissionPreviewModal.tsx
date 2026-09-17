import React, { useEffect } from 'react';
import { Artwork, CVSection, ArtistNoteItem, SiteSettings, Submission } from '../../types';
import { SubmissionPortfolioSheet } from './SubmissionPortfolioSheet';
import { Printer, X, ArrowLeft, Eye, FileText, Info } from 'lucide-react';

interface SubmissionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: Submission;
  selectedArtworks: Artwork[];
  cvSections: CVSection[];
  selectedCvIds: string[];
  selectedArtistNote: ArtistNoteItem;
  coverArtwork?: Artwork;
  settings: SiteSettings;
}

export const SubmissionPreviewModal: React.FC<SubmissionPreviewModalProps> = ({
  isOpen,
  onClose,
  submission,
  selectedArtworks,
  cvSections,
  selectedCvIds,
  selectedArtistNote,
  coverArtwork,
  settings,
}) => {
  // ESC key handler to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalPages = 4 + selectedArtworks.length;

  const handlePrint = () => {
    const originalTitle = document.title;
    // Format sanitized PDF filename: PARK_JIN_SOO_[Submission_Title].pdf
    let safeTitle = 'Portfolio';
    if (submission?.title && submission.title.trim().length > 0) {
      safeTitle = submission.title
        .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      if (!safeTitle) safeTitle = 'Portfolio';
    }
    const pdfFilename = `PARK_JIN_SOO_${safeTitle}`;
    document.title = pdfFilename;

    window.print();

    // Restore original document title after print dialog closes
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <div
      id="submission-preview-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-0 sm:p-4 md:p-6 print:p-0 print:bg-white print:static print:overflow-visible"
    >
      {/* Top Floating Action Bar (Hidden during print) */}
      <div className="no-print sticky top-2 sm:top-4 z-50 w-full max-w-5xl mx-auto px-4 mb-4">
        <div className="bg-neutral-950/95 text-white border border-neutral-800 rounded-lg shadow-2xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="close-submission-preview-btn"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>관리 화면 복귀</span>
            </button>
            <div className="border-l border-neutral-800 pl-3">
              <h2 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {submission.title}
              </h2>
              <p className="text-[11px] font-mono-code text-neutral-400">
                A4 Landscape Dossier · 총 {totalPages}페이지 (COVER, CV, NOTE, LIST, WORKS {selectedArtworks.length}점)
              </p>
            </div>
          </div>

          {/* Right: Print/PDF & Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="print-submission-btn"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold bg-white text-neutral-950 hover:bg-neutral-100 shadow-md transition-all active:scale-[0.98]"
              title="A4 가로 방향으로 인쇄하거나 PDF 파일로 저장합니다."
            >
              <Printer className="w-3.5 h-3.5" />
              <span>[PRINT / PDF]</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="미리보기 닫기 (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print Guideline Banner */}
        <div className="mt-2 bg-neutral-900/90 text-neutral-300 text-[11px] px-4 py-1.5 rounded border border-neutral-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-neutral-300">
            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              [PRINT / PDF]를 누른 뒤 인쇄 대상에서 <strong>PDF로 저장(Save as PDF)</strong>을 선택하고, 가로(Landscape) 규격으로 저장하세요.
            </span>
          </span>
          <span className="font-mono-code text-neutral-500 hidden md:inline">ESC 키로 닫기</span>
        </div>
      </div>

      {/* Main A4 Sheets Container */}
      <div className="w-full max-w-5xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-full">
        <SubmissionPortfolioSheet
          submission={submission}
          selectedArtworks={selectedArtworks}
          cvSections={cvSections}
          selectedCvIds={selectedCvIds}
          selectedArtistNote={selectedArtistNote}
          coverArtwork={coverArtwork}
          settings={settings}
        />
      </div>
    </div>
  );
};
