import React from 'react';
import { PortfolioMenu } from '../../types';

interface PortfolioNavProps {
  currentTab: PortfolioMenu;
  onSelectTab: (tab: PortfolioMenu) => void;
  isAdmin?: boolean;
}

const BASE_MENU_ITEMS: { key: PortfolioMenu; label: string; subLabel: string }[] = [
  { key: 'COVER', label: 'COVER', subLabel: '표지' },
  { key: 'CV', label: 'CV', subLabel: '작가 이력' },
  { key: 'ARTIST_NOTE', label: 'ARTIST NOTE', subLabel: '작가노트' },
  { key: 'WORKS_LIST', label: 'WORKS LIST', subLabel: '작품목록' },
  { key: 'WORKS', label: 'WORKS', subLabel: '작품 갤러리' },
  { key: 'CONTACT', label: 'CONTACT', subLabel: '연락처' },
];

export const PortfolioNav: React.FC<PortfolioNavProps> = ({ currentTab, onSelectTab, isAdmin }) => {
  const menuItems = isAdmin
    ? [...BASE_MENU_ITEMS, { key: 'SUBMISSION' as PortfolioMenu, label: 'SUBMISSION', subLabel: '공모전 제출' }]
    : BASE_MENU_ITEMS;

  return (
    <nav
      id="portfolio-main-nav"
      className="border-b border-neutral-200/80 bg-white/95 backdrop-blur-xs sticky top-0 z-20"
      aria-label="포트폴리오 주 메뉴"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between sm:justify-center overflow-x-auto no-scrollbar py-3.5 gap-1 sm:gap-6 md:gap-10">
          {menuItems.map((item) => {
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                id={`portfolio-nav-${item.key.toLowerCase()}`}
                onClick={() => onSelectTab(item.key)}
                className={`relative px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium tracking-[0.16em] uppercase transition-all whitespace-nowrap group ${
                  isActive
                    ? 'text-neutral-950 font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-neutral-900 rounded-full transition-all"
                    layoutId="portfolioActiveTabIndicator"
                  />
                )}
                {!isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[1px] bg-neutral-300 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-center" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
