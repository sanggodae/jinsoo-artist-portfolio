import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, RefreshCw, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Artwork, MaterialType } from '../types';
import { CANVAS_SIZES } from '../data/canvasSizes';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { parseArtworkString } from '../utils/artworkParser';
import { generateNextArtworkCode, materialToCode } from '../utils/codeGenerator';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingArtworks: Artwork[];
  onBatchAdd: (artworks: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
}

interface BatchItem {
  id: string;
  file: File;
  fileName: string;
  title: string;
  year: number;
  canvasSizeCode: string;
  widthCm: number;
  heightCm: number;
  material: MaterialType;
  code: string;
  imageUrl: string;
  isProcessing: boolean;
  error?: string;
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  isOpen,
  onClose,
  existingArtworks,
  onBatchAdd,
}) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessingAny, setIsProcessingAny] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((file) => {
      const isImg = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|tiff|tif|heic|heif|avif)$/i.test(file.name);
      return isImg;
    });

    if (fileArray.length === 0) {
      alert('업로드할 수 있는 이미지 파일을 선택해주세요 (JPG, PNG, WEBP 등).');
      return;
    }

    setIsProcessingAny(true);

    // Track simulated artworks list to compute unique sequential codes for each batch item
    const simulatedArtworks: Artwork[] = [...existingArtworks];

    const newBatchItems: BatchItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const parsed = parseArtworkString(file.name);

      const title = parsed.hasMatch ? parsed.title : file.name.replace(/\.[^/.]+$/, '');
      const year = parsed.year || new Date().getFullYear();
      const canvasCode = parsed.canvasSizeCode || '030P';
      const stdSize = CANVAS_SIZES[canvasCode];
      const widthCm = parsed.widthCm ?? (stdSize ? stdSize.widthCm : 90.9);
      const heightCm = parsed.heightCm ?? (stdSize ? stdSize.heightCm : 65.1);
      const mat = parsed.material || 'Acrylic';

      // Generate unique sequential code
      const nextCode = generateNextArtworkCode(year, canvasCode, mat, simulatedArtworks);

      // Add mock artwork to simulated list for next item's unique code calculation
      simulatedArtworks.push({
        id: `mock-${Date.now()}-${i}`,
        code: nextCode,
        title,
        canvasSizeCode: canvasCode,
        widthCm,
        heightCm,
        material: mat,
        materialCode: materialToCode(mat),
        year,
        description: '',
        displayOrder: 1,
        isFeatured: false,
        imageUrl: '',
        createdAt: '',
        updatedAt: '',
      });

      newBatchItems.push({
        id: `batch-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        fileName: file.name,
        title,
        year,
        canvasSizeCode: canvasCode,
        widthCm,
        heightCm,
        material: mat,
        code: nextCode,
        imageUrl: '',
        isProcessing: true,
      });
    }

    setItems((prev) => [...prev, ...newBatchItems]);

    // Process image optimizations asynchronously
    for (const batchItem of newBatchItems) {
      try {
        const optimized = await optimizeImageFile(batchItem.file, { maxDimension: 2048, quality: 0.88 });
        setItems((prev) =>
          prev.map((item) =>
            item.id === batchItem.id
              ? { ...item, imageUrl: optimized.dataUrl, isProcessing: false }
              : item
          )
        );
      } catch (err) {
        console.warn('Batch optimize fallback:', err);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const dataUrl = reader.result;
            setItems((prev) =>
              prev.map((item) =>
                item.id === batchItem.id
                  ? { ...item, imageUrl: dataUrl, isProcessing: false }
                  : item
              )
            );
          }
        };
        reader.onerror = () => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === batchItem.id
                ? { ...item, isProcessing: false, error: '이미지 최적화 실패' }
                : item
            )
          );
        };
        reader.readAsDataURL(batchItem.file);
      }
    }

    setIsProcessingAny(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItemTitle = (id: string, newTitle: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleUpdateItemMaterial = (id: string, newMat: MaterialType) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, material: newMat } : item))
    );
  };

  const handleConfirmBatchAdd = () => {
    const validItems = items.filter((item) => item.imageUrl && !item.isProcessing);
    if (validItems.length === 0) {
      alert('등록할 유효한 작품 이미지가 없습니다.');
      return;
    }

    const payloadList: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt'>[] = validItems.map((item, idx) => ({
      code: item.code,
      title: item.title.trim() || '무제',
      canvasSizeCode: item.canvasSizeCode,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      material: item.material,
      materialCode: materialToCode(item.material),
      year: item.year,
      description: '',
      displayOrder: existingArtworks.length + idx + 1,
      isFeatured: false,
      imageUrl: item.imageUrl,
    }));

    onBatchAdd(payloadList);
    setItems([]);
    onClose();
  };

  const completedCount = items.filter((item) => item.imageUrl && !item.isProcessing).length;

  return (
    <div
      id="batch-upload-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="batch-upload-container"
        className="relative w-full max-w-4xl bg-white border border-neutral-300 rounded-sm shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-50/80">
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono-code text-neutral-400">
              BATCH IMAGE UPLOADER
            </span>
            <h2 className="text-lg font-serif-title font-medium text-neutral-900 flex items-center gap-2">
              <span>여러 작품 사진 파일 일괄 등록</span>
              <span className="text-xs font-sans font-normal px-2 py-0.5 rounded bg-neutral-200 text-neutral-700">
                대량 추가
              </span>
            </h2>
          </div>
          <button
            type="button"
            id="batch-upload-close-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-neutral-700">
          {/* Info Banner */}
          <div className="bg-amber-50/70 border border-amber-200 rounded p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-medium">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>파일명 자동 분석 지원 (제목, 년도, 호수, 재료)</span>
            </div>
            <p className="text-neutral-600 text-[11px] leading-relaxed">
              파일명이 <code className="font-mono-code bg-amber-100/60 px-1 py-0.5 rounded text-amber-950">침묵의 결, 2025, 30P, Acrylic.jpg</code> 형식이면 제목, 제작연도, 캔버스 규격, 재료를 자동으로 추출하여 등록합니다. 일반 파일명인 경우에도 고유 작품번호가 자동 발급됩니다.
            </p>
          </div>

          {/* Multi-file Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
              }
            }}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
              isDraggingOver
                ? 'border-neutral-900 bg-neutral-100 scale-[0.99]'
                : 'border-neutral-300 hover:border-neutral-600 bg-neutral-50/50 hover:bg-neutral-50'
            }`}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-neutral-500" />
            <p className="text-sm font-medium text-neutral-800">
              여러 장의 회화 사진 파일을 한꺼번에 끌어다 놓거나 클릭하여 선택
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">
              JPG, PNG, WEBP, HEIC 등 지원 · 10~50장 이상 한 번에 선택 가능 · 원본 비율 100% 보존
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.tiff,.tif,.bmp,.avif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Selected Files Preview List */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px]">
                  업로드 대기 목록 ({items.length}점 선택됨 · {completedCount}점 최적화 완료)
                </h3>
                {isProcessingAny && (
                  <span className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    사진 고화질 최적화 처리 중...
                  </span>
                )}
              </div>

              <div className="border border-neutral-200 rounded overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-neutral-100 text-neutral-600 sticky top-0 z-10 border-b border-neutral-200">
                    <tr>
                      <th className="py-2 px-3 font-medium w-16">사진</th>
                      <th className="py-2 px-3 font-medium">추출 제목</th>
                      <th className="py-2 px-3 font-medium w-28">작품번호</th>
                      <th className="py-2 px-3 font-medium w-28">호수(규격)</th>
                      <th className="py-2 px-3 font-medium w-24">재료</th>
                      <th className="py-2 px-3 font-medium w-16 text-center">연도</th>
                      <th className="py-2 px-2 font-medium w-10 text-center">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-2 px-3">
                          <div className="w-10 h-10 bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center overflow-hidden">
                            {item.isProcessing ? (
                              <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin" />
                            ) : item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-neutral-300" />
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateItemTitle(item.id, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-neutral-200 rounded focus:border-neutral-800 focus:outline-none"
                            placeholder="작품 제목"
                          />
                          <span className="text-[10px] text-neutral-400 block truncate max-w-xs mt-0.5">
                            {item.fileName}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono-code text-neutral-700">
                          {item.code}
                        </td>
                        <td className="py-2 px-3 text-neutral-600">
                          <span>{item.canvasSizeCode}</span>
                          <span className="text-[10px] text-neutral-400 block">
                            {item.widthCm}×{item.heightCm}cm
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={item.material}
                            onChange={(e) => handleUpdateItemMaterial(item.id, e.target.value as MaterialType)}
                            className="px-1.5 py-1 text-xs border border-neutral-200 rounded bg-white"
                          >
                            <option value="Acrylic">Acrylic</option>
                            <option value="Oil">Oil</option>
                            <option value="Mixed">Mixed</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 font-mono-code text-center text-neutral-700">
                          {item.year}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                            title="제외"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-50/50">
          <div className="text-xs text-neutral-500">
            {items.length > 0 ? (
              <span>
                총 <strong>{completedCount}</strong>점의 작품이 갤러리에 추가될 준비가 되었습니다.
              </span>
            ) : (
              <span>사진 파일을 여러 장 선택하여 추가해주세요.</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="batch-upload-cancel-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              id="batch-upload-submit-btn"
              disabled={completedCount === 0 || isProcessingAny}
              onClick={handleConfirmBatchAdd}
              className="px-5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 rounded shadow-xs transition-all active:scale-[0.99] flex items-center gap-1.5"
            >
              {isProcessingAny ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>사진 최적화 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{completedCount}점 일괄 등록 완료</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
