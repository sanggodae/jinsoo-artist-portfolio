import React from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle, Sparkles, Database, ArrowRight } from 'lucide-react';
import { Artwork, MigrationProgressItem } from '../types';

interface MigrationProgressViewProps {
  artworks: Artwork[];
  items: MigrationProgressItem[];
  currentIndex: number;
  totalCount: number;
  isExecuting: boolean;
  onClose?: () => void;
}

/**
 * MigrationProgressView (UI & Log Preview for Future Migration Execution)
 *
 * Provides granular tracking:
 * - [1/13], [2/13] ... [13/13] progress format
 * - Per-item tracking: code, title, current step, and status (idle, in_progress, completed, failed, skipped)
 * - Safe read-only preview by default: DOES NOT trigger actual migration
 */
export const MigrationProgressView: React.FC<MigrationProgressViewProps> = ({
  artworks,
  items,
  currentIndex,
  totalCount,
  isExecuting,
  onClose,
}) => {
  const displayTotal = totalCount > 0 ? totalCount : artworks.length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const firstFailedItem = items.find((i) => i.status === 'failed');

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3.5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-neutral-800" />
          <h4 className="text-xs font-semibold text-neutral-900 tracking-wide">
            Firestore 마이그레이션 진행 현황 및 상세 로그
          </h4>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded font-mono-code font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
            [{currentIndex}/{displayTotal}]
          </span>
          {isExecuting ? (
            <span className="flex items-center gap-1 text-blue-600 font-medium animate-pulse">
              <Clock className="w-3 h-3 animate-spin" /> 진행 중...
            </span>
          ) : (
            <span className="text-neutral-500 font-medium">준비 대기</span>
          )}
        </div>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="p-2 bg-neutral-50 border border-neutral-100 rounded">
          <span className="text-neutral-500 block text-[10px]">전체 대상</span>
          <strong className="text-neutral-900 font-mono-code">{displayTotal}점</strong>
        </div>
        <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded">
          <span className="text-emerald-700 block text-[10px]">완료</span>
          <strong className="text-emerald-800 font-mono-code">{completedCount}점</strong>
        </div>
        <div className="p-2 bg-neutral-50 border border-neutral-100 rounded">
          <span className="text-neutral-500 block text-[10px]">실패/대기</span>
          <strong className="text-neutral-800 font-mono-code">
            {failedCount > 0 ? `${failedCount}점 실패` : `${displayTotal - completedCount}점`}
          </strong>
        </div>
      </div>

      {/* User Required Final Result:
          Firebase 이전 완료
          성공: X점
          실패: Y점
          전체: 13점
      */}
      {completedCount + failedCount === displayTotal && displayTotal > 0 && !isExecuting && (
        <div id="migration-progress-final-summary" className="p-3.5 bg-neutral-900 text-white rounded-md font-mono text-xs space-y-2 shadow-xs">
          <div className="font-bold text-sm text-emerald-400 flex items-center justify-between">
            <span>Firebase 이전 완료</span>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-normal">
              {failedCount === 0 ? '전체 성공' : `${failedCount}건 실패`}
            </span>
          </div>
          <div className="space-y-0.5 text-neutral-200">
            <div>성공: {completedCount}점</div>
            <div>실패: {failedCount}점</div>
            <div>전체: {displayTotal}점</div>
          </div>
          {failedCount > 0 && (
            <div className="pt-2 border-t border-neutral-700 space-y-1.5">
              <div className="text-[11px] text-red-400 font-semibold">
                [실패 작품: 작품번호 / 실패 단계 / error.code / error.message]
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {items
                  .filter((i) => i.status === 'failed')
                  .map((f, i) => (
                    <div key={i} className="text-[11px] text-red-300 bg-neutral-800/90 p-1.5 rounded border border-neutral-700 break-all">
                      {f.code} / {f.failedStage || 'Storage'} / {f.errorCode || 'UNKNOWN'} / {f.errorMessage || f.error}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* First Failure Inspection Card */}
      {firstFailedItem && (
        <div className="p-2.5 bg-red-50/90 border border-red-200 rounded text-xs text-red-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-red-950">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>첫 번째 실패 작품 오류 원인 ({firstFailedItem.code} {firstFailedItem.title})</span>
          </div>
          <div className="text-[11px] font-mono-code bg-white/90 p-2 rounded border border-red-200/80 space-y-0.5">
            <div>
              <span className="text-neutral-500 font-medium">error.code: </span>
              <span className="text-red-700 font-bold">{firstFailedItem.errorCode || 'UNKNOWN'}</span>
            </div>
            <div className="break-all">
              <span className="text-neutral-500 font-medium">error.message: </span>
              <span className="text-neutral-800">{firstFailedItem.errorMessage || firstFailedItem.error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress Items Log Table */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto border border-neutral-200 rounded p-1.5 bg-neutral-50/50">
        {(items.length > 0
          ? items
          : artworks.map((art, idx) => ({
              id: art.id,
              code: art.code,
              title: art.title,
              currentStep: '대기 중 (Ready)',
              status: 'idle' as const,
            }))
        ).map((item, idx) => {
          const stepNumber = idx + 1;
          const isCurrent = isExecuting && currentIndex === stepNumber;

          return (
            <div
              key={item.id || idx}
              className={`flex flex-col gap-1 p-2 rounded text-[11px] border transition-colors ${
                item.status === 'completed'
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : item.status === 'failed'
                  ? 'bg-red-50/80 border-red-200 text-red-950'
                  : isCurrent
                  ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-xs'
                  : 'bg-white border-neutral-200 text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-code text-[10px] font-semibold text-neutral-400 w-10 shrink-0">
                    [{stepNumber}/{displayTotal}]
                  </span>
                  <span className="font-mono-code text-neutral-900 font-medium px-1 bg-neutral-100 rounded border border-neutral-200 shrink-0">
                    {item.code}
                  </span>
                  <span className="truncate font-medium text-neutral-800 max-w-[160px] sm:max-w-[240px]">
                    {item.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-neutral-500 hidden sm:inline font-mono-code">
                    {item.currentStep}
                  </span>
                  {item.status === 'completed' ? (
                    <span className="flex items-center gap-1 text-emerald-700 font-medium text-[10px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      완료
                    </span>
                  ) : item.status === 'failed' ? (
                    <span className="flex items-center gap-1 text-red-700 font-medium text-[10px]">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      실패
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1 text-blue-700 font-medium text-[10px]">
                      <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      처리 중
                    </span>
                  ) : (
                    <span className="text-neutral-400 text-[10px]">대기</span>
                  )}
                </div>
              </div>

              {/* Per-item detailed error message & code */}
              {item.status === 'failed' && (item.error || item.errorMessage) && (
                <div className="mt-0.5 pt-1 border-t border-red-200/80 text-[10px] font-mono-code text-red-900 break-all flex flex-col gap-0.5">
                  <div className="flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                    <span>
                      {item.failedStage && (
                        <span className="px-1 py-0.5 bg-red-200 text-red-900 font-bold rounded text-[9px] mr-1">
                          {item.failedStage} 실패
                        </span>
                      )}
                      {item.errorCode && <strong className="text-red-700 font-bold mr-1">[{item.errorCode}]</strong>}
                      {item.errorMessage || item.error}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-neutral-400 leading-relaxed">
        * 각 작품은 <strong>[1/13]</strong> 순서대로 처리되며, Storage 업로드(Base64 → Blob → uploadBytes) 후 Firestore(artworks/&#123;artwork.id&#125;)에 저장됩니다. 작품 ID와 작품번호는 1:1 보존됩니다.
      </p>
    </div>
  );
};
