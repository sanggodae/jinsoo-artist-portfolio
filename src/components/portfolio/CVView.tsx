import React, { useState, useRef, useMemo } from 'react';
import { CVSection, CVItem, CVCategory, SiteSettings } from '../../types';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  CheckSquare,
  Square,
  ShieldCheck,
  X,
  Camera,
  Upload,
  Loader2,
  AlertCircle,
  ImageIcon,
  FileCheck,
  Copy,
  Layers,
} from 'lucide-react';
import {
  saveCVSectionToFirestore,
  saveSiteSettingsToFirestore,
} from '../../services/firestoreService';
import { uploadArtistProfilePhoto } from '../../services/storageService';
import { getArtistProfile } from '../../utils/artistProfile';

interface CVViewProps {
  sections: CVSection[];
  settings: SiteSettings;
  isAdmin: boolean;
  onUpdateSections: (newSections: CVSection[]) => void;
  onUpdateSettings: (newSettings: SiteSettings) => void;
  onOpenAuthModal?: () => void;
}

interface CanonicalSectionMeta {
  id: string;
  category: CVCategory;
  number: string;
  titleEn: string;
  titleKo: string;
}

// Exactly ordered 6 sections as requested:
// 01 EDUCATION
// 02 SOLO EXHIBITIONS
// 03 GROUP EXHIBITIONS
// 04 AWARDS
// 05 COLLECTIONS
// 06 OTHER ACTIVITIES
const CANONICAL_CV_SECTIONS: CanonicalSectionMeta[] = [
  { id: 'education', category: 'education', number: '01', titleEn: 'EDUCATION', titleKo: '학력' },
  { id: 'soloExhibitions', category: 'soloExhibitions', number: '02', titleEn: 'SOLO EXHIBITIONS', titleKo: '개인전' },
  { id: 'groupExhibitions', category: 'groupExhibitions', number: '03', titleEn: 'GROUP EXHIBITIONS', titleKo: '단체전' },
  { id: 'awards', category: 'awards', number: '04', titleEn: 'AWARDS', titleKo: '수상 및 선정' },
  { id: 'collections', category: 'collections', number: '05', titleEn: 'COLLECTIONS', titleKo: '작품 소장' },
  { id: 'otherActivities', category: 'otherActivities', number: '06', titleEn: 'OTHER ACTIVITIES', titleKo: '기타 활동 및 레지던시' },
];

/**
 * Sorts CV items by:
 * 1) Year descending (newest first, e.g. 2026 before 2025)
 * 2) displayOrder ascending (1, 2, 3...)
 */
function sortCVItems(items: CVItem[]): CVItem[] {
  return [...items].sort((a, b) => {
    const matchA = a.year ? a.year.match(/\d{4}/) : null;
    const matchB = b.year ? b.year.match(/\d{4}/) : null;
    const yearA = matchA ? parseInt(matchA[0], 10) : 0;
    const yearB = matchB ? parseInt(matchB[0], 10) : 0;

    if (yearB !== yearA) {
      return yearB - yearA;
    }

    const orderA = a.displayOrder ?? a.order ?? 999;
    const orderB = b.displayOrder ?? b.order ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return (a.title || '').localeCompare(b.title || '');
  });
}

export const CVView: React.FC<CVViewProps> = ({
  sections,
  settings,
  isAdmin,
  onUpdateSections,
  onUpdateSettings,
  onOpenAuthModal,
}) => {
  const artist = getArtistProfile(settings);

  // Editing / Adding CV Item modal state
  const [editingItem, setEditingItem] = useState<{
    sectionId: string;
    item: CVItem;
    isNew: boolean;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Admin filter mode: all vs. submission-selected only
  const [submissionViewOnly, setSubmissionViewOnly] = useState(false);
  const [copiedSubmissionNotice, setCopiedSubmissionNotice] = useState(false);

  // Artist Photo Upload / Change Modal State
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Merge canonical 6 sections with current sections data
  const normalizedSections = useMemo(() => {
    return CANONICAL_CV_SECTIONS.map((canonical) => {
      // Find matching section in current state (support both 'otherActivities' and legacy 'activities')
      const matched = sections.find(
        (s) =>
          s.id === canonical.id ||
          s.category === canonical.category ||
          (canonical.id === 'otherActivities' && (s.id === 'activities' || s.category === 'activities'))
      );

      const items: CVItem[] = (matched?.items || []).map((it, idx) => ({
        ...it,
        id: it.id || `item-${canonical.id}-${idx}`,
        category: canonical.category,
        institution: it.institution || it.subtitle || '',
        subtitle: it.institution || it.subtitle || '',
        location: it.location || '',
        description: it.description || '',
        displayOrder: it.displayOrder ?? it.order ?? idx + 1,
        order: it.displayOrder ?? it.order ?? idx + 1,
        selected: it.selected ?? it.includeInPortfolio ?? true,
        includeInPortfolio: it.selected ?? it.includeInPortfolio ?? true,
        createdAt: it.createdAt || new Date().toISOString(),
        updatedAt: it.updatedAt || new Date().toISOString(),
      }));

      return {
        id: canonical.id,
        category: canonical.category,
        number: canonical.number,
        titleKo: canonical.titleKo,
        titleEn: canonical.titleEn,
        items,
        updatedAt: matched?.updatedAt || new Date().toISOString(),
      };
    });
  }, [sections]);

  // Total selected items count for submission
  const totalSelectedCount = useMemo(() => {
    return normalizedSections.reduce((acc, sec) => {
      return acc + sec.items.filter((it) => it.selected).length;
    }, 0);
  }, [normalizedSections]);

  const totalAllItemsCount = useMemo(() => {
    return normalizedSections.reduce((acc, sec) => acc + sec.items.length, 0);
  }, [normalizedSections]);

  // Toggle submission selection checkbox (Admin only)
  const handleToggleSelected = async (sectionId: string, itemId: string) => {
    if (!isAdmin) return;

    let targetSectionToPersist: CVSection | null = null;

    const updatedSections = normalizedSections.map((sec) => {
      if (sec.id === sectionId) {
        const updatedItems = sec.items.map((it) => {
          if (it.id === itemId) {
            const nextSelected = !it.selected;
            return {
              ...it,
              selected: nextSelected,
              includeInPortfolio: nextSelected,
              updatedAt: new Date().toISOString(),
            };
          }
          return it;
        });
        const updatedSec: CVSection = {
          id: sec.id,
          category: sec.category,
          titleKo: sec.titleKo,
          titleEn: sec.titleEn,
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        };
        targetSectionToPersist = updatedSec;
        return updatedSec;
      }
      return {
        id: sec.id,
        category: sec.category,
        titleKo: sec.titleKo,
        titleEn: sec.titleEn,
        items: sec.items,
        updatedAt: sec.updatedAt,
      };
    });

    onUpdateSections(updatedSections);

    if (targetSectionToPersist) {
      try {
        await saveCVSectionToFirestore(targetSectionToPersist);
      } catch (err) {
        console.error('[CV] Failed to toggle selected in Firestore:', err);
      }
    }
  };

  // Open modal to add new item
  const handleAddItem = (sectionId: string, category: CVCategory) => {
    if (!isAdmin) return;
    const targetSec = normalizedSections.find((s) => s.id === sectionId);
    const maxOrder = targetSec ? Math.max(0, ...targetSec.items.map((i) => i.displayOrder || 0)) : 0;

    const newItem: CVItem = {
      id: `cv-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category,
      year: `${new Date().getFullYear()}`,
      title: '',
      institution: '',
      subtitle: '',
      location: '서울, 한국',
      description: '',
      displayOrder: maxOrder + 1,
      order: maxOrder + 1,
      selected: true,
      includeInPortfolio: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEditingItem({
      sectionId,
      item: newItem,
      isNew: true,
    });
  };

  // Open modal to edit existing item
  const handleEditItem = (sectionId: string, item: CVItem) => {
    if (!isAdmin) return;
    setEditingItem({
      sectionId,
      item: { ...item },
      isNew: false,
    });
  };

  // Delete item
  const handleDeleteItem = async (sectionId: string, itemId: string) => {
    if (!isAdmin) return;
    if (!confirm('이 이력 항목을 삭제하시겠습니까?')) return;

    let targetSectionToPersist: CVSection | null = null;

    const updatedSections = normalizedSections.map((sec) => {
      if (sec.id === sectionId) {
        const filteredItems = sec.items.filter((it) => it.id !== itemId);
        const updatedSec: CVSection = {
          id: sec.id,
          category: sec.category,
          titleKo: sec.titleKo,
          titleEn: sec.titleEn,
          items: filteredItems,
          updatedAt: new Date().toISOString(),
        };
        targetSectionToPersist = updatedSec;
        return updatedSec;
      }
      return {
        id: sec.id,
        category: sec.category,
        titleKo: sec.titleKo,
        titleEn: sec.titleEn,
        items: sec.items,
        updatedAt: sec.updatedAt,
      };
    });

    onUpdateSections(updatedSections);

    if (targetSectionToPersist) {
      try {
        await saveCVSectionToFirestore(targetSectionToPersist);
        setSaveSuccessMsg('항목이 성공적으로 삭제되었습니다.');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      } catch (err) {
        console.error('[CV] Failed to delete item in Firestore:', err);
      }
    }
  };

  // Save item (New or Edit) to state & Firestore
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !isAdmin) return;

    setIsSaving(true);
    const { sectionId, item, isNew } = editingItem;
    const nowIso = new Date().toISOString();

    const normalizedItem: CVItem = {
      ...item,
      institution: item.institution || item.subtitle || '',
      subtitle: item.institution || item.subtitle || '',
      location: item.location || '',
      description: item.description || '',
      displayOrder: Number(item.displayOrder) || 1,
      order: Number(item.displayOrder) || 1,
      selected: Boolean(item.selected),
      includeInPortfolio: Boolean(item.selected),
      createdAt: item.createdAt || nowIso,
      updatedAt: nowIso,
    };

    let targetSectionToPersist: CVSection | null = null;

    const updatedSections = normalizedSections.map((sec) => {
      if (sec.id === sectionId) {
        let newItems: CVItem[];
        if (isNew) {
          newItems = [...sec.items, normalizedItem];
        } else {
          newItems = sec.items.map((it) => (it.id === normalizedItem.id ? normalizedItem : it));
        }
        const updatedSec: CVSection = {
          id: sec.id,
          category: sec.category,
          titleKo: sec.titleKo,
          titleEn: sec.titleEn,
          items: newItems,
          updatedAt: nowIso,
        };
        targetSectionToPersist = updatedSec;
        return updatedSec;
      }
      return {
        id: sec.id,
        category: sec.category,
        titleKo: sec.titleKo,
        titleEn: sec.titleEn,
        items: sec.items,
        updatedAt: sec.updatedAt,
      };
    });

    onUpdateSections(updatedSections);

    if (targetSectionToPersist) {
      try {
        await saveCVSectionToFirestore(targetSectionToPersist);
        setSaveSuccessMsg('Firestore에 성공적으로 저장되었습니다.');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      } catch (err) {
        console.error('[CV] Failed to save section in Firestore:', err);
      }
    }

    setIsSaving(false);
    setEditingItem(null);
  };

  // Copy submission CV as cleanly formatted text (Admin feature)
  const handleCopySubmissionText = () => {
    const lines: string[] = [
      `CURRICULUM VITAE · ARTIST DOSSIER (SUBMISSION PACKAGE)`,
      artist.formattedFull,
      artist.professionEn,
      `----------------------------------------`,
      '',
    ];

    normalizedSections.forEach((sec) => {
      const selectedItems = sortCVItems(sec.items.filter((it) => it.selected));
      if (selectedItems.length > 0) {
        lines.push(`${sec.number} ${sec.titleEn} (${sec.titleKo})`);
        selectedItems.forEach((it) => {
          const parts = [it.year, it.title];
          if (it.institution) parts.push(it.institution);
          if (it.location) parts.push(`[${it.location}]`);
          lines.push(`  • ${parts.join(' - ')}`);
          if (it.description) lines.push(`    ${it.description}`);
        });
        lines.push('');
      }
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedSubmissionNotice(true);
      setTimeout(() => setCopiedSubmissionNotice(false), 2500);
    });
  };

  // Handle Photo File Selection
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoUploadError('이미지 파일(JPG, PNG, WebP 등)만 선택할 수 있습니다.');
      return;
    }

    setPhotoUploadError(null);
    setSelectedPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
  };

  // Upload and Save Artist Photo to Firebase Storage: artist/profile & Firestore: siteSettings
  const handleSavePhoto = async () => {
    if (!selectedPhotoFile) {
      setPhotoUploadError('업로드할 사진 파일을 선택해 주세요.');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoUploadError(null);

    try {
      const storageUrl = await uploadArtistProfilePhoto(selectedPhotoFile);

      const updatedSettings: SiteSettings = {
        ...settings,
        artistPhotoUrl: storageUrl,
        updatedAt: new Date().toISOString(),
      };

      await saveSiteSettingsToFirestore(updatedSettings);
      onUpdateSettings(updatedSettings);

      setSaveSuccessMsg('작가 사진이 성공적으로 등록되었습니다.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);

      setIsPhotoModalOpen(false);
      setSelectedPhotoFile(null);
      setPhotoPreviewUrl(null);
    } catch (err: any) {
      console.error('[CV] Failed to upload artist photo:', err);
      setPhotoUploadError(err.message || '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Remove existing Artist Photo
  const handleRemovePhoto = async () => {
    if (!confirm('등록된 작가 사진을 삭제하시겠습니까?')) return;

    setIsUploadingPhoto(true);
    try {
      const updatedSettings: SiteSettings = {
        ...settings,
        artistPhotoUrl: '',
        updatedAt: new Date().toISOString(),
      };

      await saveSiteSettingsToFirestore(updatedSettings);
      onUpdateSettings(updatedSettings);

      setSaveSuccessMsg('작가 사진이 삭제되었습니다.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);

      setIsPhotoModalOpen(false);
      setSelectedPhotoFile(null);
      setPhotoPreviewUrl(null);
    } catch (err: any) {
      console.error('[CV] Failed to remove artist photo:', err);
      setPhotoUploadError(err.message || '사진 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div id="portfolio-cv-view" className="w-full py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ============================================================ */}
        {/* CV HEADER (Artist Title & Dossier & Portrait)                */}
        {/* ============================================================ */}
        <div className="border-b border-neutral-300 pb-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Title & Subtitle */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono-code tracking-[0.25em] uppercase text-neutral-400 block">
                CURRICULUM VITAE · ARTIST DOSSIER
              </span>
              <h1 className="font-serif-title text-3xl sm:text-4xl text-neutral-950 font-normal tracking-tight">
                {artist.englishName}
              </h1>
              <p className="text-xs text-neutral-500 font-light tracking-widest uppercase">
                {artist.formattedKoHanja} · CONTEMPORARY KOREAN PAINTER
              </p>

              {/* Admin Mode Action Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {isAdmin ? (
                  <>
                    {/* Artist Photo Upload / Change Button */}
                    <button
                      type="button"
                      id="cv-artist-photo-btn"
                      onClick={() => {
                        setSelectedPhotoFile(null);
                        setPhotoPreviewUrl(null);
                        setPhotoUploadError(null);
                        setIsPhotoModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded text-xs font-medium transition-colors cursor-pointer shadow-xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-neutral-600" />
                      <span>{settings.artistPhotoUrl ? '사진 변경' : '작가 사진 등록/변경'}</span>
                    </button>

                    {/* Submission CV Filter Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setSubmissionViewOnly(!submissionViewOnly)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer border ${
                        submissionViewOnly
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-300'
                      }`}
                      title="공모전 / 전시 제출용으로 선택된 항목만 필터링하여 확인합니다."
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>
                        {submissionViewOnly
                          ? `제출용 CV 보기 (${totalSelectedCount}개)`
                          : `전체 CV 보기 (${totalAllItemsCount}개)`}
                      </span>
                    </button>

                    {/* Copy Submission CV Button */}
                    {submissionViewOnly && (
                      <button
                        type="button"
                        onClick={handleCopySubmissionText}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs font-medium transition-colors cursor-pointer"
                        title="제출용으로 선택된 CV 내용을 서식화된 텍스트로 클립보드에 복사합니다."
                      >
                        <Copy className="w-3.5 h-3.5 text-neutral-600" />
                        <span>{copiedSubmissionNotice ? '복사 완료!' : '제출용 텍스트 복사'}</span>
                      </button>
                    )}

                    {/* Admin Status Pill */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>관리자 모드</span>
                    </span>
                  </>
                ) : (
                  onOpenAuthModal && (
                    <button
                      type="button"
                      onClick={onOpenAuthModal}
                      className="text-xs text-neutral-400 hover:text-neutral-700 underline font-light"
                    >
                      관리자 로그인
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Artist Photo: Only displayed if settings.artistPhotoUrl exists.
                If empty, the area is completely hidden with no empty boxes.
                Image proportions are preserved naturally with object-contain. */}
            {settings.artistPhotoUrl ? (
              <div
                id="cv-artist-portrait-container"
                className="shrink-0 flex flex-col items-start md:items-end"
              >
                <div className="relative group p-1.5 bg-white border border-neutral-200/90 rounded-xs shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                  <img
                    id="cv-artist-portrait-img"
                    src={settings.artistPhotoUrl}
                    alt={`${artist.englishName} (${artist.formattedKoHanja}) 작가 사진`}
                    className="w-28 sm:w-36 md:w-44 h-auto max-h-56 sm:max-h-64 object-contain rounded-xs bg-neutral-50"
                    referrerPolicy="no-referrer"
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhotoFile(null);
                        setPhotoPreviewUrl(null);
                        setPhotoUploadError(null);
                        setIsPhotoModalOpen(true);
                      }}
                      className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1.5 rounded-xs backdrop-blur-xs cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>사진 변경</span>
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-mono-code text-neutral-400 uppercase tracking-widest mt-1.5">
                  Artist Portrait
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded flex items-center gap-2 animate-in fade-in duration-200">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Submission Mode Banner */}
        {isAdmin && submissionViewOnly && (
          <div className="mb-8 p-3.5 bg-neutral-900 text-white rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>공모전 / 전시 제출용 CV 모드</strong>: 체크박스가 선택된 항목({totalSelectedCount}개)만 표시 중입니다.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSubmissionViewOnly(false)}
              className="text-xs text-neutral-300 hover:text-white underline self-start sm:self-auto cursor-pointer"
            >
              전체 CV로 복귀
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* 6 CV SECTIONS (Ordered 01 to 06)                              */}
        {/* 01 EDUCATION                                                 */}
        {/* 02 SOLO EXHIBITIONS                                          */}
        {/* 03 GROUP EXHIBITIONS                                         */}
        {/* 04 AWARDS                                                    */}
        {/* 05 COLLECTIONS                                               */}
        {/* 06 OTHER ACTIVITIES                                          */}
        {/* ============================================================ */}
        <div className="space-y-12 sm:space-y-14">
          {normalizedSections.map((section) => {
            // Sort items: year descending, displayOrder ascending
            const allSortedItems = sortCVItems(section.items);
            // In submission mode: only selected items
            const displayItems = submissionViewOnly
              ? allSortedItems.filter((it) => it.selected)
              : allSortedItems;

            // Empty section rule:
            // "데이터가 없는 섹션은 공개 페이지에서 빈 공간을 크게 만들지 말고 자연스럽게 생략하거나 최소 높이로 처리한다."
            if (!isAdmin && displayItems.length === 0) {
              return null; // Public visitors: naturally omit empty section completely
            }

            return (
              <section
                key={section.id}
                id={`cv-section-${section.id}`}
                className="space-y-4"
              >
                {/* Section Header */}
                <div className="flex items-baseline justify-between border-b border-neutral-300 pb-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xs font-mono-code tracking-[0.2em] text-neutral-400 font-medium">
                      {section.number}
                    </span>
                    <h2 className="text-sm sm:text-base font-serif-title font-medium text-neutral-900 tracking-wider uppercase">
                      {section.titleEn}
                    </h2>
                    <span className="text-xs text-neutral-400 font-light ml-1">
                      {section.titleKo}
                    </span>
                    {isAdmin && (
                      <span className="text-[11px] font-mono-code text-neutral-400 ml-2">
                        ({displayItems.length})
                      </span>
                    )}
                  </div>

                  {/* Admin: [+ 항목 추가] */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleAddItem(section.id, section.category)}
                      className="inline-flex items-center gap-1 text-xs text-neutral-700 hover:text-neutral-950 font-medium px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>추가</span>
                    </button>
                  )}
                </div>

                {/* Section Content */}
                {displayItems.length === 0 ? (
                  // In Admin mode: subtle minimal placeholder with add button
                  <div className="py-3 px-3 bg-neutral-50/70 border border-dashed border-neutral-200 rounded text-xs text-neutral-400 flex items-center justify-between">
                    <span>
                      {submissionViewOnly
                        ? '이 섹션에서 공모전 제출용으로 선택된 항목이 없습니다.'
                        : '등록된 이력 항목이 없습니다.'}
                    </span>
                    {isAdmin && !submissionViewOnly && (
                      <button
                        type="button"
                        onClick={() => handleAddItem(section.id, section.category)}
                        className="text-xs text-neutral-700 hover:text-neutral-950 underline font-medium cursor-pointer"
                      >
                        + 항목 추가하기
                      </button>
                    )}
                  </div>
                ) : (
                  // Editorial Typographical List
                  <div className="divide-y divide-neutral-100">
                    {displayItems.map((item) => (
                      <div
                        key={item.id}
                        id={`cv-item-${item.id}`}
                        className={`group py-3.5 transition-colors ${
                          isAdmin ? 'hover:bg-neutral-50/70 px-2 -mx-2 rounded-xs' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-6">
                          {/* Column 1: Year (fixed width, monospace, muted neutral) */}
                          <div className="w-20 sm:w-24 shrink-0 font-mono-code text-xs text-neutral-400 sm:pt-0.5 tracking-wider">
                            {item.year}
                          </div>

                          {/* Column 2: Title, Institution, Description */}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="text-sm sm:text-[14.5px] font-medium text-neutral-900 leading-snug">
                              {item.title}
                            </div>

                            {(item.institution || item.subtitle) && (
                              <div className="text-xs sm:text-[13px] text-neutral-600 font-light leading-relaxed">
                                {item.institution || item.subtitle}
                              </div>
                            )}

                            {item.description && (
                              <div className="text-xs text-neutral-500 font-light mt-1 leading-relaxed">
                                {item.description}
                              </div>
                            )}
                          </div>

                          {/* Column 3: Location & Admin-only Controls */}
                          <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 sm:pt-0.5">
                            {item.location && (
                              <span className="text-xs font-mono-code text-neutral-400 whitespace-nowrap">
                                {item.location}
                              </span>
                            )}

                            {/* Admin Controls: Checkbox, Edit, Delete (Visitors NEVER see this) */}
                            {isAdmin && (
                              <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-200">
                                {/* Submission Checkbox: □ 선택 / ☑ 선택됨 */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelected(section.id, item.id)}
                                  title={
                                    item.selected
                                      ? '제출용 CV에 포함됨 (클릭하여 제외)'
                                      : '제출용 CV에 포함되지 않음 (클릭하여 포함)'
                                  }
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-code transition-colors cursor-pointer ${
                                    item.selected
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium'
                                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 border border-transparent'
                                  }`}
                                >
                                  {item.selected ? (
                                    <>
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>선택됨</span>
                                    </>
                                  ) : (
                                    <>
                                      <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                      <span>선택</span>
                                    </>
                                  )}
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleEditItem(section.id, item)}
                                  className="p-1 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors cursor-pointer"
                                  title="수정"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(section.id, item.id)}
                                  className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* CV ITEM EDIT / ADD MODAL (Admin Only)                        */}
        {/* Contains all 8 fields:                                       */}
        {/* category, year, title, institution, location, description,   */}
        {/* displayOrder, selected                                       */}
        {/* ============================================================ */}
        {editingItem && (
          <div
            id="cv-item-modal"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-lg w-full p-6 space-y-4 text-xs animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div>
                  <span className="text-[10px] font-mono-code uppercase tracking-widest text-neutral-400 block mb-0.5">
                    Firestore · cv collection
                  </span>
                  <h3 className="text-sm sm:text-base font-serif-title font-medium text-neutral-900">
                    {editingItem.isNew ? 'CV 이력 항목 추가' : 'CV 이력 항목 수정'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="space-y-3.5">
                {/* 1. Category */}
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    카테고리 (Category) *
                  </label>
                  <select
                    value={editingItem.item.category}
                    onChange={(e) => {
                      const newCat = e.target.value as CVCategory;
                      const matchedCanonical = CANONICAL_CV_SECTIONS.find((c) => c.category === newCat);
                      setEditingItem({
                        ...editingItem,
                        sectionId: matchedCanonical?.id || editingItem.sectionId,
                        item: { ...editingItem.item, category: newCat },
                      });
                    }}
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 bg-white"
                  >
                    {CANONICAL_CV_SECTIONS.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.number} {c.titleEn} ({c.titleKo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 2. Year */}
                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      연도 (Year) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingItem.item.year}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          item: { ...editingItem.item, year: e.target.value },
                        })
                      }
                      placeholder="예: 2026 또는 2024–2026"
                      className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  {/* 3. Display Order */}
                  <div>
                    <label className="block text-neutral-700 font-medium mb-1">
                      정렬 순서 (displayOrder)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editingItem.item.displayOrder}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          item: {
                            ...editingItem.item,
                            displayOrder: parseInt(e.target.value, 10) || 1,
                            order: parseInt(e.target.value, 10) || 1,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded font-mono-code focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>

                {/* 4. Title */}
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    항목명 / 전시명 / 학위명 (Title) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.item.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        item: { ...editingItem.item, title: e.target.value },
                      })
                    }
                    placeholder="예: 헤테로토피아: 경계 너머의 장소"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
                  />
                </div>

                {/* 5. Institution */}
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    기관명 / 갤러리명 / 학교명 / 소장처 (Institution)
                  </label>
                  <input
                    type="text"
                    value={editingItem.item.institution || editingItem.item.subtitle || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        item: {
                          ...editingItem.item,
                          institution: e.target.value,
                          subtitle: e.target.value,
                        },
                      })
                    }
                    placeholder="예: 갤러리 이마주 (Gallery Imazoo) 또는 홍익대학교"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
                  />
                </div>

                {/* 6. Location */}
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    장소 / 도시 / 국가 (Location)
                  </label>
                  <input
                    type="text"
                    value={editingItem.item.location || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        item: { ...editingItem.item, location: e.target.value },
                      })
                    }
                    placeholder="예: 서울, 한국 또는 Tokyo, Japan"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
                  />
                </div>

                {/* 7. Description */}
                <div>
                  <label className="block text-neutral-700 font-medium mb-1">
                    세부 내용 / 설명 (Description)
                  </label>
                  <textarea
                    rows={2}
                    value={editingItem.item.description || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        item: { ...editingItem.item, description: e.target.value },
                      })
                    }
                    placeholder="추가 설명, 큐레이터 노트, 세부 수상 내역 등 (선택 사항)"
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900 resize-none"
                  />
                </div>

                {/* 8. Selected for Submission */}
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="modal-item-selected"
                    checked={editingItem.item.selected}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        item: {
                          ...editingItem.item,
                          selected: e.target.checked,
                          includeInPortfolio: e.target.checked,
                        },
                      })
                    }
                    className="mt-0.5 rounded border-neutral-300 cursor-pointer"
                  />
                  <label htmlFor="modal-item-selected" className="text-neutral-700 cursor-pointer leading-relaxed">
                    <span className="font-medium text-neutral-900 block">
                      공모전 / 전시 제출용 CV에 포함 (selected = true)
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      체크 시 향후 공모전 및 포트폴리오 패키지 제출용 CV 데이터로 추출됩니다.
                    </span>
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Firestore 저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ARTIST PHOTO UPLOAD / CHANGE MODAL (Admin Only)              */}
        {/* ============================================================ */}
        {isPhotoModalOpen && (
          <div
            id="artist-photo-modal"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded border border-neutral-300 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                <div>
                  <span className="text-[10px] font-mono-code uppercase tracking-[0.25em] text-neutral-400 block mb-1">
                    Firebase Storage · artist/profile
                  </span>
                  <h3 className="text-base font-serif-title text-neutral-950 font-normal">
                    {settings.artistPhotoUrl ? '작가 사진 변경' : '작가 사진 등록'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsPhotoModalOpen(false);
                    setSelectedPhotoFile(null);
                    setPhotoPreviewUrl(null);
                    setPhotoUploadError(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-700 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {photoUploadError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{photoUploadError}</span>
                </div>
              )}

              {/* Photo Preview & Drop Area */}
              <div className="space-y-4 text-xs">
                <div className="flex flex-col items-center justify-center">
                  {photoPreviewUrl || settings.artistPhotoUrl ? (
                    <div className="relative p-2 bg-neutral-50 border border-neutral-200 rounded text-center">
                      <img
                        src={photoPreviewUrl || settings.artistPhotoUrl}
                        alt="작가 사진 미리보기"
                        className="max-h-56 max-w-full h-auto object-contain rounded mx-auto"
                      />
                      <div className="text-[11px] text-neutral-400 mt-2 font-mono-code">
                        {photoPreviewUrl ? '새로 선택한 사진 (저장 대기 중)' : '현재 등록된 작가 사진'}
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-neutral-300 hover:border-neutral-500 rounded p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
                    >
                      <ImageIcon className="w-8 h-8 text-neutral-400" />
                      <span className="font-medium text-neutral-700">작가 사진 파일 선택</span>
                      <span className="text-[11px] text-neutral-400">JPG, PNG, WebP 등 이미지 파일</span>
                    </div>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />

                {/* Change File Button if preview exists */}
                {(photoPreviewUrl || settings.artistPhotoUrl) && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{selectedPhotoFile ? '다른 사진 선택' : '새 사진 파일 선택'}</span>
                    </button>
                    {settings.artistPhotoUrl && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={isUploadingPhoto}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>사진 삭제</span>
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-neutral-400 leading-relaxed text-center">
                  * 사진은 Firebase Storage의 <code className="font-mono font-medium text-neutral-600">artist/profile</code> 경로에 별도 보관되며, CV 페이지 상단에 왜곡 없이 표시됩니다.
                </p>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPhotoModalOpen(false);
                      setSelectedPhotoFile(null);
                      setPhotoPreviewUrl(null);
                      setPhotoUploadError(null);
                    }}
                    disabled={isUploadingPhoto}
                    className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 rounded bg-neutral-100 hover:bg-neutral-200 cursor-pointer"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePhoto}
                    disabled={!selectedPhotoFile || isUploadingPhoto}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-white bg-neutral-900 hover:bg-neutral-800 rounded font-medium disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Storage 저장 중...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>저장 및 업로드</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
