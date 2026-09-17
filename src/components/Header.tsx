import React from 'react';
import { Plus, Download, Grid, Table as TableIcon, Sparkles, Images, ShieldCheck, Lock } from 'lucide-react';
import { ViewMode, PortfolioMenu, SiteSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getArtistProfile } from '../utils/artistProfile';

interface HeaderProps {
  totalCount: number;
  featuredCount: number;
  viewMode: ViewMode;
  settings?: SiteSettings;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenCreateModal: () => void;
  onOpenBatchModal?: () => void;
  onOpenExportModal: () => void;
  onOpenAuthModal?: () => void;
  portfolioTab: PortfolioMenu;
  onSelectPortfolioTab: (tab: PortfolioMenu) => void;
}

const PORTFOLIO_MENU_ITEMS: { key: PortfolioMenu; label: string; subLabel: string; adminOnly?: boolean }[] = [
  { key: 'COVER', label: 'COVER', subLabel: '표지' },
  { key: 'CV', label: 'CV', subLabel: '작가 이력' },
  { key: 'ARTIST_NOTE', label: 'ARTIST NOTE', subLabel: '작가노트' },
  { key: 'WORKS_LIST', label: 'WORKS LIST', subLabel: '작품목록' },
  { key: 'WORKS', label: 'WORKS', subLabel: '작품 갤러리' },
  { key: 'CONTACT', label: 'CONTACT', subLabel: '연락처' },
  { key: 'SUBMISSION', label: 'SUBMISSION', subLabel: '공모전 제출', adminOnly: true },
];

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  featuredCount,
  viewMode,
  settings,
  onViewModeChange,
  onOpenCreateModal,
  onOpenBatchModal,
  onOpenExportModal,
  onOpenAuthModal,
  portfolioTab,
  onSelectPortfolioTab,
}) => {
  const { user, isAdmin } = useAuth();
  const artist = getArtistProfile(settings);

  return (
    <header className="border-b border-neutral-200/90 bg-[#FFFFFF]/98 backdrop-blur-xs sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Top Utility & Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo & Artist Title */}
          <div
            className="flex items-baseline gap-3 cursor-pointer group"
            onClick={() => onSelectPortfolioTab('COVER')}
            title="포트폴리오 표지로 이동"
          >
            <div>
              <span className="text-[10px] tracking-[0.28em] uppercase font-semibold text-neutral-400 block mb-0.5">
                FINE ART PORTFOLIO & ARCHIVE
              </span>
              <h1 className="text-xl sm:text-2xl font-serif-title font-medium tracking-tight text-neutral-900 flex items-center gap-2.5">
                <span>{artist.englishName}</span>
                <span className="text-[11px] font-sans font-normal px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                  {artist.formattedKoHanja}
                </span>
              </h1>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400 pl-4 border-l border-neutral-200 font-mono-code">
              <span>{totalCount} WORKS</span>
              <span>·</span>
              <span>{featuredCount} FEATURED</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* View Mode Switcher (Visible on WORKS / WORKS_LIST) */}
            {(portfolioTab === 'WORKS' || portfolioTab === 'WORKS_LIST') && (
              <div className="hidden md:flex items-center bg-neutral-100 p-0.5 rounded border border-neutral-200 mr-1">
                <button
                  type="button"
                  id="view-mode-grid-btn"
                  onClick={() => {
                    onViewModeChange('grid');
                    onSelectPortfolioTab('WORKS');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-all ${
                    portfolioTab === 'WORKS'
                      ? 'bg-white text-neutral-950 font-medium shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="작품 갤러리 (WORKS)"
                >
                  <Grid className="w-3 h-3" />
                  <span>갤러리</span>
                </button>
                <button
                  type="button"
                  id="view-mode-table-btn"
                  onClick={() => {
                    onViewModeChange('table');
                    onSelectPortfolioTab('WORKS_LIST');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-all ${
                    portfolioTab === 'WORKS_LIST'
                      ? 'bg-white text-neutral-950 font-medium shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  title="작품 목록 (WORKS LIST)"
                >
                  <TableIcon className="w-3 h-3" />
                  <span>목록표</span>
                </button>
              </div>
            )}

            {/* Firebase Admin Auth status button */}
            {onOpenAuthModal && (
              <button
                type="button"
                id="admin-auth-btn"
                onClick={onOpenAuthModal}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  isAdmin
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : user
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                }`}
                title={user ? `계정: ${user.email} (${isAdmin ? '관리자 승인됨' : '권한 확인 필요'})` : '작가 관리자 로그인'}
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">관리자</span>
                  </>
                ) : user ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline">계정</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="hidden sm:inline">관리자 로그인</span>
                    <span className="sm:hidden">로그인</span>
                  </>
                )}
              </button>
            )}

            {/* Export / Backup modal trigger */}
            <button
              type="button"
              id="export-backup-btn"
              onClick={onOpenExportModal}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded border border-neutral-200 transition-colors"
              title="데이터 백업 및 JSON/CSV 내보내기"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">백업/내보내기</span>
            </button>

            {/* Batch Photos Upload Button (Admin only) */}
            {isAdmin && onOpenBatchModal && (
              <button
                type="button"
                id="batch-upload-btn"
                onClick={onOpenBatchModal}
                className="hidden md:flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-200 transition-colors"
                title="여러 장의 회화 사진 파일을 한 번에 등록"
              >
                <Images className="w-3.5 h-3.5 text-neutral-600" />
                <span>사진 일괄 등록</span>
              </button>
            )}

            {/* Register New Artwork Button */}
            {isAdmin && (
              <button
                type="button"
                id="create-artwork-btn"
                onClick={onOpenCreateModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded shadow-xs transition-all active:scale-[0.99]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 작품 등록</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. Portfolio Main Menu Bar (COVER, CV, ARTIST NOTE, WORKS LIST, WORKS, CONTACT) */}
      <div className="border-t border-neutral-200/80 bg-[#FAF9F6]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            id="portfolio-main-nav"
            className="flex items-center justify-between sm:justify-center overflow-x-auto no-scrollbar py-2.5 sm:py-3 gap-1 sm:gap-6 md:gap-9"
            aria-label="포트폴리오 주 메뉴"
          >
            {PORTFOLIO_MENU_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
              const isActive = portfolioTab === item.key;
              const isSubmission = item.key === 'SUBMISSION';
              return (
                <button
                  key={item.key}
                  type="button"
                  id={`nav-item-${item.key.toLowerCase()}`}
                  onClick={() => onSelectPortfolioTab(item.key)}
                  className={`relative px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium tracking-[0.16em] uppercase transition-all whitespace-nowrap group ${
                    isActive
                      ? 'text-neutral-950 font-semibold'
                      : isSubmission
                      ? 'text-amber-700 hover:text-amber-900 font-semibold'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isSubmission && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />}
                    <span>{item.label}</span>
                  </span>
                  {isActive && (
                    <span className="absolute bottom-[-10px] left-1 right-1 h-[2px] bg-neutral-900 rounded-full" />
                  )}
                  {!isActive && (
                    <span className="absolute bottom-[-10px] left-1 right-1 h-[1px] bg-neutral-300 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-center" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
