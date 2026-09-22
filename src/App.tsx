import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ArtworkDetailModal } from './components/ArtworkDetailModal';
import { ArtworkFormModal } from './components/ArtworkFormModal';
import { ExportImportModal } from './components/ExportImportModal';
import { BatchUploadModal } from './components/BatchUploadModal';
import { AdminLoginModal } from './components/AdminLoginModal';

// Portfolio Section Components
import { CoverView } from './components/portfolio/CoverView';
import { CVView } from './components/portfolio/CVView';
import { ArtistNoteView } from './components/portfolio/ArtistNoteView';
import { WorksListView } from './components/portfolio/WorksListView';
import { WorksGalleryView } from './components/portfolio/WorksGalleryView';
import { ContactView } from './components/portfolio/ContactView';
import { SubmissionView } from './components/portfolio/SubmissionView';

import {
  Artwork,
  MaterialType,
  SortField,
  ViewMode,
  PortfolioMenu,
  CVSection,
  ArtistNoteItem,
  SiteSettings,
} from './types';
import {
  loadArtworksFromStorage,
  loadArtworksFromIndexedDB,
  saveArtworksToStorage,
} from './utils/storage';

import {
  getArtworksFromFirestore,
  saveArtworkToFirestore,
  deleteArtworkFromFirestore,
  getCVSectionsFromFirestore,
  getArtistNotesFromFirestore,
  getSiteSettingsFromFirestore,
} from './services/firestoreService';
import { uploadBase64ToStorage, isFirebaseStorageUrl } from './services/storageService';
import {
  DEFAULT_CV_SECTIONS,
  DEFAULT_ARTIST_NOTES,
  DEFAULT_SITE_SETTINGS,
} from './data/defaultPortfolioData';
import { getArtistProfile } from './utils/artistProfile';

import { Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user, isAdmin } = useAuth();

  // Portfolio Navigation State: COVER | CV | ARTIST NOTE | WORKS LIST | WORKS | CONTACT | SUBMISSION
  const [portfolioTab, setPortfolioTab] = useState<PortfolioMenu>('COVER');

  // Guard SUBMISSION tab: non-admin cannot navigate to SUBMISSION
  useEffect(() => {
    if (portfolioTab === 'SUBMISSION' && !isAdmin) {
      setPortfolioTab('COVER');
    }
  }, [portfolioTab, isAdmin]);

  // Database State - Starts empty until primary Firestore hydration finishes (preserves 13 artworks)
  const [artworks, setArtworks] = useState<Artwork[]>(() => loadArtworksFromStorage());
  const [isHydrated, setIsHydrated] = useState(false);

  // Portfolio Content States (CV, Artist Notes, Contact & Site Settings)
  const [cvSections, setCvSections] = useState<CVSection[]>(DEFAULT_CV_SECTIONS);
  const [artistNotes, setArtistNotes] = useState<ArtistNoteItem[]>(DEFAULT_ARTIST_NOTES);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const cached = localStorage.getItem('PARK_JINSOO_SITE_SETTINGS_V1');
      if (cached) {
        return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_SETTINGS;
  });

  const artist = getArtistProfile(siteSettings);

  // Sync document title with centralized artist profile
  useEffect(() => {
    document.title = `${artist.englishName} (${artist.formattedKoHanja}) · Contemporary Korean Painter`;
  }, [artist.englishName, artist.formattedKoHanja]);

  // View Controls for Gallery vs List
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter & Search State (for Works Gallery & List)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType | 'ALL'>('ALL');
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>('ALL');
  const [isFeaturedOnly, setIsFeaturedOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('displayOrder');

  // Modals State
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [artworkToEdit, setArtworkToEdit] = useState<Artwork | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initial Data Loading:
  // 1. Read Firestore artworks collection (Primary Source: 13 artworks)
  // 2. Read Firestore cv, artistNotes, and siteSettings collections
  // 3. Fallback to existing IndexedDB only if Firestore read fails or is empty
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      let loadedFromFirestore = false;

      try {
        console.log('[App] Loading artworks and portfolio data from Firebase Firestore (Primary Source)...');

        // Fetch artworks, CV sections, artist notes, and settings in parallel
        const [firestoreList, cvList, notesList, settingsData] = await Promise.all([
          getArtworksFromFirestore(),
          getCVSectionsFromFirestore().catch((err) => {
            console.warn('[App] CV read notice:', err);
            return null;
          }),
          getArtistNotesFromFirestore().catch((err) => {
            console.warn('[App] Artist Notes read notice:', err);
            return null;
          }),
          getSiteSettingsFromFirestore().catch((err) => {
            console.warn('[App] Settings read notice:', err);
            return null;
          }),
        ]);

        if (!isMounted) return;

        if (cvList && cvList.length > 0) {
          setCvSections(cvList);
        }
        if (notesList && notesList.length > 0) {
          setArtistNotes(notesList);
        }
        if (settingsData) {
          setSiteSettings((prev) => {
            const merged: SiteSettings = {
              ...DEFAULT_SITE_SETTINGS,
              ...prev,
              ...settingsData,
              artistKoreanName: settingsData.artistKoreanName || prev.artistKoreanName || DEFAULT_SITE_SETTINGS.artistKoreanName,
              artistHanjaName: settingsData.artistHanjaName || prev.artistHanjaName || DEFAULT_SITE_SETTINGS.artistHanjaName,
              artistEnglishName: settingsData.artistEnglishName || prev.artistEnglishName || DEFAULT_SITE_SETTINGS.artistEnglishName,
              portfolioStatement: settingsData.portfolioStatement || prev.portfolioStatement || DEFAULT_SITE_SETTINGS.portfolioStatement,
            };
            try {
              localStorage.setItem('PARK_JINSOO_SITE_SETTINGS_V1', JSON.stringify(merged));
            } catch {
              // ignore
            }
            return merged;
          });
        }

        if (firestoreList && firestoreList.length > 0) {
          setArtworks(firestoreList);
          setIsHydrated(true);
          loadedFromFirestore = true;
          console.log(
            `[App] Successfully loaded ${firestoreList.length} artworks from Firestore. First 3:`,
            firestoreList.slice(0, 3)
          );

          // Log inspection report to server log endpoint (read-only audit)
          fetch('/api/indexeddb/log-inspection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'Firebase Firestore: artworks collection (Primary)',
              totalCount: firestoreList.length,
              artworks: firestoreList.slice(0, 5).map(({ id, code, title, canvasSizeCode, material, year, imageUrl }) => ({
                id,
                code,
                title,
                canvasSizeCode,
                material,
                year,
                isStorageUrl: isFirebaseStorageUrl(imageUrl),
              })),
            }),
          }).catch(() => {});

          return;
        } else {
          console.warn('[App] Firestore returned 0 artworks. Checking IndexedDB fallback...');
        }
      } catch (err: any) {
        console.error('[App] Failed to load artworks from Firestore. Firebase error:', {
          code: err?.code || 'FIRESTORE_READ_ERROR',
          message: err?.message || String(err),
        });
      }

      // Fallback: Read from existing IndexedDB only if Firestore failed or was empty
      if (!loadedFromFirestore) {
        try {
          const stored = await loadArtworksFromIndexedDB();
          if (!isMounted) return;
          if (stored && stored.length > 0) {
            setArtworks(stored);
            console.log(`[App] Fallback: Hydrated ${stored.length} artworks from IndexedDB.`);
          }
        } catch (idbErr) {
          console.error('[App] IndexedDB fallback load error:', idbErr);
        } finally {
          if (isMounted) {
            setIsHydrated(true);
          }
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to local persistent cache for offline resilience (after initial hydration)
  useEffect(() => {
    if (!isHydrated) return;
    saveArtworksToStorage(artworks);
  }, [artworks, isHydrated]);

  // Available Years list sorted descending
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    artworks.forEach((a) => {
      if (a.year) yearsSet.add(a.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [artworks]);

  // Filtered & Sorted Artworks for Works Gallery and Works List
  const filteredArtworks = useMemo(() => {
    return artworks
      .filter((art) => {
        // Material filter
        if (selectedMaterial !== 'ALL' && art.material !== selectedMaterial) {
          return false;
        }

        // Year filter
        if (selectedYear !== 'ALL' && art.year !== selectedYear) {
          return false;
        }

        // Featured filter
        if (isFeaturedOnly && !art.isFeatured) {
          return false;
        }

        // Search query
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = art.title.toLowerCase().includes(q);
          const matchCode = art.code.toLowerCase().includes(q);
          const matchCanvasCode = art.canvasSizeCode.toLowerCase().includes(q);
          const matchMaterial = art.material.toLowerCase().includes(q);
          const matchYear = String(art.year).includes(q);
          const matchDesc = art.description ? art.description.toLowerCase().includes(q) : false;

          if (!matchTitle && !matchCode && !matchCanvasCode && !matchMaterial && !matchYear && !matchDesc) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortField) {
          case 'displayOrder':
            return (a.displayOrder || 0) - (b.displayOrder || 0);
          case 'yearDesc':
            return b.year - a.year;
          case 'yearAsc':
            return a.year - b.year;
          case 'code':
            return a.code.localeCompare(b.code, undefined, { numeric: true });
          case 'title':
            return a.title.localeCompare(b.title, 'ko');
          default:
            return 0;
        }
      });
  }, [artworks, selectedMaterial, selectedYear, isFeaturedOnly, searchQuery, sortField]);

  // Sorted artworks strictly by displayOrder (used for canonical navigation: ← PREVIOUS / NEXT →)
  const orderedArtworks = useMemo(() => {
    return [...artworks].sort((a, b) => {
      const orderA =
        a.displayOrder !== undefined && a.displayOrder !== null
          ? a.displayOrder
          : 999999;
      const orderB =
        b.displayOrder !== undefined && b.displayOrder !== null
          ? b.displayOrder
          : 999999;
      if (orderA !== orderB) return orderA - orderB;
      if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [artworks]);

  // Current selected artwork index for Prev/Next navigation in A4 Landscape Dossier
  const currentDetailIndex = useMemo(() => {
    if (!selectedArtwork) return -1;
    return orderedArtworks.findIndex((a) => a.id === selectedArtwork.id);
  }, [selectedArtwork, orderedArtworks]);

  const handleNavigatePrev = () => {
    if (currentDetailIndex > 0) {
      setSelectedArtwork(orderedArtworks[currentDetailIndex - 1]);
    }
  };

  const handleNavigateNext = () => {
    if (currentDetailIndex >= 0 && currentDetailIndex < orderedArtworks.length - 1) {
      setSelectedArtwork(orderedArtworks[currentDetailIndex + 1]);
    }
  };

  // CRUD Operations (Admin only)
  const handleOpenCreateModal = () => {
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
    setArtworkToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (art: Artwork, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }
    setArtworkToEdit(art);
    setIsFormModalOpen(true);
  };

  const handleSaveArtwork = async (
    artworkData: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string
  ) => {
    try {
      let finalImageUrl = artworkData.imageUrl;

      // If user uploaded a new local base64/data image, upload to Firebase Storage
      if (artworkData.imageUrl && artworkData.imageUrl.startsWith('data:image/')) {
        try {
          const uploadedUrl = await uploadBase64ToStorage(
            artworkData.imageUrl,
            artworkData.code || 'artwork'
          );
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
          }
        } catch (storageErr) {
          console.warn('[App] Firebase Storage upload skipped, using current image URL:', storageErr);
        }
      }

      const completeArtwork: Artwork = {
        ...artworkData,
        imageUrl: finalImageUrl,
        id: editId || (artworkToEdit ? artworkToEdit.id : `art-${Date.now()}`),
        createdAt: artworkToEdit ? artworkToEdit.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save directly to Firebase Firestore
      await saveArtworkToFirestore(completeArtwork);

      // 2. Update local state
      setArtworks((prev) => {
        if (editId) {
          return prev.map((item) => (item.id === editId ? completeArtwork : item));
        } else {
          return [completeArtwork, ...prev];
        }
      });

      setIsFormModalOpen(false);
      setArtworkToEdit(null);
    } catch (err: any) {
      console.error('[App] Failed to save artwork to Firestore:', err);
      alert(`작품 저장 중 오류가 발생했습니다: ${err.message || err}`);
    }
  };

  const handleDeleteArtwork = async (artwork: Artwork) => {
    if (!isAdmin) {
      setIsAuthModalOpen(true);
      return;
    }

    if (window.confirm(`"${artwork.title}" (${artwork.code}) 작품을 삭제하시겠습니까?`)) {
      try {
        await deleteArtworkFromFirestore(artwork.id);
        setArtworks((prev) => prev.filter((item) => item.id !== artwork.id));
        if (selectedArtwork && selectedArtwork.id === artwork.id) {
          setSelectedArtwork(null);
        }
      } catch (err: any) {
        console.error('[App] Failed to delete artwork from Firestore:', err);
        alert(`작품 삭제 중 오류가 발생했습니다: ${err.message || err}`);
      }
    }
  };

  const handleBatchAddArtworks = async (newArtworks: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      const createdList: Artwork[] = [];
      const timestamp = new Date().toISOString();

      for (let i = 0; i < newArtworks.length; i++) {
        const item = newArtworks[i];
        let finalImageUrl = item.imageUrl;

        if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
          try {
            const uploadedUrl = await uploadBase64ToStorage(item.imageUrl, item.code || `batch-${i}`);
            if (uploadedUrl) finalImageUrl = uploadedUrl;
          } catch (storageErr) {
            console.warn('[App] Batch Storage upload skipped:', storageErr);
          }
        }

        const completeItem: Artwork = {
          ...item,
          imageUrl: finalImageUrl,
          id: `art-${Date.now()}-${i}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        await saveArtworkToFirestore(completeItem);
        createdList.push(completeItem);
      }

      setArtworks((prev) => [...createdList, ...prev]);
      setIsBatchModalOpen(false);
    } catch (err: any) {
      console.error('[App] Batch upload error:', err);
      alert(`일괄 등록 중 오류가 발생했습니다: ${err.message || err}`);
    }
  };

  const handleImportArtworks = (imported: Artwork[]) => {
    setArtworks(imported);
    setIsExportModalOpen(false);
  };

  const handleResetToDefault = () => {
    // Preserves existing 13 artworks from Firestore by re-fetching
    getArtworksFromFirestore().then((freshList) => {
      if (freshList && freshList.length > 0) {
        setArtworks(freshList);
      }
    });
    setIsExportModalOpen(false);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedMaterial('ALL');
    setSelectedYear('ALL');
    setIsFeaturedOnly(false);
    setSortField('displayOrder');
  };

  const featuredCount = useMemo(() => artworks.filter((a) => a.isFeatured).length, [artworks]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-neutral-900 font-sans">
      {/* 1. Header with Title & Top-level Portfolio Menu Navigation */}
      <Header
        totalCount={artworks.length}
        featuredCount={featuredCount}
        viewMode={viewMode}
        settings={siteSettings}
        onViewModeChange={setViewMode}
        onOpenCreateModal={handleOpenCreateModal}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        portfolioTab={portfolioTab}
        onSelectPortfolioTab={setPortfolioTab}
      />

      {/* 2. Loading state banner if still hydrating from Firestore */}
      {!isHydrated && (
        <div className="py-24 text-center max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-600 animate-spin">
            <Loader2 className="w-5 h-5 stroke-[2]" />
          </div>
          <h3 className="text-sm font-medium text-neutral-800 mb-1">
            {artist.englishName} ({artist.formattedKoHanja}) 포트폴리오 불러오는 중...
          </h3>
          <p className="text-xs text-neutral-400">
            Firebase Firestore에서 13점의 작품 및 포트폴리오 데이터를 불러오고 있습니다.
          </p>
        </div>
      )}

      {/* 3. Portfolio Views Switcher */}
      {isHydrated && (
        <div className="flex-1 flex flex-col">
          {/* 3-1. COVER View */}
          {portfolioTab === 'COVER' && (
            <CoverView
              artworks={artworks}
              settings={siteSettings}
              isAdmin={isAdmin}
              onNavigate={setPortfolioTab}
              onSelectArtwork={setSelectedArtwork}
              onUpdateSettings={(newSettings) => {
                setSiteSettings(newSettings);
                try {
                  localStorage.setItem('PARK_JINSOO_SITE_SETTINGS_V1', JSON.stringify(newSettings));
                } catch {
                  // ignore
                }
              }}
            />
          )}

          {/* 3-2. CV View */}
          {portfolioTab === 'CV' && (
            <CVView
              sections={cvSections}
              settings={siteSettings}
              isAdmin={isAdmin}
              onUpdateSections={setCvSections}
              onUpdateSettings={setSiteSettings}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {/* 3-3. ARTIST NOTE View */}
          {portfolioTab === 'ARTIST_NOTE' && (
            <ArtistNoteView
              notes={artistNotes}
              settings={siteSettings}
              isAdmin={isAdmin}
              onUpdateNotes={setArtistNotes}
              onUpdateSettings={setSiteSettings}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {/* 3-4. WORKS LIST View */}
          {portfolioTab === 'WORKS_LIST' && (
            <WorksListView
              artworks={artworks}
              settings={siteSettings}
              onSelectArtwork={setSelectedArtwork}
              isAdmin={isAdmin}
              onEditArtwork={handleOpenEditModal}
              onDeleteArtwork={handleDeleteArtwork}
            />
          )}

          {/* 3-5. WORKS Gallery View */}
          {portfolioTab === 'WORKS' && (
            <div>
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedMaterial={selectedMaterial}
                onMaterialChange={setSelectedMaterial}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                availableYears={availableYears}
                isFeaturedOnly={isFeaturedOnly}
                onToggleFeaturedOnly={() => setIsFeaturedOnly((prev) => !prev)}
                sortField={sortField}
                onSortChange={setSortField}
                totalFiltered={filteredArtworks.length}
                totalAll={artworks.length}
                onResetFilters={handleResetFilters}
              />
              <WorksGalleryView
                artworks={filteredArtworks}
                settings={siteSettings}
                onSelectArtwork={setSelectedArtwork}
                isAdmin={isAdmin}
                onEditArtwork={handleOpenEditModal}
              />
            </div>
          )}

          {/* 3-6. CONTACT View */}
          {portfolioTab === 'CONTACT' && (
            <ContactView
              settings={siteSettings}
              isAdmin={isAdmin}
              onUpdateSettings={setSiteSettings}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {/* 3-7. SUBMISSION View (Admin Only) */}
          {portfolioTab === 'SUBMISSION' && (
            <SubmissionView
              artworks={artworks}
              cvSections={cvSections}
              artistNotes={artistNotes}
              settings={siteSettings}
              isAdmin={isAdmin}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}
        </div>
      )}

      {/* 4. Minimalist Portfolio Footer */}
      <footer className="border-t border-neutral-200/80 bg-white py-6 text-xs text-neutral-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-serif-title text-neutral-800 font-medium tracking-tight">
              {artist.englishName}
            </span>
            <span>·</span>
            <span className="font-sans text-neutral-600">{artist.formattedKoHanja}</span>
            <span>·</span>
            <span>Contemporary Fine Art Portfolio</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-400">
            <span>보유 작품: {artworks.length}점</span>
            <span>·</span>
            <span className="font-mono-code">Rule: YYSSSM-00,000</span>
            {isAdmin && <span className="text-emerald-600 font-medium">관리자 모드 활성</span>}
          </div>
        </div>
      </footer>

      {/* 5. Artwork Detail Modal (A4 Landscape Dossier: Strict info order) */}
      <ArtworkDetailModal
        artwork={selectedArtwork}
        settings={siteSettings}
        isAdmin={isAdmin}
        onClose={() => setSelectedArtwork(null)}
        onEdit={(art) => {
          setSelectedArtwork(null);
          handleOpenEditModal(art);
        }}
        onDelete={(art) => handleDeleteArtwork(art)}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        hasPrev={currentDetailIndex > 0}
        hasNext={currentDetailIndex >= 0 && currentDetailIndex < orderedArtworks.length - 1}
        currentIndex={currentDetailIndex}
        totalCount={orderedArtworks.length}
      />

      {/* 6. Artwork Form Modal (Register & Edit with new YYSSSM-00,000 code generation) */}
      <ArtworkFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setArtworkToEdit(null);
        }}
        onSave={handleSaveArtwork}
        artworkToEdit={artworkToEdit}
        existingArtworks={artworks}
        onOpenBatchUpload={() => setIsBatchModalOpen(true)}
        codeSettings={siteSettings.codeSettings}
      />

      {/* 7. Batch Upload Modal */}
      <BatchUploadModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        existingArtworks={artworks}
        onBatchAdd={handleBatchAddArtworks}
      />

      {/* 8. Export / Backup Modal */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        artworks={artworks}
        onImportArtworks={handleImportArtworks}
        onResetToDefault={handleResetToDefault}
      />

      {/* 9. Firebase Admin Auth Modal */}
      <AdminLoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
