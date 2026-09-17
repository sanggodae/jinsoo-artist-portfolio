import React, { useState } from 'react';
import { ArtistNoteItem, SiteSettings } from '../../types';
import { Edit3, Check, CheckCircle2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { saveArtistNoteToFirestore, saveSiteSettingsToFirestore } from '../../services/firestoreService';
import { getArtistProfile } from '../../utils/artistProfile';

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

  // Currently editing note
  const [editingNote, setEditingNote] = useState<ArtistNoteItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const currentNote =
    notes.find((n) => n.key === activeTab) ||
    notes[0] || {
      id: `note-${activeTab.toLowerCase()}`,
      key: activeTab,
      title: `Artist Note ${activeTab}`,
      writtenYear: 2026,
      content: '작가노트 내용이 준비 중입니다.',
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

  // Open edit modal
  const handleStartEdit = () => {
    if (!isAdmin) return;
    setEditingNote({ ...currentNote });
  };

  // Save note edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !isAdmin) return;

    setIsSaving(true);
    const updatedNote: ArtistNoteItem = {
      ...editingNote,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = notes.some((n) => n.key === updatedNote.key)
      ? notes.map((n) => (n.key === updatedNote.key ? updatedNote : n))
      : [...notes, updatedNote];

    onUpdateNotes(updatedList);

    try {
      await saveArtistNoteToFirestore(updatedNote);
      setSaveSuccessMsg(`Artist Note ${updatedNote.key}가 성공적으로 저장되었습니다.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err) {
      console.error('[ArtistNote] Failed to save note in Firestore:', err);
    }

    setIsSaving(false);
    setEditingNote(null);
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
                className="text-xs text-neutral-400 hover:text-neutral-700 underline font-light self-start sm:self-auto"
              >
                관리자 로그인
              </button>
            )
          )}
        </div>

        {saveSuccessMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Note A / Note B Switcher Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4 mb-8">
          <div className="flex items-center gap-3 bg-neutral-100 p-1 rounded-sm w-fit border border-neutral-200">
            <button
              type="button"
              id="artist-note-tab-a"
              onClick={() => setActiveTab('A')}
              className={`px-4 py-2 text-xs sm:text-sm font-medium tracking-wider uppercase rounded-xs transition-all ${
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
              className={`px-4 py-2 text-xs sm:text-sm font-medium tracking-wider uppercase rounded-xs transition-all ${
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

          {/* Portfolio Active Selection Control & Edit Trigger */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  id="select-portfolio-note-btn"
                  onClick={() => handleSelectForPortfolio(activeTab)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    selectedForPortfolio === activeTab
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  }`}
                  title="공모전/포트폴리오 제출 시 기본 작가노트로 지정"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {selectedForPortfolio === activeTab
                      ? '포트폴리오 대표로 지정됨'
                      : '이 노트를 대표로 선택'}
                  </span>
                </button>

                <button
                  type="button"
                  id="edit-artist-note-btn"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>내용 수정</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Note Reading Stage */}
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

          {/* Literary Body Text */}
          <div className="text-sm sm:text-base text-neutral-800 font-light leading-[2.1] whitespace-pre-line tracking-wide font-serif">
            {currentNote.content}
          </div>

          {/* Signature Footer */}
          <div className="pt-8 border-t border-neutral-200/80 flex items-center justify-between text-xs text-neutral-500 font-light">
            <span className="tracking-widest uppercase">{artist.englishName} ARTIST STATEMENT</span>
            <span className="font-mono-code text-[11px] text-neutral-400">
              {currentNote.updatedAt ? `Last Updated: ${currentNote.updatedAt.slice(0, 10)}` : 'Verified Archive'}
            </span>
          </div>
        </article>

        {/* Edit Note Modal */}
        {editingNote && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-2xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <h3 className="text-sm font-medium text-neutral-900 flex items-center gap-2">
                  <span>Artist Note {editingNote.key} 내용 수정</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-neutral-600 font-medium mb-1">
                      작가노트 제목 (Title)
                    </label>
                    <input
                      type="text"
                      required
                      value={editingNote.title}
                      onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
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
                      value={editingNote.writtenYear}
                      onChange={(e) =>
                        setEditingNote({ ...editingNote, writtenYear: parseInt(e.target.value, 10) || 2026 })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-600 font-medium mb-1">
                    작가노트 본문 (Content)
                  </label>
                  <textarea
                    rows={12}
                    required
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded font-serif text-sm leading-relaxed focus:outline-none focus:border-neutral-900"
                    placeholder="작가노트 본문을 입력해주세요..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setEditingNote(null)}
                    className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium disabled:opacity-50"
                  >
                    {isSaving ? '저장 중...' : '저장 완료'}
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
