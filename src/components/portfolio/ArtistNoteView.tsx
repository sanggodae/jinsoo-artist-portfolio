import React, { useState } from 'react';
import { ArtistNoteItem, SiteSettings } from '../../types';
import { Edit3, Check, CheckCircle2, ShieldCheck, Sparkles, X, RefreshCw, Globe } from 'lucide-react';
import { saveArtistNoteToFirestore, saveSiteSettingsToFirestore } from '../../services/firestoreService';
import { translateArtistNote } from '../../services/translationService';
import { getArtistProfile } from '../../utils/artistProfile';
import { DEFAULT_ARTIST_NOTES } from '../../data/defaultPortfolioData';

interface ArtistNoteViewProps {
  notes: ArtistNoteItem[];
  settings: SiteSettings;
  isAdmin: boolean;
  onUpdateNotes: (newNotes: ArtistNoteItem[]) => void;
  onUpdateSettings: (newSettings: SiteSettings) => void;
  onOpenAuthModal?: () => void;
}

export const ArtistNoteView: React.FC<ArtistNoteViewProps> = ({
  notes,
  settings,
  isAdmin,
  onUpdateNotes,
  onUpdateSettings,
  onOpenAuthModal,
}) => {
  const artist = getArtistProfile(settings);

  // Current view tab: Note A or Note B
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');

  // Edit Modals: 'ko' (Korean edit) | 'en' (English direct edit) | null
  const [editModalType, setEditModalType] = useState<'ko' | 'en' | null>(null);

  // State for Korean editing
  const [editingNoteKo, setEditingNoteKo] = useState<ArtistNoteItem | null>(null);
  const [forceRegenerateEn, setForceRegenerateEn] = useState(false);

  // State for English editing
  const [editingEnglishText, setEditingEnglishText] = useState('');
  const [showKoreanReference, setShowKoreanReference] = useState(true);

  // Status indicators
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const rawCurrentNote =
    notes.find((n) => n.key === activeTab) ||
    notes[0] || {
      id: `note-${activeTab.toLowerCase()}`,
      key: activeTab,
      title: `Artist Note ${activeTab}`,
      writtenYear: 2026,
      content: '작가노트 내용이 준비 중입니다.',
      contentKo: '작가노트 내용이 준비 중입니다.',
    };

  // Fallback to default English translation if contentEn is empty
  const defaultEnglishForNote =
    DEFAULT_ARTIST_NOTES.find((d) => d.key === rawCurrentNote.key)?.contentEn || '';

  const currentNote: ArtistNoteItem = {
    ...rawCurrentNote,
    content: rawCurrentNote.contentKo || rawCurrentNote.content,
    contentKo: rawCurrentNote.contentKo || rawCurrentNote.content,
    contentEn: rawCurrentNote.contentEn || defaultEnglishForNote,
  };

  const selectedForPortfolio = settings.selectedArtistNoteKey || 'A';

  // Admin selects active note for submission portfolio
  const handleSelectForPortfolio = async (key: 'A' | 'B') => {
    if (!isAdmin) return;
    const updated = {
      ...settings,
      selectedArtistNoteKey: key,
      updatedAt: new Date().toISOString(),
    };
    onUpdateSettings(updated);

    try {
      await saveSiteSettingsToFirestore(updated);
      setSaveSuccessMsg(`Artist Note ${key}가 포트폴리오 대표 작가노트로 설정되었습니다.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('[ArtistNote] Failed to save selected note setting:', err);
    }
  };

  // Open Korean Edit Modal
  const handleOpenKoreanEdit = () => {
    if (!isAdmin) return;
    setEditingNoteKo({ ...currentNote });
    setForceRegenerateEn(false);
    setEditModalType('ko');
  };

  // Open English Edit Modal
  const handleOpenEnglishEdit = () => {
    if (!isAdmin) return;
    setEditingEnglishText(currentNote.contentEn || defaultEnglishForNote);
    setShowKoreanReference(true);
    setEditModalType('en');
  };

  // Close modals
  const handleCloseModal = () => {
    setEditModalType(null);
    setEditingNoteKo(null);
    setForceRegenerateEn(false);
    setIsTranslating(false);
  };

  // Save Korean edit (auto-generates full English translation via translateArtistNote, unless English was directly custom-edited)
  const handleSaveKoreanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteKo || !isAdmin) return;

    setIsSaving(true);
    let targetEnglish = editingNoteKo.contentEn || '';
    const shouldTranslate = !editingNoteKo.isCustomEnglish || forceRegenerateEn;

    if (shouldTranslate) {
      setIsTranslating(true);
      try {
        // Submits Korean content to translateArtistNote to process entire block
        const autoTranslatedEn = await translateArtistNote(editingNoteKo.content);
        if (autoTranslatedEn && autoTranslatedEn.trim().length > 0) {
          targetEnglish = autoTranslatedEn.trim();
        }
      } catch (transErr) {
        console.warn('[ArtistNote] Translation failed, preserving existing English:', transErr);
        // Requirement: 번역 실패 시 기존 영어를 삭제하지 말고, 기존 영어 내용을 그대로 유지하세요.
      } finally {
        setIsTranslating(false);
      }
    }

    try {
      // Store both contentKo and contentEn (and content for backwards compatibility)
      const updatedNote: ArtistNoteItem = {
        ...editingNoteKo,
        content: editingNoteKo.content,
        contentKo: editingNoteKo.content,
        contentEn: targetEnglish,
        isCustomEnglish: forceRegenerateEn ? false : Boolean(editingNoteKo.isCustomEnglish),
        updatedAt: new Date().toISOString(),
      };

      const updatedList = notes.some((n) => n.key === updatedNote.key)
        ? notes.map((n) => (n.key === updatedNote.key ? updatedNote : n))
        : [...notes, updatedNote];

      onUpdateNotes(updatedList);
      await saveArtistNoteToFirestore(updatedNote);

      setSaveSuccessMsg(
        editingNoteKo.isCustomEnglish && !forceRegenerateEn
          ? `Artist Note ${updatedNote.key} 한글 수정이 저장되었습니다. (기존 직접 수정한 영문이 안전하게 유지되었습니다.)`
          : `Artist Note ${updatedNote.key} 한글 수정 및 전체 영문 작가노트 생성이 완료되었습니다.`
      );
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      handleCloseModal();
    } catch (err) {
      console.error('[ArtistNote] Failed to save note in Firestore:', err);
    } finally {
      setIsSaving(false);
      setIsTranslating(false);
    }
  };

  // Save English direct edit (Single-direction translation flow: Korean update triggers English refresh, but English direct edits remain protected)
  const handleSaveEnglishEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    const trimmedEn = editingEnglishText.trim();

    try {
      // Korean content (content, contentKo), title, year are NEVER modified when editing English. Zero reverse translation!
      const updatedNote: ArtistNoteItem = {
        ...currentNote,
        content: currentNote.content,
        contentKo: currentNote.contentKo || currentNote.content,
        contentEn: trimmedEn,
        isCustomEnglish: true, // Marked as custom edited by admin
        updatedAt: new Date().toISOString(),
      };

      const updatedList = notes.some((n) => n.key === updatedNote.key)
        ? notes.map((n) => (n.key === updatedNote.key ? updatedNote : n))
        : [...notes, updatedNote];

      onUpdateNotes(updatedList);
      await saveArtistNoteToFirestore(updatedNote);

      setSaveSuccessMsg(
        `Artist Note ${updatedNote.key} 영문 내용이 저장되었습니다. (한글 원문은 전혀 변경되지 않았습니다.)`
      );
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      handleCloseModal();
    } catch (err) {
      console.error('[ArtistNote] Failed to save English note in Firestore:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper inside English modal to run translation on demand
  const handleRunEnglishTranslationInModal = async () => {
    setIsTranslating(true);
    try {
      const autoTranslated = await translateArtistNote(currentNote.contentKo || currentNote.content);
      if (autoTranslated) {
        setEditingEnglishText(autoTranslated);
      }
    } catch (err) {
      console.error('[ArtistNote] Manual translation trigger error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div id="portfolio-artist-note-view" className="w-full py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="border-b border-neutral-300 pb-8 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono-code tracking-[0.25em] uppercase text-neutral-400 block mb-1.5">
              ARTIST STATEMENT · 작가노트
            </span>
            <h1 className="font-serif-title text-3xl sm:text-4xl text-neutral-950 font-normal">
              {artist.englishName}
            </h1>
            <p className="text-xs text-neutral-500 font-light tracking-widest uppercase mt-1">
              {artist.formattedKoHanja} · Contemporary Painting
            </p>
          </div>

          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-medium self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>관리자 모드: 내용 수정 및 포트폴리오 선택 가능</span>
            </span>
          ) : (
            onOpenAuthModal && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="text-xs text-neutral-400 hover:text-neutral-700 underline font-light self-start sm:self-auto cursor-pointer"
              >
                관리자 로그인
              </button>
            )
          )}
        </div>

        {saveSuccessMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Note A / Note B Switcher Tabs & Admin Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4 mb-8">
          <div className="flex items-center gap-3 bg-neutral-100 p-1 rounded-sm w-fit border border-neutral-200">
            <button
              type="button"
              id="artist-note-tab-a"
              onClick={() => setActiveTab('A')}
              className={`px-4 py-2 text-xs sm:text-sm font-medium tracking-wider uppercase rounded-xs transition-all cursor-pointer ${
                activeTab === 'A'
                  ? 'bg-white text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Artist Note A
              {selectedForPortfolio === 'A' && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  선택됨
                </span>
              )}
            </button>

            <button
              type="button"
              id="artist-note-tab-b"
              onClick={() => setActiveTab('B')}
              className={`px-4 py-2 text-xs sm:text-sm font-medium tracking-wider uppercase rounded-xs transition-all cursor-pointer ${
                activeTab === 'B'
                  ? 'bg-white text-neutral-950 font-semibold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Artist Note B
              {selectedForPortfolio === 'B' && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                  선택됨
                </span>
              )}
            </button>
          </div>

          {/* Admin-only Action Toolbar (Requirement 5, 9, 10)
              - Invisible to normal visitors
              - Allows selecting representative note and editing Korean / English separately
          */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="select-portfolio-note-btn"
                onClick={() => handleSelectForPortfolio(activeTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  selectedForPortfolio === activeTab
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                }`}
                title="공모전/포트폴리오 제출 시 기본 작가노트로 지정"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {selectedForPortfolio === activeTab
                    ? '대표 작가노트'
                    : '대표로 선택'}
                </span>
              </button>

              <button
                type="button"
                id="edit-korean-note-btn"
                onClick={handleOpenKoreanEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                title="한글 작가노트 수정 (저장 시 영문 자동 생성)"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>한글 수정</span>
              </button>

              <button
                type="button"
                id="edit-english-note-btn"
                onClick={handleOpenEnglishEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 hover:border-neutral-400 rounded text-xs font-medium transition-colors cursor-pointer"
                title="영문 작가노트 직접 수정"
              >
                <Globe className="w-3.5 h-3.5 text-neutral-600" />
                <span>영문 수정</span>
              </button>
            </div>
          )}
        </div>

        {/* Note Reading Stage (Requirement 1, 3, 11)
            - Korean original text preserved
            - English text displayed directly below Korean
            - NO separate "영문", "English", "번역" label or buttons displayed on screen
            - Maintains design, font, and spacing
        */}
        <article className="bg-[#FAF9F6] border border-neutral-200/90 p-6 sm:p-12 md:p-14 rounded-xs shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-8">
          {/* Note Metadata Header */}
          <div className="border-b border-neutral-300 pb-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] font-mono-code uppercase tracking-widest text-neutral-400 block mb-1">
                ARTIST NOTE · {currentNote.key}
              </span>
              <h2 className="font-serif-title text-2xl sm:text-3xl text-neutral-900 font-medium leading-snug">
                {currentNote.title}
              </h2>
            </div>
            <div className="text-xs font-mono-code text-neutral-500">
              작성연도: {currentNote.writtenYear}
            </div>
          </div>

          {/* 1. Korean Original Text */}
          <div className="text-sm sm:text-base text-neutral-800 font-light leading-[2.1] whitespace-pre-line tracking-wide font-serif">
            {currentNote.content}
          </div>

          {/* 2. English Text (Displayed directly below Korean with subtle natural divider, NO labels) */}
          {currentNote.contentEn && (
            <div className="pt-8 border-t border-neutral-200/70">
              <div className="text-sm sm:text-base text-neutral-700/90 font-light leading-[2.1] whitespace-pre-line tracking-wide font-serif">
                {currentNote.contentEn}
              </div>
            </div>
          )}

          {/* Signature Footer */}
          <div className="pt-8 border-t border-neutral-200/80 flex items-center justify-between text-xs text-neutral-500 font-light">
            <span className="tracking-widest uppercase">{artist.englishName} ARTIST STATEMENT</span>
            <span className="font-mono-code text-[11px] text-neutral-400">
              {currentNote.updatedAt ? `Last Updated: ${currentNote.updatedAt.slice(0, 10)}` : 'Verified Archive'}
            </span>
          </div>
        </article>

        {/* Modal 1: Korean Edit Modal (Admin Only) */}
        {editModalType === 'ko' && editingNoteKo && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-neutral-700" />
                  <span>Artist Note {editingNoteKo.key} 한글 수정</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveKoreanEdit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-neutral-600 font-medium mb-1">
                      작가노트 제목 (Title)
                    </label>
                    <input
                      type="text"
                      required
                      value={editingNoteKo.title}
                      onChange={(e) => setEditingNoteKo({ ...editingNoteKo, title: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">
                      작성연도 (Year)
                    </label>
                    <input
                      type="number"
                      required
                      value={editingNoteKo.writtenYear}
                      onChange={(e) =>
                        setEditingNoteKo({ ...editingNoteKo, writtenYear: parseInt(e.target.value, 10) || 2026 })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-sm"
                    />
                  </div>
                </div>

                {/* Korean Content */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-neutral-700 font-medium">
                      한글 본문 (Korean Content)
                    </label>
                    <span className="text-[11px] text-neutral-400 font-mono-code">
                      {editingNoteKo.content.length}자
                    </span>
                  </div>
                  <textarea
                    rows={11}
                    required
                    value={editingNoteKo.content}
                    onChange={(e) => setEditingNoteKo({ ...editingNoteKo, content: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded font-serif text-sm leading-relaxed focus:outline-none focus:border-neutral-900"
                    placeholder="한글 작가노트 본문을 입력하세요..."
                  />
                </div>

                {/* Translation Behavior (Requirement 2, 3, 4, 6, 7, 10, 11) */}
                {editingNoteKo.isCustomEnglish ? (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded space-y-2">
                    <div className="flex items-start gap-2 text-amber-900 text-xs leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">직접 수정한 영문이 안전하게 유지됩니다</span>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          한글을 수정하여 저장해도 기존에 직접 작성 및 수정한 영문 내용은 자동으로 덮어써지지 않고 그대로 유지됩니다.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer pt-1.5 border-t border-amber-200/80">
                      <input
                        type="checkbox"
                        checked={forceRegenerateEn}
                        onChange={(e) => setForceRegenerateEn(e.target.checked)}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer"
                      />
                      <span>수정된 한글 내용을 기준으로 영문 전체를 새로 자동 번역하여 덮어쓰기</span>
                    </label>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded space-y-1">
                    <div className="flex items-start gap-2 text-neutral-700 text-xs leading-relaxed">
                      <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-neutral-900">한글 수정 시 영문 전체 자동 번역</span>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          저장 시 수정된 한글 전체 내용을 바탕으로 모든 문단이 빠짐없이 1:1 대응 영문으로 자동 번역되어 함께 저장됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isTranslating}
                    className="px-4 py-1.5 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {(isSaving || isTranslating) && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSaving || isTranslating ? '번역 및 저장 중...' : '저장 완료'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: English Direct Edit Modal (Admin Only) (Requirement 5) */}
        {editModalType === 'en' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-neutral-700" />
                  <span>Artist Note {currentNote.key} 영문 직접 수정</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEnglishEdit} className="space-y-4 text-xs">
                {/* Optional Korean Reference Accordion */}
                <div className="border border-neutral-200 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowKoreanReference(!showKoreanReference)}
                    className="w-full px-3 py-2 bg-neutral-50 flex items-center justify-between text-neutral-700 font-medium text-left cursor-pointer hover:bg-neutral-100"
                  >
                    <span>원문 한글 내용 참고 ({currentNote.title})</span>
                    <span className="text-[10px] text-neutral-400 font-mono-code">
                      {showKoreanReference ? '접기' : '펼치기'}
                    </span>
                  </button>
                  {showKoreanReference && (
                    <div className="p-3 bg-white max-h-36 overflow-y-auto text-neutral-600 font-serif text-xs leading-relaxed border-t border-neutral-200 whitespace-pre-line">
                      {currentNote.content}
                    </div>
                  )}
                </div>

                {/* English Content Area */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-neutral-700 font-medium">
                      영문 본문 (English Content)
                    </label>
                    <button
                      type="button"
                      onClick={handleRunEnglishTranslationInModal}
                      disabled={isTranslating}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-neutral-700 hover:text-neutral-950 border border-neutral-300 hover:border-neutral-400 rounded bg-white hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
                      title="현재 한글 본문 내용을 기준으로 영문 자동 번역을 실행하여 입력창에 채웁니다."
                    >
                      {isTranslating ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-neutral-500" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                      )}
                      <span>한글 기준 자동 번역 불러오기</span>
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    required
                    value={editingEnglishText}
                    onChange={(e) => setEditingEnglishText(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded font-serif text-sm leading-relaxed focus:outline-none focus:border-neutral-900 text-neutral-800"
                    placeholder="영문 작가노트 내용을 입력하거나 수정하세요..."
                    autoFocus
                  />
                  <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                    * 영문 본문을 직접 수정하여 저장하면 영문 내용만 독립적으로 업데이트되며, 한글 원문은 전혀 변경되지 않습니다. (영문 → 한글 역번역 없음)
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isTranslating}
                    className="px-4 py-1.5 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSaving ? '저장 중...' : '영문 저장 완료'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
