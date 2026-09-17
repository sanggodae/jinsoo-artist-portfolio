import React, { useRef, useState } from 'react';
import {
  X,
  FileJson,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Clipboard,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Database,
  Loader2,
} from 'lucide-react';
import { Artwork, MigrationProgressItem, MigrationStepStatus } from '../types';
import { exportArtworksToJSON, exportArtworksToCSV } from '../utils/storage';
import { INITIAL_ARTWORKS } from '../data/initialArtworks';
import { parseArtworkString } from '../utils/artworkParser';
import { parseArtworkCSV } from '../utils/csvParser';
import { materialToCode } from '../utils/codeGenerator';
import { MigrationProgressView } from './MigrationProgressView';
import { useAuth } from '../contexts/AuthContext';
import {
  migrateBackupArtworksToFirebase,
  testSmallFirestoreConnection,
  FirestoreConnectionTestResult,
} from '../services/firestoreService';
import { runStorageConnectionTest } from '../services/storageService';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artworks: Artwork[];
  onImportArtworks: (imported: Artwork[]) => void;
  onResetToDefault: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  artworks,
  onImportArtworks,
  onResetToDefault,
}) => {
  const { isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [isPastingCSV, setIsPastingCSV] = useState(false);
  const [pastedCSVText, setPastedCSVText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [showResetConfirmInput, setShowResetConfirmInput] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showMigrationPreview, setShowMigrationPreview] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationItems, setMigrationItems] = useState<MigrationProgressItem[]>([]);
  const [migrationCurrentIndex, setMigrationCurrentIndex] = useState(0);
  const [migrationTotalCount, setMigrationTotalCount] = useState(0);
  const [migrationStatusMessage, setMigrationStatusMessage] = useState<string>('');
  const [migrationFinalResult, setMigrationFinalResult] = useState<{
    visible: boolean;
    migrated: number;
    failed: number;
    total: number;
    failedItems: Array<{
      code: string;
      stage: string;
      errorCode: string;
      errorMessage: string;
    }>;
  } | null>(null);
  const [isTestingStorage, setIsTestingStorage] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState<{
    status: 'idle' | 'running' | 'success' | 'failed';
    errorCode?: string;
    errorMessage?: string;
  }>({ status: 'idle' });

  // Dedicated Firestore Single-Document Connection Test
  const [isTestingFirestore, setIsTestingFirestore] = useState(false);
  const [firestoreTestResult, setFirestoreTestResult] = useState<{
    status: 'idle' | 'running' | 'success' | 'failed';
    message?: string;
    errorCode?: string;
    errorMessage?: string;
    timestamp?: string | number;
    docPath?: string;
  }>({ status: 'idle' });

  const handleTestFirestoreConnection = async () => {
    setIsTestingFirestore(true);
    setFirestoreTestResult({ status: 'running' });
    try {
      const res: FirestoreConnectionTestResult = await testSmallFirestoreConnection();
      if (res.success) {
        setFirestoreTestResult({
          status: 'success',
          message: 'Firestore 연결 성공',
          timestamp: res.timestamp,
          docPath: res.docPath,
        });
      } else {
        setFirestoreTestResult({
          status: 'failed',
          message: 'Firestore 연결 실패',
          errorCode: res.errorCode || 'UNKNOWN_ERROR',
          errorMessage: res.errorMessage || 'Firestore 저장에 실패했습니다.',
          timestamp: res.timestamp,
          docPath: res.docPath,
        });
      }
    } catch (err: any) {
      setFirestoreTestResult({
        status: 'failed',
        message: 'Firestore 연결 실패',
        errorCode: err?.code || 'UNEXPECTED_ERROR',
        errorMessage: err?.message || String(err),
      });
    } finally {
      setIsTestingFirestore(false);
    }
  };

  const handleTestStorageConnection = async () => {
    setIsTestingStorage(true);
    setStorageTestResult({ status: 'running' });
    try {
      const res = await runStorageConnectionTest();
      if (res.success) {
        setStorageTestResult({
          status: 'success',
        });
      } else {
        setStorageTestResult({
          status: 'failed',
          errorCode: res.errorCode || 'UNKNOWN_ERROR',
          errorMessage: res.errorMessage || 'Storage 연결에 실패했습니다.',
        });
      }
    } catch (err: any) {
      const errorCode = err?.code || 'UNEXPECTED_ERROR';
      const errorMessage = err?.message || String(err);
      setStorageTestResult({
        status: 'failed',
        errorCode,
        errorMessage,
      });
    } finally {
      setIsTestingStorage(false);
    }
  };

  const commaArtworks = artworks.filter((a) => parseArtworkString(a.title).hasMatch);
  const commaArtworksCount = commaArtworks.length;

  if (!isOpen) return null;

  const handleBatchSplitCommaTitles = () => {
    if (commaArtworksCount === 0) {
      alert('정리할 쉼표 형식의 작품이 없습니다.');
      return;
    }

    if (
      !confirm(
        `쉼표 형식의 제목을 가진 ${commaArtworksCount}점의 작품을 감지했습니다.\n[제목, 년도, 규격, 재료]를 각 필드로 자동 분리하여 정돈하시겠습니까?`
      )
    ) {
      return;
    }

    const updated = artworks.map((art) => {
      const parsed = parseArtworkString(art.title);
      if (!parsed.hasMatch) return art;

      const targetMaterial = parsed.material || art.material;
      const targetMatCode = materialToCode(targetMaterial);

      return {
        ...art,
        title: parsed.title,
        year: parsed.year || art.year,
        canvasSizeCode: parsed.canvasSizeCode || art.canvasSizeCode,
        widthCm: parsed.widthCm ?? art.widthCm,
        heightCm: parsed.heightCm ?? art.heightCm,
        material: targetMaterial,
        materialCode: targetMatCode,
        updatedAt: new Date().toISOString(),
      };
    });

    onImportArtworks(updated);
    setSplitFeedback(`총 ${commaArtworksCount}점의 작품 필드가 성공적으로 분리 정돈되었습니다.`);
  };

  const applyImportedArtworks = (newItems: Artwork[], sourceName: string) => {
    if (newItems.length === 0) {
      alert('가져올 유효한 작품 데이터를 찾을 수 없습니다.');
      return;
    }

    if (importMode === 'replace') {
      onImportArtworks(newItems);
      alert(`[${sourceName}] 총 ${newItems.length}점의 작품 데이터로 전체 복원(대체)되었습니다.`);
    } else {
      // Merge mode: append without duplicate codes
      const existingCodes = new Set(artworks.map((a) => a.code));
      const filteredNew = newItems.filter((item) => !existingCodes.has(item.code));
      onImportArtworks([...artworks, ...filteredNew]);
      alert(`[${sourceName}] 신규 ${filteredNew.length}점(중복 제외)이 기존 갤러리에 추가 병합되었습니다.`);
    }
    onClose();
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof file.text === 'function') {
        file.text().then(resolve).catch((err) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || err);
          reader.readAsText(file, 'utf-8');
        });
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('파일 읽기 실패'));
        reader.readAsText(file, 'utf-8');
      }
    });
  };

  const executeBackupProcess = async (file: File) => {
    const isCSV = file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('spreadsheet');

    if (isCSV) {
      const text = await readFileAsText(file);
      const { artworks: parsedList, errors } = parseArtworkCSV(text, artworks);
      if (errors.length > 0 && parsedList.length === 0) {
        alert(`CSV 파일 읽기 실패: ${errors.join(', ')}`);
        return;
      }
      applyImportedArtworks(parsedList, file.name);
      return;
    }

    // 4. JSON 파일을 선택하면 가장 먼저: alert("JSON 파일을 확인했습니다.");
    alert('JSON 파일을 확인했습니다.');

    // 5. 그 다음 JSON 파일을 읽으세요.
    let text = '';
    try {
      text = await readFileAsText(file);
    } catch (readErr: any) {
      alert(`파일을 읽는 중 오류가 발생했습니다: ${readErr?.message || readErr}`);
      return;
    }

    let backup: any;
    try {
      backup = JSON.parse(text);
    } catch (jsonErr: any) {
      alert(`올바른 JSON 파일 형식이 아닙니다: ${jsonErr?.message || jsonErr}`);
      return;
    }

    // 6. JSON의 artworks 배열을 가져오세요.
    let rawArtworks: any[] | null = null;
    if (Array.isArray(backup?.artworks)) {
      rawArtworks = backup.artworks;
    } else if (Array.isArray(backup)) {
      rawArtworks = backup;
    } else if (Array.isArray(backup?.data)) {
      rawArtworks = backup.data;
    }

    if (!rawArtworks) {
      alert('백업 파일에 backup.artworks 배열이 존재하지 않습니다. 올바른 JSON 백업 파일을 선택해 주세요.');
      return;
    }

    // 7. backup.artworks 배열의 실제 개수 확인
    const count = rawArtworks.length;
    if (count === 0) {
      alert('backup.artworks 배열에 작품 데이터가 비어 있습니다.');
      return;
    }

    // 14. 이전 과정에서 진행상황을 표시하세요.
    // 예: "Firebase 이전 준비: 13점", "Firebase 이전 중: 1/13", ..., "Firebase 이전 중: 13/13"
    setIsMigrating(true);
    setShowMigrationPreview(true);
    setMigrationTotalCount(count);
    setMigrationCurrentIndex(0);
    setMigrationStatusMessage(`Firebase 이전 준비: ${count}점`);

    const initialItems: MigrationProgressItem[] = rawArtworks.map((item: any, idx: number) => ({
      id: String(item.id || `mig-${idx}`),
      code: String(item.code || `CODE-${idx + 1}`),
      title: String(item.title || `작품 #${idx + 1}`),
      currentStep: '대기 중 (Ready)',
      status: 'idle' as MigrationStepStatus,
    }));
    setMigrationItems(initialItems);

    // 7. 기존 migrateBackupArtworksToFirebase() 함수 사용
    const result = await migrateBackupArtworksToFirebase(rawArtworks, (data) => {
      setMigrationCurrentIndex(data.index);
      // 7. 각 작품의 성공/실패 결과를 진행 로그에 표시: "${index}/${total} 이전 중...", "${index}/${total} 완료", "${index}/${total} 실패 - 오류 내용"
      setMigrationStatusMessage(data.step);
      setMigrationItems((prev) =>
        prev.map((it, i) =>
          i === data.index - 1
            ? {
                ...it,
                currentStep: data.step,
                status: data.status,
                storageUrl: data.storageUrl,
                error: data.error,
                errorCode: data.errorCode,
                errorMessage: data.errorMessage,
                failedStage: data.failedStage,
              }
            : it
        )
      );
    });

    setIsMigrating(false);

    // 로컬 데이터 보존 원칙:
    // 1. 절대로 기존 IndexedDB 데이터를 삭제하지 않는다.
    // 2. migration 성공 여부를 확인하기 전에는 로컬 데이터를 변경하지 않는다.
    if (result.failed === 0 && result.migrated === count && result.artworks.length === count) {
      // 13개 전체 성공이 검증된 경우에만 안전하게 로컬 상태(Storage URL 반영) 갱신
      onImportArtworks(result.artworks);
    }

    // 최종 결과 기록 (UI 렌더링용)
    setMigrationFinalResult({
      visible: true,
      migrated: result.migrated,
      failed: result.failed,
      total: result.total,
      failedItems: result.failedDetails || [],
    });

    setMigrationStatusMessage(
      result.failed === 0
        ? `Firebase 이전 완료 (성공: ${result.migrated}점 / 전체: ${result.total}점)`
        : `Firebase 이전 완료 (성공: ${result.migrated}점 / 실패: ${result.failed}점 / 전체: ${result.total}점)`
    );

    // 최종 결과 텍스트:
    // Firebase 이전 완료
    // 성공: X점
    // 실패: Y점
    // 전체: 13점
    // (실패한 작품이 있으면: 작품번호 / 실패 단계 / error.code / error.message)
    let summaryText = `Firebase 이전 완료\n성공: ${result.migrated}점\n실패: ${result.failed}점\n전체: ${result.total}점`;
    if (result.failedDetails && result.failedDetails.length > 0) {
      summaryText += `\n\n[실패한 작품 목록]\n` +
        result.failedDetails
          .map((f) => `${f.code} / ${f.stage} / ${f.errorCode} / ${f.errorMessage}`)
          .join('\n');
    }

    try {
      alert(summaryText);
    } catch {}
  };

  const handleMigrateCurrentArtworks = async () => {
    if (artworks.length === 0) {
      alert('이전할 작품 데이터가 없습니다.');
      return;
    }
    // Condition 4: INITIAL_ARTWORKS는 migration source로 사용하지 않는다.
    if (
      artworks === INITIAL_ARTWORKS ||
      (artworks.length === 12 && artworks[0]?.id === INITIAL_ARTWORKS[0]?.id)
    ) {
      alert(
        '초기 가상 샘플 데이터(INITIAL_ARTWORKS)는 migration source로 사용할 수 없습니다. 백업 JSON 파일을 선택해 주세요.'
      );
      return;
    }

    const count = artworks.length;
    setIsMigrating(true);
    setShowMigrationPreview(true);
    setMigrationTotalCount(count);
    setMigrationCurrentIndex(0);
    setMigrationStatusMessage(`Firebase 이전 준비: ${count}점`);

    const initialItems: MigrationProgressItem[] = artworks.map((item: any, idx: number) => ({
      id: String(item.id || `mig-${idx}`),
      code: String(item.code || `CODE-${idx + 1}`),
      title: String(item.title || `작품 #${idx + 1}`),
      currentStep: '대기 중 (Ready)',
      status: 'idle' as MigrationStepStatus,
    }));
    setMigrationItems(initialItems);

    const result = await migrateBackupArtworksToFirebase(artworks, (data) => {
      setMigrationCurrentIndex(data.index);
      setMigrationStatusMessage(data.step);
      setMigrationItems((prev) =>
        prev.map((it, i) =>
          i === data.index - 1
            ? {
                ...it,
                currentStep: data.step,
                status: data.status,
                storageUrl: data.storageUrl,
                error: data.error,
                errorCode: data.errorCode,
                errorMessage: data.errorMessage,
                failedStage: data.failedStage,
              }
            : it
        )
      );
    });

    setIsMigrating(false);

    // 로컬 데이터 보존 원칙:
    if (result.failed === 0 && result.migrated === count && result.artworks.length === count) {
      onImportArtworks(result.artworks);
    }

    setMigrationFinalResult({
      visible: true,
      migrated: result.migrated,
      failed: result.failed,
      total: result.total,
      failedItems: result.failedDetails || [],
    });

    setMigrationStatusMessage(
      result.failed === 0
        ? `Firebase 이전 완료 (성공: ${result.migrated}점 / 전체: ${result.total}점)`
        : `Firebase 이전 완료 (성공: ${result.migrated}점 / 실패: ${result.failed}점 / 전체: ${result.total}점)`
    );

    let summaryText = `Firebase 이전 완료\n성공: ${result.migrated}점\n실패: ${result.failed}점\n전체: ${result.total}점`;
    if (result.failedDetails && result.failedDetails.length > 0) {
      summaryText +=
        `\n\n[실패한 작품 목록]\n` +
        result.failedDetails
          .map((f) => `${f.code} / ${f.stage} / ${f.errorCode} / ${f.errorMessage}`)
          .join('\n');
    }

    try {
      alert(summaryText);
    } catch {}
  };

  const handleBackupFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    try {
      await executeBackupProcess(file);
    } catch (err: any) {
      // 16. 오류가 발생하면 실제 error.message를 alert로 표시하세요.
      console.error('[ExportImportModal] File import error:', err);
      setIsMigrating(false);
      const errMsg = err?.message || String(err);
      alert(`이전 중 오류가 발생했습니다: ${errMsg}`);
    } finally {
      // 17. finally에서 file input의 value를 비워 같은 파일을 다시 선택할 수 있게 하세요.
      if (inputEl) {
        inputEl.value = '';
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePastedCSVSubmit = () => {
    if (!pastedCSVText.trim()) {
      alert('CSV 텍스트를 붙여넣어 주세요.');
      return;
    }
    const { artworks: parsedList, errors } = parseArtworkCSV(pastedCSVText, artworks);
    if (parsedList.length === 0) {
      alert(`CSV 데이터를 해석할 수 없습니다: ${errors.join(', ')}`);
      return;
    }
    applyImportedArtworks(parsedList, '직접 붙여넣은 CSV');
  };

  return (
    <div
      id="export-import-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="export-import-container"
        className="relative w-full max-w-xl bg-white border border-neutral-300 rounded-sm shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-50/70">
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono-code text-neutral-400">
              DATABASE SYNC & BACKUP
            </span>
            <h2 className="text-lg font-serif-title font-medium text-neutral-900">
              데이터 백업 및 연동 준비 (Supabase · Sheets)
            </h2>
          </div>
          <button
            type="button"
            id="export-import-close-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-neutral-700">
          <div className="bg-neutral-50 border border-neutral-200 rounded p-3.5 space-y-1.5">
            <p className="font-medium text-neutral-900 flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              미래 Supabase 및 Google Sheets 연동 호환 데이터 구조
            </p>
            <p className="text-neutral-500 leading-relaxed">
              현재 프로토타입에 등록된 모든 작품 데이터는 브라우저 로컬 저장소에 보관되며, 언제든지 JSON 또는 CSV로 내보내어 스프레드시트나 데이터베이스로 마이그레이션할 수 있습니다.
            </p>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <h3 className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px]">
              1. 데이터 내보내기 (Export)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                id="export-json-btn"
                onClick={() => exportArtworksToJSON(artworks)}
                className="flex items-center gap-3 p-3.5 border border-neutral-200 hover:border-neutral-800 rounded bg-white hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="p-2 bg-neutral-100 rounded text-neutral-800">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-neutral-900 text-xs">JSON 백업 다운로드</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 font-mono-code">
                    PARK_JINSOO_ARTWORK_BACKUP.json
                  </div>
                </div>
              </button>

              <button
                type="button"
                id="export-csv-btn"
                onClick={() => exportArtworksToCSV(artworks)}
                className="flex items-center gap-3 p-3.5 border border-neutral-200 hover:border-neutral-800 rounded bg-white hover:bg-neutral-50 transition-colors text-left"
              >
                <div className="p-2 bg-neutral-100 rounded text-neutral-800">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-neutral-900 text-xs">CSV 백업 다운로드</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 font-mono-code">
                    PARK_JINSOO_ARTWORK_BACKUP.csv
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Import Option (Supports CSV and JSON) */}
          <div className="space-y-3 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px]">
                2. 데이터 복원 및 불러오기 (Import)
              </h3>
              <div className="flex items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-neutral-900"
                  />
                  <span>전체 덮어쓰기</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="text-neutral-900"
                  />
                  <span>기존 목록에 추가</span>
                </label>
              </div>
            </div>

            {/* File Dropzone for CSV and JSON */}
            <label
              id="backup-file-dropzone"
              htmlFor="backup-file-input"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  try {
                    await executeBackupProcess(file);
                  } catch (err: any) {
                    console.error('[ExportImportModal] File drop error:', err);
                    setIsMigrating(false);
                    const errMsg = err?.message || String(err);
                    alert(`이전 중 오류가 발생했습니다: ${errMsg}`);
                  }
                }
              }}
              className="block border border-dashed border-neutral-300 hover:border-neutral-700 rounded-md p-4 text-center cursor-pointer transition-colors bg-neutral-50/50 hover:bg-neutral-50 focus:outline-hidden focus:ring-1 focus:ring-neutral-400"
            >
              <Upload className="w-5 h-5 mx-auto mb-1 text-neutral-600" />
              <p className="font-medium text-neutral-800 text-xs">
                백업 CSV 또는 JSON 파일 선택 (클릭 또는 파일 끌어다 놓기)
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5 font-mono-code">
                PARK_JINSOO_ARTWORK_BACKUP_*.csv 또는 .json 지원
              </p>
            </label>
            <input
              id="backup-file-input"
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv,text/plain"
              onChange={handleBackupFileImport}
              onClick={(e) => {
                // Ensure value is cleared when opened so selecting the same file always triggers onChange
                (e.currentTarget as HTMLInputElement).value = '';
              }}
              className="sr-only"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
                opacity: 0,
              }}
            />

            {/* Direct Migration Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                id="trigger-json-migration-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isMigrating}
                className="flex-1 flex items-center justify-center gap-2 p-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>백업 JSON 파일 선택 및 Firebase 전체 이전 실행 (13점)</span>
              </button>
              {artworks.length > 0 &&
                artworks !== INITIAL_ARTWORKS &&
                !(artworks.length === 12 && artworks[0]?.id === INITIAL_ARTWORKS[0]?.id) && (
                  <button
                    type="button"
                    id="trigger-current-artworks-migration-btn"
                    onClick={handleMigrateCurrentArtworks}
                    disabled={isMigrating}
                    className="flex items-center justify-center gap-2 p-2.5 bg-neutral-100 hover:bg-neutral-200 disabled:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Database className="w-3.5 h-3.5 text-neutral-600" />
                    <span>현재 로드된 {artworks.length}점 바로 이전</span>
                  </button>
                )}
            </div>

            {/* Live Migration Status indicator (shows immediately upon file selection) */}
            {(isMigrating || migrationStatusMessage) && (
              <div
                id="migration-status-banner"
                className="p-3 bg-neutral-900 text-white rounded text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    {isMigrating ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>{migrationStatusMessage}</span>
                  </div>
                  <span className="font-mono text-neutral-300 text-[11px]">
                    {migrationCurrentIndex} / {migrationTotalCount}
                  </span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isMigrating ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{
                      width: `${
                        migrationTotalCount > 0
                          ? Math.round((migrationCurrentIndex / migrationTotalCount) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Exact Required Final Result Card */}
            {migrationFinalResult && migrationFinalResult.visible && (
              <div
                id="migration-final-result-card"
                className="p-4 bg-neutral-900 text-white rounded-md font-mono text-xs space-y-2.5 shadow-md border border-neutral-800"
              >
                <div className="flex items-center justify-between border-b border-neutral-700 pb-2">
                  <span className="font-bold text-sm text-emerald-400">Firebase 이전 완료</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                      migrationFinalResult.failed === 0
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {migrationFinalResult.failed === 0
                      ? '전체 이전 완료'
                      : `${migrationFinalResult.failed}점 실패`}
                  </span>
                </div>

                <div className="space-y-1 text-neutral-200">
                  <div>성공: {migrationFinalResult.migrated}점</div>
                  <div>실패: {migrationFinalResult.failed}점</div>
                  <div>전체: {migrationFinalResult.total}점</div>
                </div>

                {migrationFinalResult.failedItems.length > 0 && (
                  <div className="pt-2.5 border-t border-neutral-700 space-y-1.5">
                    <div className="text-[11px] font-bold text-red-400">
                      [실패한 작품: 작품번호 / 실패 단계 / error.code / error.message]
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {migrationFinalResult.failedItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-neutral-800 border border-neutral-700 rounded text-[11px] text-red-300 break-all"
                        >
                          {item.code} / {item.stage} / {item.errorCode} / {item.errorMessage}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Direct CSV Text Paste Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsPastingCSV((prev) => !prev)}
                className="text-[11px] text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-medium underline underline-offset-2"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{isPastingCSV ? 'CSV 텍스트 직접 입력창 닫기' : '엑셀/스프레드시트 CSV 텍스트 직접 붙여넣기'}</span>
              </button>

              {isPastingCSV && (
                <div className="mt-2 space-y-2 p-3 bg-neutral-50 rounded border border-neutral-200">
                  <textarea
                    rows={4}
                    value={pastedCSVText}
                    onChange={(e) => setPastedCSVText(e.target.value)}
                    placeholder={`작품번호,작품제목,캔버스규격,가로cm,세로cm,재료,제작연도\n26030PA-01,침묵의 결,030P,90.9,65.1,Acrylic,2026`}
                    className="w-full p-2 text-xs font-mono-code bg-white border border-neutral-300 rounded focus:border-neutral-800 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPastedCSVText('')}
                      className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-800"
                    >
                      지우기
                    </button>
                    <button
                      type="button"
                      onClick={handlePastedCSVSubmit}
                      disabled={!pastedCSVText.trim()}
                      className="px-3 py-1 bg-neutral-900 text-white rounded text-xs font-medium hover:bg-neutral-800 disabled:bg-neutral-300"
                    >
                      붙여넣은 CSV 불러오기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Batch Format Separation */}
          <div className="space-y-3 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                3. 기존 그림 쉼표(,) 데이터 일괄 분리 정리
              </h3>
              {commaArtworksCount > 0 ? (
                <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {commaArtworksCount}점 분리 대상 감지됨
                </span>
              ) : (
                <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 모든 작품 정돈 완료됨
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              기존 그림 중 제목에 &lsquo;제목, 년도, 크기, Material&rsquo; 형식으로 기재된 경우,
              각각의 전용 데이터 필드로 일괄 자동 분리하여 보관합니다.
            </p>

            {splitFeedback && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200/90 rounded text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{splitFeedback}</span>
              </div>
            )}

            <button
              type="button"
              id="batch-split-btn"
              onClick={handleBatchSplitCommaTitles}
              disabled={commaArtworksCount === 0}
              className="w-full flex items-center justify-center gap-2 p-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border disabled:border-neutral-200 text-white rounded text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {commaArtworksCount > 0
                  ? `감지된 ${commaArtworksCount}점의 작품 필드 일괄 자동 분리 실행`
                  : '분리 정리할 쉼표 형식의 작품이 없습니다'}
              </span>
            </button>
          </div>

          {/* Section 4: Firestore Migration Preparation & Granular Progress View */}
          <div className="space-y-3 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-neutral-800" />
                4. Firebase Firestore & Storage 마이그레이션 현황
              </h3>
              <button
                type="button"
                id="toggle-migration-preview-btn"
                onClick={() => setShowMigrationPreview(!showMigrationPreview)}
                className="text-[11px] font-medium text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
              >
                <span>{showMigrationPreview ? '현황 접기' : `[1/${artworks.length}] 진행 현황 점검`}</span>
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isMigrating
                ? '현재 Firebase Storage 원본 이미지 업로드 및 Firestore 데이터 동기화가 진행 중입니다...'
                : `현재 보존된 ${artworks.length}점의 실제 작품을 안전하게 Firestore 및 Storage로 일괄 이전할 수 있습니다.`}
            </p>

            {/* Section 4 Firestore Single-Document Connection Test Card */}
            <div
              id="firestore-connection-test-panel"
              className="p-3 bg-neutral-50 border border-neutral-200 rounded-md space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                    <span>Firestore 단일 문서 연결 테스트</span>
                    <span className="font-mono text-[10px] text-neutral-500 bg-neutral-200/70 px-1.5 py-0.5 rounded">
                      migration-test/firestore-connection-test
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    작은 테스트 문서 {`{ test: true, timestamp }`}를 setDoc()으로 즉시 저장하고 연결 상태를 검증합니다.
                  </div>
                </div>
                <button
                  type="button"
                  id="section-test-firestore-connection-btn"
                  onClick={handleTestFirestoreConnection}
                  disabled={isTestingFirestore || isMigrating}
                  className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 rounded shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {isTestingFirestore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Firestore 연결 테스트 실행</span>
                </button>
              </div>

              {/* Firestore Test Loading */}
              {firestoreTestResult.status === 'running' && (
                <div
                  id="firestore-test-loading-section"
                  className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2 font-mono"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span>Firestore 연결 테스트 진행 중... (setDoc: migration-test/firestore-connection-test)</span>
                </div>
              )}

              {/* Firestore Test Success */}
              {firestoreTestResult.status === 'success' && (
                <div
                  id="firestore-test-result-success-section"
                  className="p-3 bg-emerald-50 border border-emerald-300 rounded-md text-xs text-emerald-950 space-y-1.5 font-mono shadow-xs"
                >
                  <div className="flex items-center justify-between font-bold text-sm text-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Firestore 연결 성공</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-normal">
                      {firestoreTestResult.timestamp}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-900 space-y-0.5 bg-white/70 p-2 rounded border border-emerald-200">
                    <div>문서: {firestoreTestResult.docPath || 'migration-test/firestore-connection-test'}</div>
                    <div>내용: {`{ test: true, timestamp: "${firestoreTestResult.timestamp}" }`}</div>
                    <div className="text-emerald-700 font-medium">상태: setDoc() 단일 문서 저장 및 확인 성공</div>
                  </div>
                </div>
              )}

              {/* Firestore Test Failed */}
              {firestoreTestResult.status === 'failed' && (
                <div
                  id="firestore-test-result-failed-section"
                  className="p-3 bg-red-50 border border-red-300 rounded-md text-xs text-red-950 space-y-2 font-mono shadow-xs"
                >
                  <div className="flex items-center justify-between font-bold text-sm text-red-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Firestore 연결 실패</span>
                    </div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded border border-red-200 space-y-1 text-[11px]">
                    <div>
                      <span className="font-semibold text-neutral-700">Firebase error.code: </span>
                      <span className="text-red-700 font-bold">{firestoreTestResult.errorCode}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-700">Firebase error.message: </span>
                      <span className="text-red-800 break-all">{firestoreTestResult.errorMessage}</span>
                    </div>
                    <div className="text-neutral-500 pt-0.5 border-t border-red-100">
                      대상 문서: {firestoreTestResult.docPath || 'migration-test/firestore-connection-test'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(showMigrationPreview || isMigrating) && (
              <MigrationProgressView
                artworks={artworks}
                items={
                  migrationItems.length > 0
                    ? migrationItems
                    : artworks.map((art, idx) => ({
                        id: art.id,
                        code: art.code,
                        title: art.title,
                        currentStep: idx === 0 ? '준비 완료 (Ready)' : '대기 중 (Standby)',
                        status: 'idle' as MigrationStepStatus,
                      }))
                }
                currentIndex={migrationCurrentIndex}
                totalCount={migrationTotalCount || artworks.length}
                isExecuting={isMigrating}
              />
            )}
          </div>

          {/* Reset to Default - Hardened with strict safety lock against accidental data loss */}
          <div className="pt-3 border-t border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600 font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                샘플 회화 데이터 ({INITIAL_ARTWORKS.length}점)로 강제 초기화
              </span>
              <button
                type="button"
                id="toggle-reset-lock-btn"
                onClick={() => {
                  setShowResetConfirmInput(!showResetConfirmInput);
                  setResetConfirmText('');
                }}
                className="text-[11px] text-neutral-500 hover:text-neutral-800 underline"
              >
                {showResetConfirmInput ? '초기화 취소' : '초기화 메뉴 열기'}
              </button>
            </div>

            {showResetConfirmInput && (
              <div className="p-3 bg-red-50/80 border border-red-200 rounded space-y-2">
                <div className="flex items-start gap-2 text-red-800">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-xs text-red-900">
                      ⚠️ 실제 작품 데이터 영구 덮어쓰기 주의
                    </p>
                    <p className="text-[11px] text-red-700 leading-relaxed">
                      현재 등록된 실제 작품 ({artworks.length}점) 전체가 지워지고, 초기 템플릿의 가상 샘플 회화 ({INITIAL_ARTWORKS.length}점)로 교체됩니다. 이 작업은 되돌릴 수 없습니다.
                    </p>
                  </div>
                </div>

                <div className="pt-1 space-y-1.5">
                  <label className="block text-[11px] font-medium text-neutral-700">
                    실행하려면 아래에 <span className="font-mono-code text-red-700 font-bold select-all">초기화확인</span> 을 정확히 입력하세요:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="초기화확인"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-red-300 rounded bg-white focus:outline-none focus:border-red-600"
                    />
                    <button
                      type="button"
                      id="reset-sample-data-btn"
                      disabled={resetConfirmText !== '초기화확인'}
                      onClick={() => {
                        if (resetConfirmText !== '초기화확인') return;
                        if (confirm(`정말로 현재 ${artworks.length}점의 실제 작품을 초기 가상 샘플 12점으로 되돌리시겠습니까?`)) {
                          onResetToDefault();
                          setShowResetConfirmInput(false);
                          setResetConfirmText('');
                          onClose();
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 disabled:text-neutral-500 rounded font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>확인 및 덮어쓰기</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-6 py-3 bg-neutral-50 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="test-firestore-connection-btn"
                onClick={handleTestFirestoreConnection}
                disabled={isTestingFirestore || isMigrating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-neutral-800 hover:text-neutral-950 bg-white hover:bg-neutral-100 border border-neutral-300 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                title="migration-test/firestore-connection-test 단일 문서 setDoc() 저장 테스트"
              >
                {isTestingFirestore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-600" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Firestore 연결 테스트 (단일 문서)</span>
              </button>

              <button
                type="button"
                id="test-storage-connection-btn"
                onClick={handleTestStorageConnection}
                disabled={isTestingStorage || isMigrating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 rounded transition-colors disabled:opacity-50 cursor-pointer"
                title="migration-test/storage-connection-test.txt 단일 파일 업로드 및 삭제 테스트"
              >
                {isTestingStorage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-600" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-neutral-600" />
                )}
                <span>Storage 연결 테스트 (1개 파일)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
            >
              닫기
            </button>
          </div>

          {/* Firestore Connection Test Result Box (rendered directly on Preview screen) */}
          {firestoreTestResult.status === 'running' && (
            <div
              id="firestore-test-loading"
              className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2 font-mono"
            >
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>Firestore 연결 테스트 진행 중... (setDoc: migration-test/firestore-connection-test)</span>
            </div>
          )}

          {firestoreTestResult.status === 'success' && (
            <div
              id="firestore-test-result-success"
              className="p-3 bg-emerald-50 border border-emerald-300 rounded-md text-xs text-emerald-950 font-mono space-y-1"
            >
              <div className="flex items-center justify-between font-bold text-sm text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firestore 연결 성공</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFirestoreTestResult({ status: 'idle' })}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 underline ml-2 cursor-pointer font-sans"
                >
                  닫기
                </button>
              </div>
              <div className="text-[11px] text-neutral-700">
                문서: {firestoreTestResult.docPath || 'migration-test/firestore-connection-test'}
              </div>
              <div className="text-[11px] text-neutral-700">
                내용: {`{ test: true, timestamp: "${firestoreTestResult.timestamp}" }`}
              </div>
            </div>
          )}

          {firestoreTestResult.status === 'failed' && (
            <div
              id="firestore-test-result-failed"
              className="p-3 bg-red-50 border border-red-300 rounded-md text-xs text-red-950 space-y-1.5 font-mono"
            >
              <div className="flex items-center justify-between font-bold text-sm text-red-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Firestore 연결 실패</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFirestoreTestResult({ status: 'idle' })}
                  className="text-[11px] text-red-700 hover:text-red-900 underline ml-2 cursor-pointer font-sans"
                >
                  닫기
                </button>
              </div>
              <div className="font-mono text-[11px] bg-white/90 p-2 rounded border border-red-200 space-y-1">
                <div>
                  <span className="font-semibold text-neutral-700">Firebase error.code: </span>
                  <span className="text-red-700 font-bold">{firestoreTestResult.errorCode}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-700">Firebase error.message: </span>
                  <span className="text-red-800 break-all">{firestoreTestResult.errorMessage}</span>
                </div>
                <div className="text-neutral-500 pt-0.5 border-t border-red-100">
                  대상 문서: {firestoreTestResult.docPath || 'migration-test/firestore-connection-test'}
                </div>
              </div>
            </div>
          )}

          {/* Storage Connection Test Result Box (rendered directly on Preview screen) */}
          {storageTestResult.status === 'running' && (
            <div
              id="storage-test-loading"
              className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span>Storage 연결 테스트 진행 중... (최대 15초)</span>
            </div>
          )}

          {storageTestResult.status === 'success' && (
            <div
              id="storage-test-result-success"
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-950 flex items-start justify-between"
            >
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Storage 연결 성공</span>
              </div>
              <button
                type="button"
                onClick={() => setStorageTestResult({ status: 'idle' })}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 underline ml-2 cursor-pointer"
              >
                닫기
              </button>
            </div>
          )}

          {storageTestResult.status === 'failed' && (
            <div
              id="storage-test-result-failed"
              className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-950 space-y-1.5"
            >
              <div className="flex items-center justify-between font-semibold">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Storage 연결 실패</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStorageTestResult({ status: 'idle' })}
                  className="text-[11px] text-red-700 hover:text-red-900 underline ml-2 cursor-pointer"
                >
                  닫기
                </button>
              </div>
              <div className="font-mono text-[11px] bg-white/90 p-2 rounded border border-red-200 space-y-1">
                <div>
                  <span className="font-semibold text-neutral-700">Firebase error.code: </span>
                  <span className="text-red-700 font-bold">{storageTestResult.errorCode}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-700">Firebase error.message: </span>
                  <span className="text-red-800 break-all">{storageTestResult.errorMessage}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
