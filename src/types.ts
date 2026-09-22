export type MaterialType = 'Acrylic' | 'Oil' | 'Mixed';

export type MaterialCode = 'A' | 'O' | 'M';

export interface Artwork {
  id: string;
  code: string;               // e.g. "26030PA-01"
  title: string;              // 작품 제목
  canvasSizeCode: string;     // e.g. "030P", "100F", "050F"
  widthCm: number;            // 가로(cm)
  heightCm: number;           // 세로(cm)
  material: MaterialType;     // Material (Acrylic, Oil, Mixed)
  materialCode: MaterialCode; // A, O, M
  year: number;               // 제작연도 (e.g. 2026)
  description: string;        // 작품 설명 / 작가 노트
  displayOrder: number;       // Display Order
  isFeatured: boolean;        // Featured 여부
  imageUrl: string;           // 작품 이미지 (Data URL or Web URL)
  createdAt: string;          // ISO Timestamp (Supabase compatible)
  updatedAt: string;          // ISO Timestamp (Supabase compatible)
}

export interface CanvasStandardSize {
  code: string;       // e.g. "030P"
  number: number;     // e.g. 30
  type: 'F' | 'P' | 'M' | 'S'; // Figure, Paysage, Marine, Square
  typeName: string;   // 인물형(F), 풍경형(P), 해경형(M), 정방형(S)
  widthCm: number;    // 가로 cm
  heightCm: number;   // 세로 cm
}

export type ViewMode = 'grid' | 'table';

export type SortField = 'displayOrder' | 'yearDesc' | 'yearAsc' | 'code' | 'title';

export interface Exhibition {
  id: string;
  title: string;
  type: '개인전' | '단체전' | '아트페어';
  galleryName: string;
  location: string;
  startDate: string;
  endDate: string;
  curatorNote?: string;
  displayOrder: number;
  posterUrl?: string;
}

export interface Award {
  id: string;
  title: string;
  organization: string;
  year: number;
  description?: string;
  displayOrder: number;
}

export type PortfolioMenu = 'COVER' | 'CV' | 'ARTIST_NOTE' | 'WORKS_LIST' | 'WORKS' | 'BOARD' | 'CONTACT' | 'SUBMISSION';

export type CVCategory =
  | 'education'
  | 'soloExhibitions'
  | 'groupExhibitions'
  | 'awards'
  | 'collections'
  | 'otherActivities'
  | 'activities';

export interface CVItem {
  id: string;
  category: CVCategory;
  year: string;
  title: string;
  institution?: string;         // 기관명, 학교명, 갤러리명, 소장처
  subtitle?: string;            // 기존 subtitle 호환
  location?: string;            // 장소 (예: 서울, 한국)
  description?: string;         // 세부 설명, 추가 정보
  displayOrder: number;         // 정렬 순서
  order?: number;               // 기존 order 호환
  selected: boolean;            // 공모전 / 전시 제출용 CV 선택 여부
  includeInPortfolio?: boolean; // 기존 필드 호환
  createdAt?: string;
  updatedAt?: string;
}

export interface CVSection {
  id: string;
  category: CVCategory;
  titleKo: string;
  titleEn: string;
  items: CVItem[];
  updatedAt?: string;
}

export interface ArtistNoteItem {
  id: string; // 'note-a' | 'note-b'
  key: 'A' | 'B';
  title: string;
  titleEn?: string;
  writtenYear: number;
  content: string;
  contentKo?: string;
  contentEn?: string;
  isCustomEnglish?: boolean;
  critiqueAuthor?: string;
  updatedAt?: string;
}

export interface ArtworkCodeSettings {
  overallCounterOffset: number; // e.g. 14
  yearlyCounters: Record<number, number>; // e.g. { 2026: 5, 2025: 5, 2024: 5 }
}

export interface SiteSettings {
  id: string;
  artistKoreanName: string;       // 기본: '박진수'
  artistHanjaName?: string;       // 기본: '朴鎭洙' (가운데 한자 반드시 「鎭」)
  artistEnglishName: string;      // 기본: 'PARK JIN SOO'
  artistPhotoUrl?: string;        // 작가 사진 URL (Firebase Storage: artist/profile)
  contactEmail: string;
  inquiryRecipientEmail?: string; // 문의 수신 이메일 (기본: jinsoop10@gmail.com)
  websiteUrl?: string;
  instagramUrl?: string;
  otherContact?: string;
  coverArtworkId?: string;
  portfolioStatement?: string;    // 포트폴리오 Cover Statement 문구
  selectedArtistNoteKey: 'A' | 'B';
  codeSettings?: ArtworkCodeSettings;
  updatedAt?: string;
}

export interface SubmissionPackage {
  id: string;
  title: string;                 // e.g. "2026 개인전 공모", "2026 갤러리 A 제출"
  targetOrganization?: string;   // 대상 기관 / 갤러리명
  submissionDeadline?: string;   // 제출 마감일
  selectedArtworkIds: string[];  // 선택된 작품 ID 목록 (제출 순서대로)
  selectedCvIds?: string[];      // 선택된 CV 항목 ID 목록 (기존 CV의 selected=true 항목 연동)
  selectedArtistNoteId?: string; // 선택된 작가노트 ID ('note-a' | 'note-b' 등)
  coverArtworkId?: string;       // 표지 대표작품 ID
  memo?: string;                 // 비고 및 메모
  createdAt: string;
  updatedAt?: string;
}

export type Submission = SubmissionPackage;

export type MigrationStepStatus = 'idle' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface MigrationProgressItem {
  id: string;
  code: string;
  title: string;
  currentStep: string;
  status: MigrationStepStatus;
  storageUrl?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  failedStage?: 'Storage' | 'Firestore';
}

export type BoardPostStatus = 'pending' | 'published' | 'rejected';

export interface BoardPost {
  id: string;
  title: string;
  content: string;
  coverImage?: string;
  imageUrls: string[];
  videoUrls: string[];
  createdAt: string;
  updatedAt: string;
  status: BoardPostStatus;
  authorName: string;
  isAdminPost: boolean;
}


