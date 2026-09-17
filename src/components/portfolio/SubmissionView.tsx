import React, { useState, useEffect, useMemo } from 'react';
import {
  Artwork,
  CVSection,
  CVItem,
  ArtistNoteItem,
  SiteSettings,
  Submission,
} from '../../types';
import {
  fetchSubmissionsFromFirestore,
  saveSubmissionToFirestore,
  deleteSubmissionFromFirestore,
} from '../../services/firestoreService';
import { formatMaterialOnCanvas } from '../../utils/formatters';
import { getArtistProfile } from '../../utils/artistProfile';
import { SubmissionPreviewModal } from './SubmissionPreviewModal';
import {
  FileText,
  CheckSquare,
  Square,
  Eye,
  Printer,
  Save,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Layers,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface SubmissionViewProps {
  artworks: Artwork[];
  cvSections: CVSection[];
  artistNotes: ArtistNoteItem[];
  settings: SiteSettings;
  isAdmin: boolean;
  onOpenAuthModal?: () => void;
}

export const SubmissionView: React.FC<SubmissionViewProps> = ({
  artworks,
  cvSections,
  artistNotes,
  settings,
  isAdmin,
  onOpenAuthModal,
}) => {
  const artist = getArtistProfile(settings);

  // Submissions list from Firestore
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Active step in the submission studio: 'OVERVIEW' | 'COVER' | 'CV' | 'ARTIST_NOTE' | 'WORKS'
  const [activeConfigTab, setActiveConfigTab] = useState<'WORKS' | 'CV' | 'ARTIST_NOTE' | 'COVER' | 'SETTINGS'>('WORKS');

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load Submissions on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSubmissions() {
      setIsLoading(true);
      try {
        const list = await fetchSubmissionsFromFirestore();
        if (!isMounted) return;

        if (list && list.length > 0) {
          setSubmissions(list);
          setSelectedSubmissionId(list[0].id);
        } else {
          // Initialize a clean default submission if none exists
          const defaultSub: Submission = createDefaultSubmission(artworks, cvSections, settings);
          setSubmissions([defaultSub]);
          setSelectedSubmissionId(defaultSub.id);
        }
      } catch (err) {
        console.error('[SubmissionView] Failed to load submissions:', err);
        const defaultSub = createDefaultSubmission(artworks, cvSections, settings);
        setSubmissions([defaultSub]);
        setSelectedSubmissionId(defaultSub.id);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSubmissions();
    return () => {
      isMounted = false;
    };
  }, [artworks, cvSections, settings]);

  // Current active submission
  const currentSubmission = useMemo(() => {
    return submissions.find((s) => s.id === selectedSubmissionId) || submissions[0] || null;
  }, [submissions, selectedSubmissionId]);

  // Helper to create a new default submission
  function createDefaultSubmission(
    arts: Artwork[],
    cvs: CVSection[],
    siteCfg: SiteSettings
  ): Submission {
    // Default artwork IDs: sorted by displayOrder
    const sortedArtIds = [...arts]
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((a) => a.id);

    // Default CV IDs: items where selected === true
    const defaultCvIds: string[] = [];
    cvs.forEach((sec) => {
      sec.items?.forEach((it) => {
        if (it.selected) {
          defaultCvIds.push(it.id);
        }
      });
    });

    const now = new Date().toISOString();
    return {
      id: `sub-${Date.now()}`,
      title: '2026 개인전 / 갤러리 공모 제출 포트폴리오',
      targetOrganization: '주요 미술관 및 갤러리',
      submissionDeadline: '',
      selectedArtworkIds: sortedArtIds,
      selectedCvIds: defaultCvIds,
      selectedArtistNoteId: siteCfg.selectedArtistNoteKey === 'B' ? 'note-b' : 'note-a',
      coverArtworkId: arts.find((a) => a.isFeatured)?.id || arts[0]?.id || '',
      memo: '공모전 및 전시기획 제출을 위한 정규 포트폴리오 (A4 Landscape)',
      createdAt: now,
      updatedAt: now,
    };
  }

  // Update current submission state
  const updateCurrentSubmission = (updater: (prev: Submission) => Submission) => {
    if (!currentSubmission) return;
    const updated = updater(currentSubmission);
    updated.updatedAt = new Date().toISOString();

    setSubmissions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  // Create new submission package
  const handleCreateNewSubmission = () => {
    const newSub: Submission = {
      ...createDefaultSubmission(artworks, cvSections, settings),
      id: `sub-${Date.now()}`,
      title: `새 공모전 제출 포트폴리오 #${submissions.length + 1}`,
    };
    setSubmissions((prev) => [newSub, ...prev]);
    setSelectedSubmissionId(newSub.id);
    setSaveMessage({ text: '새 제출본이 생성되었습니다. 구성 후 [제출본 저장]을 눌러주세요.' });
    setTimeout(() => setSaveMessage(null), 4000);
  };

  // Delete submission
  const handleDeleteSubmission = async (subId: string) => {
    if (submissions.length <= 1) {
      alert('최소 1개의 제출본은 유지되어야 합니다.');
      return;
    }
    const target = submissions.find((s) => s.id === subId);
    if (!window.confirm(`"${target?.title}" 제출본을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteSubmissionFromFirestore(subId);
      const remaining = submissions.filter((s) => s.id !== subId);
      setSubmissions(remaining);
      setSelectedSubmissionId(remaining[0].id);
      setSaveMessage({ text: '제출본이 삭제되었습니다.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('[SubmissionView] Failed to delete submission:', err);
      setSaveMessage({ text: '삭제에 실패했습니다.', isError: true });
    }
  };

  // Save to Firestore
  const handleSaveToFirestore = async () => {
    if (!currentSubmission || !isAdmin) return;
    setIsSaving(true);
    try {
      await saveSubmissionToFirestore(currentSubmission);
      setSaveMessage({ text: 'Firestore submissions 컬렉션에 성공적으로 저장되었습니다.' });
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      console.error('[SubmissionView] Save failed:', err);
      setSaveMessage({ text: `저장 실패: ${err?.message || '권한 또는 네트워크 오류'}`, isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  // Artwork selection toggling
  const handleToggleArtwork = (artworkId: string) => {
    if (!currentSubmission) return;
    const currentList = currentSubmission.selectedArtworkIds || [];
    const isSelected = currentList.includes(artworkId);

    const newList = isSelected
      ? currentList.filter((id) => id !== artworkId)
      : [...currentList, artworkId];

    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedArtworkIds: newList,
    }));
  };

  // Artwork quick actions
  const handleSelectAllArtworks = () => {
    const allIds = [...artworks]
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((a) => a.id);
    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedArtworkIds: allIds,
    }));
  };

  const handleSelectFeaturedOnlyArtworks = () => {
    const featuredIds = [...artworks]
      .filter((a) => a.isFeatured)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((a) => a.id);
    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedArtworkIds: featuredIds,
    }));
  };

  const handleClearAllArtworks = () => {
    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedArtworkIds: [],
    }));
  };

  // Reordering selected artworks
  const handleMoveArtwork = (artworkId: string, direction: 'up' | 'down') => {
    if (!currentSubmission) return;
    const list = [...(currentSubmission.selectedArtworkIds || [])];
    const index = list.indexOf(artworkId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = list[index - 1];
      list[index - 1] = list[index];
      list[index] = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index + 1];
      list[index + 1] = list[index];
      list[index] = temp;
    }

    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedArtworkIds: list,
    }));
  };

  // CV item selection toggling
  const handleToggleCvItem = (itemId: string) => {
    if (!currentSubmission) return;
    const currentList = currentSubmission.selectedCvIds || [];
    const isSelected = currentList.includes(itemId);

    const newList = isSelected
      ? currentList.filter((id) => id !== itemId)
      : [...currentList, itemId];

    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedCvIds: newList,
    }));
  };

  // CV quick actions
  const handleResetCvToDefault = () => {
    const defaultIds: string[] = [];
    cvSections.forEach((sec) => {
      sec.items?.forEach((it) => {
        if (it.selected) defaultIds.push(it.id);
      });
    });
    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedCvIds: defaultIds,
    }));
    setSaveMessage({ text: '기존 CV의 기본 선택값(selected=true)으로 복원되었습니다.' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleSelectAllCv = () => {
    const allIds: string[] = [];
    cvSections.forEach((sec) => {
      sec.items?.forEach((it) => allIds.push(it.id));
    });
    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedCvIds: allIds,
    }));
  };

  const handleClearAllCv = () => {
    updateCurrentSubmission((prev) => ({
      ...prev,
      selectedCvIds: [],
    }));
  };

  // Resolved entities for preview / render
  const resolvedSelectedArtworks = useMemo(() => {
    if (!currentSubmission) return [];
    const idMap = new Map<string, Artwork>(artworks.map((a) => [a.id, a]));
    const result: Artwork[] = [];
    currentSubmission.selectedArtworkIds.forEach((id) => {
      const art = idMap.get(id);
      if (art) result.push(art);
    });
    return result;
  }, [artworks, currentSubmission]);

  const resolvedArtistNote = useMemo(() => {
    if (!currentSubmission) return artistNotes[0];
    const found = artistNotes.find(
      (n) => n.id === currentSubmission.selectedArtistNoteId || n.key === currentSubmission.selectedArtistNoteId
    );
    return found || artistNotes[0] || {
      id: 'note-a',
      key: 'A',
      title: 'Artist Note A',
      writtenYear: 2026,
      content: '작가노트 내용이 준비 중입니다.',
    };
  }, [artistNotes, currentSubmission]);

  const resolvedCoverArtwork = useMemo(() => {
    if (!currentSubmission) return artworks[0];
    if (currentSubmission.coverArtworkId) {
      const found = artworks.find((a) => a.id === currentSubmission.coverArtworkId);
      if (found) return found;
    }
    return resolvedSelectedArtworks[0] || artworks[0];
  }, [artworks, currentSubmission, resolvedSelectedArtworks]);

  // Access check: only admin can view Submission Studio
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif-title font-medium text-neutral-900 mb-2">
          공모전 제출 관리 (SUBMISSION STUDIO)
        </h2>
        <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
          공모전 포트폴리오 구성 및 출력 기능은 박진수 작가 관리자 로그인 시에만 접근 가능합니다.
        </p>
        {onOpenAuthModal && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-5 py-2.5 bg-neutral-900 text-white rounded text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm"
          >
            작가 관리자 로그인
          </button>
        )}
      </div>
    );
  }

  if (isLoading || !currentSubmission) {
    return (
      <div className="py-24 text-center text-xs font-mono-code text-neutral-400">
        SUBMISSION 데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div id="submission-studio-view" className="w-full py-8 sm:py-10 bg-neutral-50/50 min-h-[85vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* =========================================================
            Top Header & Submission Package Selector
            ========================================================= */}
        <div className="bg-white border border-neutral-200/90 rounded-xs p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-code tracking-[0.2em] text-neutral-400 uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
              <span>ADMIN WORKSPACE · SUBMISSION PORTFOLIO</span>
            </div>
            <h1 className="font-serif-title text-2xl sm:text-3xl font-medium text-neutral-950 flex items-center gap-3">
              <span>공모전 제출용 포트폴리오</span>
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                A4 LANDSCAPE 규격
              </span>
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              기존 작품 13점, CV, 작가노트를 원본 보존 상태로 선택하여 A4 가로형 공모전 제출 도록을 생성합니다.
            </p>
          </div>

          {/* Action Buttons: Preview & Print & Save */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              id="save-submission-btn"
              onClick={handleSaveToFirestore}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded shadow-xs transition-colors"
              title="현재 설정을 Firestore submissions 컬렉션에 저장합니다."
            >
              <Save className="w-3.5 h-3.5 text-neutral-500" />
              <span>{isSaving ? '저장 중...' : '제출본 저장'}</span>
            </button>

            <button
              type="button"
              id="preview-submission-btn"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded shadow-xs transition-all active:scale-[0.98]"
              title="A4 Landscape 5단계 제출본 도록을 전체 화면으로 미리 확인합니다."
            >
              <Eye className="w-3.5 h-3.5" />
              <span>[제출용 포트폴리오 미리보기]</span>
            </button>

            <button
              type="button"
              id="print-pdf-direct-btn"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 rounded shadow-sm transition-all active:scale-[0.98]"
              title="미리보기 화면으로 이동 후 A4 가로 인쇄 또는 PDF로 저장합니다."
            >
              <Printer className="w-3.5 h-3.5" />
              <span>[PRINT / PDF]</span>
            </button>
          </div>
        </div>

        {/* Feedback Message Alert */}
        {saveMessage && (
          <div
            className={`p-3 rounded text-xs flex items-center gap-2 transition-all ${
              saveMessage.isError
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {saveMessage.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span>{saveMessage.text}</span>
          </div>
        )}

        {/* =========================================================
            Submission Package Switcher & Metadata Editor
            ========================================================= */}
        <div className="bg-white border border-neutral-200/90 rounded-xs p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-200/80 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                제출본 선택:
              </span>
              <select
                value={selectedSubmissionId}
                onChange={(e) => setSelectedSubmissionId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium font-mono-code text-neutral-900 bg-neutral-50 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 min-w-[260px]"
              >
                {submissions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.title} ({sub.selectedArtworkIds?.length || 0}점 선택)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCreateNewSubmission}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 transition-colors"
                title="새로운 공모전 또는 갤러리 제출본을 생성합니다."
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 제출본 추가</span>
              </button>
            </div>

            {/* Delete button */}
            {submissions.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteSubmission(currentSubmission.id)}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors self-end lg:self-auto"
                title="현재 제출본 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>제출본 삭제</span>
              </button>
            )}
          </div>

          {/* Quick Metadata Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 uppercase mb-1">
                포트폴리오 제목 (Title) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentSubmission.title}
                onChange={(e) =>
                  updateCurrentSubmission((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="예: 2026 개인전 공모 제출용 포트폴리오"
                className="w-full px-3 py-2 border border-neutral-300 rounded bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 uppercase mb-1">
                제출 대상 기관 / 갤러리 (Target)
              </label>
              <input
                type="text"
                value={currentSubmission.targetOrganization || ''}
                onChange={(e) =>
                  updateCurrentSubmission((prev) => ({
                    ...prev,
                    targetOrganization: e.target.value,
                  }))
                }
                placeholder="예: OOO 갤러리 공모전 심사위원회"
                className="w-full px-3 py-2 border border-neutral-300 rounded bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-600 uppercase mb-1">
                제출 마감일 (Deadline)
              </label>
              <input
                type="text"
                value={currentSubmission.submissionDeadline || ''}
                onChange={(e) =>
                  updateCurrentSubmission((prev) => ({
                    ...prev,
                    submissionDeadline: e.target.value,
                  }))
                }
                placeholder="예: 2026. 10. 31"
                className="w-full px-3 py-2 border border-neutral-300 rounded bg-white text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>
          </div>
        </div>

        {/* =========================================================
            Five-Part Navigation Tab (COVER -> CV -> NOTE -> LIST -> WORKS)
            ========================================================= */}
        <div className="bg-white border border-neutral-200/90 rounded-xs shadow-xs overflow-hidden">
          <div className="flex border-b border-neutral-200 overflow-x-auto no-scrollbar bg-neutral-50/70">
            <button
              type="button"
              onClick={() => setActiveConfigTab('WORKS')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold tracking-wider transition-colors border-r border-neutral-200 whitespace-nowrap ${
                activeConfigTab === 'WORKS'
                  ? 'bg-white text-neutral-950 border-b-2 border-b-neutral-950'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span className="font-mono-code text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                04 & 05
              </span>
              <span>작품 선택 및 순서 ({resolvedSelectedArtworks.length}/{artworks.length}점)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveConfigTab('CV')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold tracking-wider transition-colors border-r border-neutral-200 whitespace-nowrap ${
                activeConfigTab === 'CV'
                  ? 'bg-white text-neutral-950 border-b-2 border-b-neutral-950'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span className="font-mono-code text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                02
              </span>
              <span>CV 항목 선택 ({(currentSubmission.selectedCvIds || []).length}개)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveConfigTab('ARTIST_NOTE')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold tracking-wider transition-colors border-r border-neutral-200 whitespace-nowrap ${
                activeConfigTab === 'ARTIST_NOTE'
                  ? 'bg-white text-neutral-950 border-b-2 border-b-neutral-950'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span className="font-mono-code text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                03
              </span>
              <span>작가노트 선택 ({resolvedArtistNote.title})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveConfigTab('COVER')}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold tracking-wider transition-colors border-r border-neutral-200 whitespace-nowrap ${
                activeConfigTab === 'COVER'
                  ? 'bg-white text-neutral-950 border-b-2 border-b-neutral-950'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <span className="font-mono-code text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">
                01
              </span>
              <span>표지 대표 이미지</span>
            </button>
          </div>

          <div className="p-6">
            {/* =========================================================
                TAB 1: WORKS SELECTION & ORDERING
                - [ ] 제출 체크박스
                - 순서: displayOrder 기본, 위/아래 이동 가능
                - Canvas Size 실제 cm 표시
                - Material: Acrylic on Canvas 등
                ========================================================= */}
            {activeConfigTab === 'WORKS' && (
              <div className="space-y-4">
                {/* Control bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 p-3 rounded border border-neutral-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-800">
                      선택된 작품: {resolvedSelectedArtworks.length}점 / 전체 {artworks.length}점
                    </span>
                    <span className="text-neutral-400">|</span>
                    <span className="text-neutral-500">
                      (WORKS LIST 및 PAGE 05 이후 상세 페이지에 순서대로 포함됩니다)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectFeaturedOnlyArtworks}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 rounded border border-neutral-200"
                    >
                      대표작만 선택
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllArtworks}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 rounded border border-neutral-200"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllArtworks}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 rounded border border-neutral-200"
                    >
                      선택 해제
                    </button>
                  </div>
                </div>

                {/* Artworks Table */}
                <div className="border border-neutral-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 font-mono-code uppercase text-[11px]">
                        <th className="py-2.5 px-3 w-16 text-center">제출</th>
                        <th className="py-2.5 px-2 w-16 text-center">순서</th>
                        <th className="py-2.5 px-3 w-16 text-center">도판</th>
                        <th className="py-2.5 px-3 w-28">작품번호</th>
                        <th className="py-2.5 px-3">작품명 (Title)</th>
                        <th className="py-2.5 px-3 w-32">Canvas Size</th>
                        <th className="py-2.5 px-3 w-36">Material</th>
                        <th className="py-2.5 px-2 w-16 text-center">Year</th>
                        <th className="py-2.5 px-3 w-20 text-center">설명</th>
                        <th className="py-2.5 px-3 w-24 text-center">순서 조정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white">
                      {artworks.map((art) => {
                        const isSelected = (currentSubmission.selectedArtworkIds || []).includes(art.id);
                        const orderIndex = (currentSubmission.selectedArtworkIds || []).indexOf(art.id);
                        const hasDescription = Boolean(art.description && art.description.trim().length > 0);

                        return (
                          <tr
                            key={art.id}
                            className={`hover:bg-neutral-50/80 transition-colors ${
                              isSelected ? 'bg-amber-50/30 font-medium' : 'text-neutral-500'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleArtwork(art.id)}
                                className="p-1 text-neutral-800 hover:text-neutral-950 focus:outline-none"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-amber-700" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-300" />
                                )}
                              </button>
                            </td>

                            {/* Submission Order No. */}
                            <td className="py-2.5 px-2 text-center font-mono-code text-[11px]">
                              {isSelected ? (
                                <span className="font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                                  #{String(orderIndex + 1).padStart(2, '0')}
                                </span>
                              ) : (
                                <span className="text-neutral-300">-</span>
                              )}
                            </td>

                            {/* Thumbnail */}
                            <td className="py-2 px-3 text-center">
                              <div className="w-10 h-10 mx-auto bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                                <img
                                  src={art.imageUrl}
                                  alt={art.title}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            </td>

                            {/* Code */}
                            <td className="py-2.5 px-3 font-mono-code text-neutral-900 font-semibold">
                              {art.code}
                            </td>

                            {/* Title */}
                            <td className="py-2.5 px-3 font-serif-title text-sm text-neutral-950">
                              <div className="flex items-center gap-1.5">
                                <span>{art.title}</span>
                                {art.isFeatured && (
                                  <span className="text-[10px] font-sans px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-normal">
                                    대표작
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Canvas Size (actual cm) */}
                            <td className="py-2.5 px-3 font-mono-code text-neutral-800">
                              {art.widthCm} × {art.heightCm} cm
                            </td>

                            {/* Material */}
                            <td className="py-2.5 px-3 text-neutral-700">
                              {formatMaterialOnCanvas(art.material)}
                            </td>

                            {/* Year */}
                            <td className="py-2.5 px-2 text-center font-mono-code text-neutral-700">
                              {art.year}
                            </td>

                            {/* Description presence */}
                            <td className="py-2.5 px-3 text-center font-mono-code text-[11px]">
                              {hasDescription ? (
                                <span className="text-emerald-700">작성됨</span>
                              ) : (
                                <span className="text-neutral-300">없음</span>
                              )}
                            </td>

                            {/* Reorder Buttons */}
                            <td className="py-2.5 px-3 text-center">
                              {isSelected ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveArtwork(art.id, 'up')}
                                    disabled={orderIndex <= 0}
                                    className="p-1 rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-20"
                                    title="위로 이동"
                                  >
                                    <MoveUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveArtwork(art.id, 'down')}
                                    disabled={orderIndex >= (currentSubmission.selectedArtworkIds?.length || 0) - 1}
                                    className="p-1 rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-20"
                                    title="아래로 이동"
                                  >
                                    <MoveDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-neutral-300 text-[10px]">미선택</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 2: CV ITEMS SELECTION
                - 기존 CV 데이터의 selected = true 항목 연동
                - 복사본이 아닌 원본 ID 참조
                - 섹션별 토글
                ========================================================= */}
            {activeConfigTab === 'CV' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-50 p-3 rounded border border-neutral-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-800">
                      선택된 CV 항목: {(currentSubmission.selectedCvIds || []).length}개
                    </span>
                    <span className="text-neutral-400">|</span>
                    <span className="text-neutral-500">
                      원본 CV 데이터는 변경되지 않으며 본 제출본에 포함될 항목만 선별합니다.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetCvToDefault}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
                      title="기존 CV 관리에서 selected=true 로 체크된 기본값으로 복원"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>기존 CV 기본값 불러오기</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllCv}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 rounded border border-neutral-200"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllCv}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 rounded border border-neutral-200"
                    >
                      선택 해제
                    </button>
                  </div>
                </div>

                {/* CV Sections Loop */}
                <div className="space-y-6">
                  {cvSections.map((sec) => (
                    <div key={sec.id} className="border border-neutral-200 rounded p-4 bg-white">
                      <div className="flex items-center justify-between border-b border-neutral-200 pb-2 mb-3">
                        <h3 className="text-xs font-bold font-sans tracking-wider uppercase text-neutral-900 flex items-center gap-2">
                          <span>{sec.titleEn}</span>
                          <span className="text-neutral-400 font-normal font-sans">({sec.titleKo})</span>
                        </h3>
                        <span className="text-[11px] font-mono-code text-neutral-500">
                          {sec.items?.filter((i) => (currentSubmission.selectedCvIds || []).includes(i.id)).length} / {sec.items?.length || 0} 선택됨
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {sec.items?.map((item) => {
                          const isChecked = (currentSubmission.selectedCvIds || []).includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors border ${
                                isChecked
                                  ? 'bg-amber-50/40 border-amber-200 text-neutral-950 font-medium'
                                  : 'bg-white border-neutral-100 text-neutral-500 hover:bg-neutral-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCvItem(item.id)}
                                className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-0"
                              />
                              <div className="flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-mono-code text-[11px] text-neutral-500 font-normal">
                                    {item.year}
                                  </span>
                                  <span className="text-neutral-900">{item.title}</span>
                                </div>
                                {item.institution && (
                                  <p className="text-[11px] text-neutral-500 font-normal mt-0.5">
                                    {item.institution} {item.location && `(${item.location})`}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 3: ARTIST NOTE SELECTION
                - 1개 선택 (Note A or Note B)
                ========================================================= */}
            {activeConfigTab === 'ARTIST_NOTE' && (
              <div className="space-y-4">
                <div className="bg-neutral-50 p-3 rounded border border-neutral-200 text-xs text-neutral-600">
                  제출 포트폴리오의 PAGE 03에 수록할 1개의 작가노트를 선택합니다.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {artistNotes.map((note) => {
                    const isSelected = currentSubmission.selectedArtistNoteId === note.id || currentSubmission.selectedArtistNoteId === note.key;
                    return (
                      <div
                        key={note.id}
                        onClick={() =>
                          updateCurrentSubmission((prev) => ({
                            ...prev,
                            selectedArtistNoteId: note.id,
                          }))
                        }
                        className={`p-5 rounded border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-neutral-900 bg-amber-50/20 shadow-xs'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center font-mono-code text-xs font-bold">
                              {note.key}
                            </span>
                            <h3 className="font-serif-title text-base font-semibold text-neutral-950">
                              {note.title}
                            </h3>
                          </div>
                          {isSelected && (
                            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> 선택됨
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-mono-code text-neutral-500 mb-2">
                          작성연도: {note.writtenYear}년 {note.critiqueAuthor && `· 평론: ${note.critiqueAuthor}`}
                        </div>

                        <p className="text-xs text-neutral-700 font-serif-title leading-relaxed line-clamp-4 whitespace-pre-line bg-neutral-50 p-3 rounded border border-neutral-100">
                          {note.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 4: COVER IMAGE SELECTION
                - Cover의 대표 작품 1장 선택 (정적 이미지)
                ========================================================= */}
            {activeConfigTab === 'COVER' && (
              <div className="space-y-4">
                <div className="bg-neutral-50 p-3 rounded border border-neutral-200 text-xs text-neutral-600">
                  제출 포트폴리오 표지(COVER)에 단독으로 배치될 대표 회화 작품 1장을 선택합니다.
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {artworks.map((art) => {
                    const isCover = currentSubmission.coverArtworkId === art.id;
                    return (
                      <div
                        key={art.id}
                        onClick={() =>
                          updateCurrentSubmission((prev) => ({
                            ...prev,
                            coverArtworkId: art.id,
                          }))
                        }
                        className={`p-2.5 rounded border-2 cursor-pointer transition-all flex flex-col items-center justify-between text-center ${
                          isCover
                            ? 'border-neutral-950 bg-amber-50/40 shadow-xs'
                            : 'border-neutral-200 hover:border-neutral-300 bg-white'
                        }`}
                      >
                        <div className="w-full aspect-[4/3] bg-neutral-100 flex items-center justify-center overflow-hidden mb-2">
                          <img
                            src={art.imageUrl}
                            alt={art.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="w-full">
                          <p className="font-mono-code text-[11px] font-semibold text-neutral-900">
                            {art.code}
                          </p>
                          <p className="font-serif-title text-xs font-medium text-neutral-950 truncate">
                            {art.title}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {art.widthCm} × {art.heightCm} cm
                          </p>
                        </div>
                        {isCover && (
                          <span className="mt-1.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded w-full">
                            표지 대표작
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================
          Preview Modal
          ========================================================= */}
      <SubmissionPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        submission={currentSubmission}
        selectedArtworks={resolvedSelectedArtworks}
        cvSections={cvSections}
        selectedCvIds={currentSubmission.selectedCvIds || []}
        selectedArtistNote={resolvedArtistNote}
        coverArtwork={resolvedCoverArtwork}
        settings={settings}
      />
    </div>
  );
};
