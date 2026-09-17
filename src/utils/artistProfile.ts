import { SiteSettings } from '../types';

/**
 * PARK JIN SOO 작가 프로필 단일 진실 공급원 (Single Source of Truth)
 * 
 * 작가명: 박진수
 * 한자: 朴鎭洙 (가운데 한자는 반드시 「鎭」)
 * 영문: PARK JIN SOO
 */
export const DEFAULT_ARTIST_PROFILE = {
  koreanName: '박진수',
  hanjaName: '朴鎭洙', // 가운데 한자는 반드시 「鎭」
  englishName: 'PARK JIN SOO',
  professionEn: 'Contemporary Korean Painter',
  professionKo: '한국 현대미술 회화 작가',
} as const;

export interface ArtistProfile {
  koreanName: string;
  hanjaName: string;
  englishName: string;
  formattedKoHanja: string;    // "박진수 · 朴鎭洙"
  formattedFull: string;       // "PARK JIN SOO (박진수 · 朴鎭洙)"
  formattedBilingual: string;  // "PARK JIN SOO (박진수)"
  professionEn: string;
  professionKo: string;
}

/**
 * siteSettings 또는 null/undefined로부터 정규화된 작가명 프로필을 추출합니다.
 * 향후 siteSettings에서 작가명이 변경되면 전체 페이지에 즉시 일괄 반영됩니다.
 */
export function getArtistProfile(settings?: Partial<SiteSettings> | null): ArtistProfile {
  const koreanName = settings?.artistKoreanName?.trim() || DEFAULT_ARTIST_PROFILE.koreanName;
  // 한자명: 설정에 없거나 잘못된 한자가 들어있을 경우 기본값 '朴鎭洙' 보장
  let hanjaName = settings?.artistHanjaName?.trim() || DEFAULT_ARTIST_PROFILE.hanjaName;
  
  // 혹시라도 과거의 잘못된 한자(振, 秀 등)가 들어있는 경우 정규 한자 朴鎭洙로 자동 교정
  if (hanjaName.includes('振') || hanjaName.includes('秀') || hanjaName.includes('眞')) {
    hanjaName = DEFAULT_ARTIST_PROFILE.hanjaName;
  }

  const englishName = settings?.artistEnglishName?.trim() || DEFAULT_ARTIST_PROFILE.englishName;

  return {
    koreanName,
    hanjaName,
    englishName,
    formattedKoHanja: `${koreanName} · ${hanjaName}`,
    formattedFull: `${englishName} (${koreanName} · ${hanjaName})`,
    formattedBilingual: `${englishName} (${koreanName})`,
    professionEn: DEFAULT_ARTIST_PROFILE.professionEn,
    professionKo: DEFAULT_ARTIST_PROFILE.professionKo,
  };
}
