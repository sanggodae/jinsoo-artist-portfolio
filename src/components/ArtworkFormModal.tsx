import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Sparkles, AlertCircle, CheckCircle2, Image as ImageIcon, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { Artwork, MaterialType, ArtworkCodeSettings } from '../types';
import { CANVAS_SIZES } from '../data/canvasSizes';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { parseArtworkString, ParsedArtworkInfo } from '../utils/artworkParser';
import {
  generateNextArtworkCode,
  isCodeDuplicated,
  materialToCode,
  validateArtworkCode,
} from '../utils/codeGenerator';

interface ArtworkFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (artworkData: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => void;
  artworkToEdit?: Artwork | null;
  existingArtworks: Artwork[];
  onOpenBatchUpload?: () => void;
  codeSettings?: ArtworkCodeSettings;
}

const CANVAS_GROUPS: Record<'popular' | '10-30' | '40-120' | '0-8', string[]> = {
  popular: ['010F', '010P', '020F', '020P', '030P', '030F', '050F', '050P', '100F', '100P', '010S'],
  '10-30': [
    '010F', '010P', '010M', '010S',
    '015F', '015P', '015M',
    '020F', '020P', '020M', '020S',
    '025F', '025P', '025M',
    '030F', '030P', '030M', '030S',
  ],
  '40-120': [
    '040F', '040P', '040M',
    '050F', '050P', '050M', '050S',
    '060F', '060P', '060M',
    '080F', '080P', '080M',
    '100F', '100P', '100M', '100S',
    '120F', '120P', '120M',
  ],
  '0-8': [
    '000F', '000P', '000M', '000S',
    '001F', '001P', '001M', '001S',
    '002F', '002P', '002M',
    '003F', '003P', '003M', '003S',
    '004F', '004P', '004M',
    '006F', '006P', '006M', '006S',
    '008F', '008P', '008M',
  ],
};

export const ArtworkFormModal: React.FC<ArtworkFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  artworkToEdit,
  existingArtworks,
  onOpenBatchUpload,
  codeSettings,
}) => {
  const isEditing = Boolean(artworkToEdit);

  // Form State
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [canvasSizeCode, setCanvasSizeCode] = useState('030P');
  const [widthCm, setWidthCm] = useState<number | ''>(90.9);
  const [heightCm, setHeightCm] = useState<number | ''>(65.1);
  const [material, setMaterial] = useState<MaterialType>('Acrylic');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [multiDropAlert, setMultiDropAlert] = useState<number | null>(null);
  const [autoParsedNotification, setAutoParsedNotification] = useState<string | null>(null);
  const [canvasCategoryTab, setCanvasCategoryTab] = useState<'popular' | '10-30' | '40-120' | '0-8'>('popular');
  const [codeFeedback, setCodeFeedback] = useState<{ isDuplicate: boolean; message?: string }>({
    isDuplicate: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formBodyRef = useRef<HTMLFormElement>(null);

  // Initialize or reset form when modal opens or edit item changes
  useEffect(() => {
    if (!isOpen) return;

    if (artworkToEdit) {
      // Check if existing artwork title has comma-separated fields: "제목, 년도, 크기, Material"
      const parsed = parseArtworkString(artworkToEdit.title);
      if (parsed.hasMatch) {
        setTitle(parsed.title);
        setCanvasSizeCode(parsed.canvasSizeCode || artworkToEdit.canvasSizeCode);
        setWidthCm(parsed.widthCm ?? artworkToEdit.widthCm);
        setHeightCm(parsed.heightCm ?? artworkToEdit.heightCm);
        setMaterial(parsed.material || artworkToEdit.material);
        setYear(parsed.year || artworkToEdit.year);

        const extractedParts: string[] = [];
        if (parsed.title) extractedParts.push(`제목: "${parsed.title}"`);
        if (parsed.year) extractedParts.push(`연도: ${parsed.year}년`);
        if (parsed.canvasSizeCode) extractedParts.push(`규격: ${parsed.canvasSizeCode}`);
        if (parsed.material) extractedParts.push(`재료: ${parsed.material}`);

        setAutoParsedNotification(
          `선택한 그림 제목("${artworkToEdit.title}")에서 [${extractedParts.join(', ')}] 필드를 자동으로 분리하여 배치했습니다.`
        );
      } else {
        setTitle(artworkToEdit.title);
        setCanvasSizeCode(artworkToEdit.canvasSizeCode);
        setWidthCm(artworkToEdit.widthCm);
        setHeightCm(artworkToEdit.heightCm);
        setMaterial(artworkToEdit.material);
        setYear(artworkToEdit.year);
        setAutoParsedNotification(null);
      }

      setCode(artworkToEdit.code);
      setDescription(artworkToEdit.description);
      setDisplayOrder(artworkToEdit.displayOrder);
      setIsFeatured(artworkToEdit.isFeatured);
      setImageUrl(artworkToEdit.imageUrl);
      setErrors({});
    } else {
      // New Registration defaults
      const currentYear = 2026;
      const defaultCanvas = '030P';
      const defaultMat: MaterialType = 'Acrylic';
      const maxOrder = existingArtworks.length > 0
        ? Math.max(...existingArtworks.map((a) => a.displayOrder || 0)) + 1
        : 1;

      setTitle('');
      setCanvasSizeCode(defaultCanvas);
      setWidthCm(90.9);
      setHeightCm(65.1);
      setMaterial(defaultMat);
      setYear(currentYear);
      setDescription('');
      setDisplayOrder(maxOrder);
      setIsFeatured(false);
      setImageUrl('');
      setAutoParsedNotification(null);
      setErrors({});

      // Auto generate initial code
      const autoCode = generateNextArtworkCode(
        currentYear,
        defaultCanvas,
        defaultMat,
        existingArtworks,
        undefined,
        codeSettings
      );
      setCode(autoCode);
    }
  }, [isOpen, artworkToEdit, existingArtworks, codeSettings]);

  // Code duplication live check
  useEffect(() => {
    if (!code) {
      setCodeFeedback({ isDuplicate: false });
      return;
    }
    const duplicate = isCodeDuplicated(
      code,
      existingArtworks,
      artworkToEdit ? artworkToEdit.id : undefined
    );
    if (duplicate) {
      setCodeFeedback({
        isDuplicate: true,
        message: '주의: 이미 다른 작품에서 사용 중인 작품번호입니다. 중복은 저장할 수 없습니다.',
      });
    } else {
      setCodeFeedback({ isDuplicate: false });
    }
  }, [code, existingArtworks, artworkToEdit]);

  // Detect comma-separated fields in title (e.g. "제목, 년도, 크기, 재료")
  const titleParsedInfo = React.useMemo(() => {
    if (!title || (!title.includes(',') && !title.includes('，'))) {
      return null;
    }
    const res = parseArtworkString(title);
    return res.hasMatch ? res : null;
  }, [title]);

  // Auto Code Generation Click
  const handleAutoGenerateCode = () => {
    const nextCode = generateNextArtworkCode(
      year,
      canvasSizeCode,
      material,
      existingArtworks,
      artworkToEdit ? artworkToEdit.id : undefined,
      codeSettings
    );
    setCode(nextCode);
  };

  // Standard Canvas Selection Handler with Orientation (각 호칭마다 가로형 / 세로형 지원)
  const handleSelectStandardCanvas = (
    selectedCode: string,
    orientation: 'landscape' | 'portrait' = 'landscape'
  ) => {
    const found = CANVAS_SIZES.find((c) => c.code.toUpperCase() === selectedCode.toUpperCase());
    if (found) {
      setCanvasSizeCode(found.code);

      if (found.type === 'S') {
        setWidthCm(found.widthCm);
        setHeightCm(found.heightCm);
      } else {
        const longSide = Math.max(found.widthCm, found.heightCm);
        const shortSide = Math.min(found.widthCm, found.heightCm);
        if (orientation === 'landscape') {
          setWidthCm(longSide);
          setHeightCm(shortSide);
        } else {
          setWidthCm(shortSide);
          setHeightCm(longSide);
        }
      }

      // If code was not manually typed or user wants auto sync
      const nextCode = generateNextArtworkCode(
        year,
        found.code,
        material,
        existingArtworks,
        artworkToEdit ? artworkToEdit.id : undefined,
        codeSettings
      );
      setCode(nextCode);

      if (errors.widthCm) setErrors((prev) => ({ ...prev, widthCm: '' }));
      if (errors.heightCm) setErrors((prev) => ({ ...prev, heightCm: '' }));
    }
  };

  // Swap width and height (가로 ↔ 세로 즉시 맞바꾸기)
  const handleSwapOrientation = () => {
    if (widthCm !== '' && heightCm !== '') {
      const prevW = widthCm;
      const prevH = heightCm;
      setWidthCm(prevH);
      setHeightCm(prevW);
      if (errors.widthCm) setErrors((prev) => ({ ...prev, widthCm: '' }));
      if (errors.heightCm) setErrors((prev) => ({ ...prev, heightCm: '' }));
    }
  };

  // Force set current dimensions to landscape or portrait
  const handleSetCurrentOrientation = (targetOrientation: 'landscape' | 'portrait') => {
    if (widthCm === '' || heightCm === '') return;
    const numW = Number(widthCm);
    const numH = Number(heightCm);
    if (isNaN(numW) || isNaN(numH)) return;
    const longSide = Math.max(numW, numH);
    const shortSide = Math.min(numW, numH);
    if (targetOrientation === 'landscape') {
      setWidthCm(longSide);
      setHeightCm(shortSide);
    } else {
      setWidthCm(shortSide);
      setHeightCm(longSide);
    }
    if (errors.widthCm) setErrors((prev) => ({ ...prev, widthCm: '' }));
    if (errors.heightCm) setErrors((prev) => ({ ...prev, heightCm: '' }));
  };

  // Apply parsed artwork fields to state
  const applyParsedArtworkInfo = (info: ParsedArtworkInfo, sourceDesc: string) => {
    if (info.title) {
      setTitle(info.title);
      if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
    }

    const nextYear = info.year ?? year;
    const nextCanvas = info.canvasSizeCode ?? canvasSizeCode;
    const nextMaterial = info.material ?? material;

    if (info.year) setYear(info.year);
    if (info.canvasSizeCode) setCanvasSizeCode(info.canvasSizeCode);
    if (info.widthCm) setWidthCm(info.widthCm);
    if (info.heightCm) setHeightCm(info.heightCm);
    if (info.material) setMaterial(info.material);

    // Auto-update artwork code with newly parsed year, canvas, material
    const nextCode = generateNextArtworkCode(
      nextYear,
      nextCanvas,
      nextMaterial,
      existingArtworks,
      artworkToEdit ? artworkToEdit.id : undefined,
      codeSettings
    );
    setCode(nextCode);

    const parts: string[] = [];
    if (info.title) parts.push(`제목: "${info.title}"`);
    if (info.year) parts.push(`연도: ${info.year}년`);
    if (info.canvasSizeCode) parts.push(`규격: ${info.canvasSizeCode}${info.widthCm && info.heightCm ? ` (${info.widthCm}×${info.heightCm}cm)` : ''}`);
    if (info.material) parts.push(`재료: ${info.material}`);

    setAutoParsedNotification(
      `${sourceDesc}에서 [${parts.join(', ')}] 정보를 자동 추출하여 각 필드에 채워 넣었습니다.`
    );
  };

  // Process image with client-side optimizer (preserves aspect ratio, prevents storage quota crashes)
  const processImageFile = async (file: File) => {
    const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp|tiff|tif|heic|heif|avif)$/i.test(file.name);
    if (!file.type.startsWith('image/') && !isImageExt) {
      setErrors((prev) => ({
        ...prev,
        imageUrl: '지원되지 않는 파일 형식입니다. 이미지 파일(JPG, PNG, WEBP 등)을 선택해주세요.',
      }));
      return;
    }

    // 1. Auto-parse comma-separated fields from image file name (e.g. "무제, 2024, 30P, Acrylic.jpg")
    const parsed = parseArtworkString(file.name);
    if (parsed.hasMatch) {
      applyParsedArtworkInfo(parsed, `선택한 그림 파일명("${file.name}")`);
    }

    setIsProcessingImage(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.imageUrl;
      return next;
    });

    try {
      const optimized = await optimizeImageFile(file, { maxDimension: 2048, quality: 0.88 });
      setImageUrl(optimized.dataUrl);
    } catch (err) {
      console.warn('Optimization failed, using direct reader fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.onerror = () => {
        setErrors((prev) => ({
          ...prev,
          imageUrl: '이미지 파일을 읽는데 실패했습니다. 다른 사진 파일을 시도해주세요.',
        }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (isProcessingImage) {
      newErrors.imageUrl = '이미지를 고화질 최적화 처리 중입니다. 잠시 후 다시 등록 버튼을 눌러주세요.';
    } else if (!imageUrl.trim()) {
      newErrors.imageUrl = '작품 이미지를 등록해주세요 (사진 파일 업로드 또는 웹 URL).';
    }

    if (!title.trim()) {
      newErrors.title = '작품 제목을 입력해주세요.';
    }

    if (!code.trim()) {
      newErrors.code = '작품번호를 입력해주세요.';
    } else if (codeFeedback.isDuplicate) {
      newErrors.code = '이미 사용 중인 작품번호입니다. [새 번호 자동 발급] 단추를 눌러주세요.';
    } else {
      const val = validateArtworkCode(
        code,
        existingArtworks,
        artworkToEdit ? artworkToEdit.id : undefined
      );
      if (!val.isValid) {
        newErrors.code = val.error || '유효하지 않은 작품번호입니다.';
      }
    }

    if (widthCm === '' || Number(widthCm) <= 0) {
      newErrors.widthCm = '가로 길이를 올바르게 입력해주세요 (0보다 큰 숫자).';
    }

    if (heightCm === '' || Number(heightCm) <= 0) {
      newErrors.heightCm = '세로 길이를 올바르게 입력해주세요 (0보다 큰 숫자).';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (formBodyRef.current) {
        formBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const payload: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt'> = {
      code: code.trim(),
      title: title.trim(),
      canvasSizeCode: canvasSizeCode.trim().toUpperCase(),
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
      material,
      materialCode: materialToCode(material),
      year: Number(year),
      description: description.trim(),
      displayOrder: Number(displayOrder) || 1,
      isFeatured,
      imageUrl: imageUrl.trim(),
    };

    onSave(payload, artworkToEdit?.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="artwork-form-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="artwork-form-container"
        className="relative w-full max-w-3xl bg-white border border-neutral-300 rounded-sm shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-50/70">
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase font-mono-code text-neutral-400">
              {isEditing ? 'UPDATE ARTWORK DATA' : 'NEW ARTWORK REGISTRATION'}
            </span>
            <h2 className="text-lg font-serif-title font-medium text-neutral-900">
              {isEditing ? '작품 정보 수정' : '새 회화 작품 등록'}
            </h2>
          </div>
          <button
            type="button"
            id="artwork-form-close-btn"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto Parsed Notification Banner */}
        {autoParsedNotification && (
          <div className="bg-emerald-50 border-b border-emerald-200/90 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{autoParsedNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoParsedNotification(null)}
              className="p-1 text-emerald-700 hover:text-emerald-950 transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form
          ref={formBodyRef}
          id="artwork-form-scrollable"
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto space-y-6 text-sm"
        >
          {/* Section 1: Artwork Image (Strict Aspect Ratio Preservation) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider">
              작품 이미지 <span className="text-red-500">*</span>
              <span className="text-neutral-400 text-[11px] font-normal lowercase ml-2">
                (원본 비율 유지 · 자르거나 왜곡하지 않음)
              </span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Image Preview Stage */}
              <div className="md:col-span-5 bg-[#F6F6F5] border border-neutral-200 rounded p-3 h-52 flex items-center justify-center relative overflow-hidden">
                {imageUrl ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="작품 미리보기"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full w-auto h-auto object-contain shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-2 right-2 bg-neutral-900/80 text-white p-1 rounded hover:bg-neutral-900 text-xs"
                      title="이미지 삭제"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-4 text-neutral-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1.5 text-neutral-300" />
                    <span className="text-xs block">이미지 미리보기</span>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">
                      원본 비율 그대로 표시됩니다
                    </span>
                  </div>
                )}
              </div>

              {/* Upload or URL Controls */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    className={`px-3 py-1 rounded transition-colors ${
                      imageInputMode === 'upload'
                        ? 'bg-neutral-900 text-white font-medium'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    파일 업로드
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    className={`px-3 py-1 rounded transition-colors ${
                      imageInputMode === 'url'
                        ? 'bg-neutral-900 text-white font-medium'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    웹 이미지 URL 입력
                  </button>
                </div>

                {imageInputMode === 'upload' ? (
                  <div>
                    <div
                      onClick={() => !isProcessingImage && fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        const files = e.dataTransfer.files;
                        if (!files || files.length === 0) return;
                        if (files.length > 1) {
                          setMultiDropAlert(files.length);
                        }
                        processImageFile(files[0]);
                      }}
                      className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-all ${
                        isDraggingOver
                          ? 'border-neutral-800 bg-neutral-100 scale-[0.99]'
                          : 'border-neutral-300 hover:border-neutral-500 bg-neutral-50/50 hover:bg-neutral-50'
                      } ${isProcessingImage ? 'opacity-70 pointer-events-none' : ''}`}
                    >
                      {isProcessingImage ? (
                        <div className="py-2">
                          <div className="w-5 h-5 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-xs font-medium text-neutral-800">
                            고해상도 회화 사진 최적화 중...
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            원본 가로·세로 비율을 100% 보존합니다
                          </p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mx-auto mb-1.5 text-neutral-500" />
                          <p className="text-xs font-medium text-neutral-700">
                            컴퓨터에서 회화 사진 선택 또는 파일 끌어다 놓기
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            JPG, PNG, WEBP, HEIC 지원 · 원본 비율 자동 보존
                          </p>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        id="artwork-image-file-input"
                        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.tiff,.tif,.bmp,.avif"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    {multiDropAlert && (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 flex items-center justify-between gap-2 mt-2">
                        <span>💡 사진 {multiDropAlert}장이 감지되었습니다. 1번째 사진이 등록되며, 여러 장을 한꺼번에 등록하시려면 일괄 등록을 이용해주세요.</span>
                        {onOpenBatchUpload && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenBatchUpload();
                            }}
                            className="px-2 py-0.5 bg-blue-900 text-white rounded text-[11px] font-medium hover:bg-blue-800 shrink-0"
                          >
                            일괄 등록 열기 →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      id="artwork-image-url-input"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        if (errors.imageUrl) setErrors((prev) => ({ ...prev, imageUrl: '' }));
                      }}
                      placeholder="https://example.com/artwork.jpg"
                      className="w-full px-3 py-2 text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-800"
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      외부 고화질 이미지 URL을 직접 입력할 수 있습니다.
                    </p>
                  </div>
                )}

                {errors.imageUrl && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.imageUrl}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Code Generation & Title */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-neutral-100">
            {/* Artwork Code with Auto-Generator */}
            <div className="md:col-span-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700 uppercase tracking-wider flex items-center gap-1">
                  작품번호 (Artwork Code) <span className="text-red-500">*</span>
                </label>
                {!isEditing ? (
                  <button
                    type="button"
                    id="auto-generate-code-btn"
                    onClick={handleAutoGenerateCode}
                    className="text-[11px] font-medium text-neutral-700 hover:text-neutral-950 flex items-center gap-1 underline underline-offset-2"
                    title="현재 연도, 캔버스 규격, 재료 기준으로 고유 번호 자동 생성"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    규칙 자동 생성
                  </button>
                ) : (
                  <span className="text-[11px] font-mono-code text-neutral-400">
                    기존 번호 영구 보존
                  </span>
                )}
              </div>

              <input
                type="text"
                id="artwork-code-input"
                value={code}
                disabled={isEditing}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: 26030PA-01,014"
                className={`w-full px-3 py-2 font-mono-code text-sm font-semibold tracking-wide border rounded focus:outline-none ${
                  isEditing
                    ? 'bg-neutral-100 text-neutral-600 border-neutral-200 cursor-not-allowed'
                    : codeFeedback.isDuplicate
                    ? 'border-red-500 bg-red-50/40 text-red-900'
                    : 'border-neutral-200 focus:border-neutral-900 text-neutral-900 bg-neutral-50/30'
                }`}
              />

              <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                {isEditing ? (
                  <span className="text-neutral-500 font-mono-code">
                    ※ 기존 등록 작품의 작품번호는 도록 및 아카이브 식별 무결성을 위해 수정되지 않습니다.
                  </span>
                ) : (
                  <>
                    <span>규칙: [YY][호수규격][재료]-[연도별누적2자리],[전체누적3자리]</span>
                    {!codeFeedback.isDuplicate && code && (
                      <span className="text-emerald-700 flex items-center gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> 고유 번호 확인됨
                      </span>
                    )}
                  </>
                )}
              </div>

              {codeFeedback.isDuplicate && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {codeFeedback.message}
                </p>
              )}
              {errors.code && !codeFeedback.isDuplicate && (
                <p className="text-xs text-red-600">{errors.code}</p>
              )}
            </div>

            {/* Artwork Title */}
            <div className="md:col-span-6 space-y-1.5">
              <label className="text-xs font-medium text-neutral-700 uppercase tracking-wider block">
                작품 제목 (Title) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="artwork-title-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                }}
                placeholder="예: 침묵의 결, 2025, 30P, Acrylic"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded focus:outline-none focus:border-neutral-900 font-serif-title"
              />

              {/* Smart auto-split suggestion when user enters or pastes comma-separated artwork data */}
              {titleParsedInfo && (
                <div
                  id="title-parsed-suggestion"
                  className="p-2.5 bg-amber-50 border border-amber-200/90 rounded text-xs text-amber-900 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-amber-950">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>쉼표(,) 구분 감지: 필드 자동 분리</span>
                    </div>
                    <button
                      type="button"
                      id="apply-title-parsed-btn"
                      onClick={() => applyParsedArtworkInfo(titleParsedInfo, '제목 텍스트')}
                      className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      각 필드에 자동 분리 적용
                    </button>
                  </div>
                  <div className="text-[11px] text-amber-800 flex flex-wrap gap-x-2.5 gap-y-0.5">
                    <span>제목: <strong>{titleParsedInfo.title}</strong></span>
                    {titleParsedInfo.year && <span>연도: <strong>{titleParsedInfo.year}년</strong></span>}
                    {titleParsedInfo.canvasSizeCode && (
                      <span>
                        규격: <strong>{titleParsedInfo.canvasSizeCode}</strong>
                        {titleParsedInfo.widthCm && titleParsedInfo.heightCm && ` (${titleParsedInfo.widthCm}×${titleParsedInfo.heightCm}cm)`}
                      </span>
                    )}
                    {titleParsedInfo.material && <span>재료: <strong>{titleParsedInfo.material}</strong></span>}
                  </div>
                </div>
              )}

              {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
            </div>
          </div>

          {/* Section 3: Canvas Size, Width, Height, Material, Year */}
          <div className="space-y-3 pt-2 border-t border-neutral-100">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div>
                <label className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  캔버스 규격 (Canvas Size & Orientation)
                </label>
                <p className="text-[11px] text-neutral-500">
                  각 호칭마다 <strong className="text-neutral-700">가로형·세로형 2가지 단추</strong> 제공 (선택 시 치수 자동 적용)
                </p>
              </div>
              <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                표준 F · P · M · S 전 규격 지원
              </span>
            </div>

            {/* Quick selector with category tabs & 2 buttons per size */}
            <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/90 space-y-2.5">
              {/* Category Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-neutral-200/70">
                <span className="text-[11px] font-medium text-neutral-500 mr-1 whitespace-nowrap">규격 분류:</span>
                <button
                  type="button"
                  onClick={() => setCanvasCategoryTab('popular')}
                  className={`px-2.5 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                    canvasCategoryTab === 'popular'
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  주요 호수 (11종)
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasCategoryTab('10-30')}
                  className={`px-2.5 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                    canvasCategoryTab === '10-30'
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  10호 ~ 30호
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasCategoryTab('40-120')}
                  className={`px-2.5 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                    canvasCategoryTab === '40-120'
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  40호 ~ 120호 (대작)
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasCategoryTab('0-8')}
                  className={`px-2.5 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${
                    canvasCategoryTab === '0-8'
                      ? 'bg-neutral-900 text-white font-medium'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  0호 ~ 8호 (소품)
                </button>
              </div>

              {/* Grid of Sizes - Each size has 2 buttons (가로형 / 세로형) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                {CANVAS_GROUPS[canvasCategoryTab].map((codeItem) => {
                  const c = CANVAS_SIZES.find((s) => s.code.toUpperCase() === codeItem.toUpperCase());
                  if (!c) return null;

                  const longSide = Math.max(c.widthCm, c.heightCm);
                  const shortSide = Math.min(c.widthCm, c.heightCm);
                  const isCurrentSize = canvasSizeCode.toUpperCase() === c.code.toUpperCase();
                  const isLandscapeActive =
                    isCurrentSize &&
                    Number(widthCm) === longSide &&
                    Number(heightCm) === shortSide;
                  const isPortraitActive =
                    isCurrentSize &&
                    Number(widthCm) === shortSide &&
                    Number(heightCm) === longSide;

                  return (
                    <div
                      key={c.code}
                      className={`p-1.5 rounded-md border transition-all ${
                        isCurrentSize
                          ? 'bg-white border-neutral-900 shadow-2xs'
                          : 'bg-white/80 border-neutral-200/90 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] px-1 pb-1 mb-1 border-b border-neutral-100">
                        <span className="font-mono-code font-bold text-neutral-900">{c.code}</span>
                        <span className="text-[10px] text-neutral-500 truncate max-w-[65px]">{c.typeName}</span>
                      </div>

                      {c.type === 'S' ? (
                        <button
                          type="button"
                          onClick={() => handleSelectStandardCanvas(c.code, 'landscape')}
                          className={`w-full py-1 px-1.5 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
                            isCurrentSize
                              ? 'bg-neutral-900 text-white'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                          }`}
                          title={`${c.code} 정방형: ${c.widthCm} × ${c.heightCm} cm`}
                        >
                          <span className="text-[10px] opacity-80">▣ 정방</span>
                          <span className="font-mono-code font-semibold">{c.widthCm}×{c.heightCm}</span>
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-1">
                          {/* 단추 1: 가로형 */}
                          <button
                            type="button"
                            onClick={() => handleSelectStandardCanvas(c.code, 'landscape')}
                            className={`py-1 px-1 rounded text-[10px] font-medium transition-all flex flex-col items-center justify-center ${
                              isLandscapeActive
                                ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                                : 'bg-neutral-100/90 hover:bg-neutral-200 text-neutral-700'
                            }`}
                            title={`${c.code} 가로형: ${longSide} × ${shortSide} cm`}
                          >
                            <span className="text-[10px] flex items-center gap-0.5 opacity-90">▤ 가로</span>
                            <span className="font-mono-code text-[10px] font-medium leading-tight">{longSide}×{shortSide}</span>
                          </button>

                          {/* 단추 2: 세로형 */}
                          <button
                            type="button"
                            onClick={() => handleSelectStandardCanvas(c.code, 'portrait')}
                            className={`py-1 px-1 rounded text-[10px] font-medium transition-all flex flex-col items-center justify-center ${
                              isPortraitActive
                                ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                                : 'bg-neutral-100/90 hover:bg-neutral-200 text-neutral-700'
                            }`}
                            title={`${c.code} 세로형: ${shortSide} × ${longSide} cm`}
                          >
                            <span className="text-[10px] flex items-center gap-0.5 opacity-90">▥ 세로</span>
                            <span className="font-mono-code text-[10px] font-medium leading-tight">{shortSide}×{longSide}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Full standard sizes dropdown */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200/70 text-xs">
                <span className="text-[11px] text-neutral-500">기타 전체 규격표 (가로/세로):</span>
                <select
                  aria-label="전체 호수 규격표 (가로/세로 선택)"
                  value={`${canvasSizeCode}:${Number(widthCm) >= Number(heightCm) ? 'landscape' : 'portrait'}`}
                  onChange={(e) => {
                    const [cCode, cOrient] = e.target.value.split(':');
                    if (cCode) {
                      handleSelectStandardCanvas(cCode, cOrient as 'landscape' | 'portrait');
                    }
                  }}
                  className="text-xs bg-white border border-neutral-300 rounded px-2.5 py-1 text-neutral-800 cursor-pointer max-w-[320px]"
                >
                  <option value="">전체 규격표에서 직접 선택...</option>
                  {CANVAS_SIZES.map((c) => {
                    if (c.type === 'S') {
                      return (
                        <option key={`${c.code}:square`} value={`${c.code}:square`}>
                          {c.code} 정방형 ({c.widthCm}×{c.heightCm}cm · {c.typeName})
                        </option>
                      );
                    }
                    const longSide = Math.max(c.widthCm, c.heightCm);
                    const shortSide = Math.min(c.widthCm, c.heightCm);
                    return (
                      <React.Fragment key={c.code}>
                        <option value={`${c.code}:landscape`}>
                          {c.code} 가로형 ({longSide}×{shortSide}cm · {c.typeName})
                        </option>
                        <option value={`${c.code}:portrait`}>
                          {c.code} 세로형 ({shortSide}×{longSide}cm · {c.typeName})
                        </option>
                      </React.Fragment>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Current Orientation Status & Quick Swap Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-100/90 rounded-md border border-neutral-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-neutral-600 font-medium text-[11px]">방향 상태:</span>
                {(() => {
                  const numW = Number(widthCm);
                  const numH = Number(heightCm);
                  if (!numW || !numH) return <span className="text-neutral-400">치수 미설정</span>;
                  if (Math.abs(numW - numH) < 0.1) {
                    return (
                      <span className="inline-flex items-center gap-1 font-semibold text-purple-800 bg-purple-100/70 border border-purple-200 px-2 py-0.5 rounded text-[11px]">
                        ▣ 정방형 (Square · {numW} × {numH} cm)
                      </span>
                    );
                  }
                  if (numW > numH) {
                    return (
                      <span className="inline-flex items-center gap-1 font-semibold text-sky-900 bg-sky-100/80 border border-sky-200 px-2 py-0.5 rounded text-[11px]">
                        ▤ 가로형 (Landscape · {numW} × {numH} cm)
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-900 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                      ▥ 세로형 (Portrait · {numW} × {numH} cm)
                    </span>
                  );
                })()}
              </div>

              {/* Direct Swap and Switch Controls */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => handleSetCurrentOrientation('landscape')}
                  className="px-2 py-1 bg-white hover:bg-neutral-50 border border-neutral-300 rounded text-[11px] font-medium text-neutral-800 transition-colors"
                  title="긴 변을 가로 치수로 자동 전환"
                >
                  ▤ 가로형 전환
                </button>
                <button
                  type="button"
                  onClick={() => handleSetCurrentOrientation('portrait')}
                  className="px-2 py-1 bg-white hover:bg-neutral-50 border border-neutral-300 rounded text-[11px] font-medium text-neutral-800 transition-colors"
                  title="긴 변을 세로 치수로 자동 전환"
                >
                  ▥ 세로형 전환
                </button>
                <button
                  type="button"
                  id="swap-dimensions-btn"
                  onClick={handleSwapOrientation}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[11px] font-medium transition-colors shadow-2xs cursor-pointer"
                  title="현재 가로 치수와 세로 치수를 즉시 맞바꿉니다"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>가로 ↔ 세로 맞바꾸기</span>
                </button>
              </div>
            </div>

            {/* Manual Dimensions Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Canvas Size Code Input */}
              <div>
                <label className="block text-xs text-neutral-600 mb-1">Canvas Size Code</label>
                <input
                  type="text"
                  id="artwork-canvas-size-code-input"
                  value={canvasSizeCode}
                  onChange={(e) => setCanvasSizeCode(e.target.value.toUpperCase())}
                  placeholder="예: 030P, 100F"
                  className="w-full px-3 py-1.5 font-mono-code text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900"
                />
              </div>

              {/* Width cm */}
              <div>
                <label className="block text-xs text-neutral-600 mb-1">
                  가로(cm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="artwork-width-cm-input"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 font-mono-code text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900"
                />
                {errors.widthCm && <p className="text-[11px] text-red-600 mt-0.5">{errors.widthCm}</p>}
              </div>

              {/* Height cm */}
              <div>
                <label className="block text-xs text-neutral-600 mb-1">
                  세로(cm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  id="artwork-height-cm-input"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 font-mono-code text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900"
                />
                {errors.heightCm && <p className="text-[11px] text-red-600 mt-0.5">{errors.heightCm}</p>}
              </div>
            </div>
          </div>

          {/* Section 4: Material & Year & Display Order & Featured */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-neutral-100">
            {/* Material */}
            <div className="sm:col-span-4 space-y-1">
              <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider">
                재료 (Material) <span className="text-red-500">*</span>
              </label>
              <select
                id="artwork-material-select"
                value={material}
                onChange={(e) => {
                  const m = e.target.value as MaterialType;
                  setMaterial(m);
                  if (!isEditing) {
                    const next = generateNextArtworkCode(
                      year,
                      canvasSizeCode,
                      m,
                      existingArtworks,
                      artworkToEdit?.id
                    );
                    setCode(next);
                  }
                }}
                className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded bg-white focus:outline-none focus:border-neutral-900"
              >
                <option value="Acrylic">Acrylic (A · 아크릴릭)</option>
                <option value="Oil">Oil (O · 유화)</option>
                <option value="Mixed">Mixed (M · 혼합재료)</option>
              </select>
            </div>

            {/* Year */}
            <div className="sm:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider">
                제작연도 (Year) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="artwork-year-input"
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value) || 2026;
                  setYear(y);
                  if (!isEditing) {
                    const next = generateNextArtworkCode(
                      y,
                      canvasSizeCode,
                      material,
                      existingArtworks,
                      artworkToEdit?.id
                    );
                    setCode(next);
                  }
                }}
                className="w-full px-3 py-1.5 font-mono-code text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900"
              />
            </div>

            {/* Display Order */}
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider">
                전시 순서
              </label>
              <input
                type="number"
                id="artwork-display-order-input"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value) || 1)}
                className="w-full px-3 py-1.5 font-mono-code text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900"
              />
            </div>

            {/* Featured */}
            <div className="sm:col-span-3 flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800 select-none">
                <input
                  type="checkbox"
                  id="artwork-is-featured-checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-0 cursor-pointer"
                />
                <span>대표작으로 지정 (Featured)</span>
              </label>
            </div>
          </div>

          {/* Section 5: Description / Artist Note */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100">
            <label className="block text-xs font-medium text-neutral-700 uppercase tracking-wider">
              작품 특징 및 설명 (특징, 의미, 제작 배경, 전시 설명, 기타 메모)
            </label>
            <textarea
              id="artwork-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작품의 특징, 의미, 제작 배경, 전시 설명, 기타 메모 등을 자유롭게 입력하세요. (입력 시 개별 작품 화면에 표시됩니다)"
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded focus:outline-none focus:border-neutral-900 font-kr-serif leading-relaxed"
            />
          </div>

          {/* Footer Error Summary Banner */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>작품 등록에 필요한 항목을 확인해주세요:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-700 pl-1">
                {errors.imageUrl && <li><strong>작품 이미지</strong>: {errors.imageUrl}</li>}
                {errors.title && <li><strong>작품 제목</strong>: {errors.title}</li>}
                {errors.code && <li><strong>작품번호</strong>: {errors.code}</li>}
                {errors.widthCm && <li><strong>가로 크기</strong>: {errors.widthCm}</li>}
                {errors.heightCm && <li><strong>세로 크기</strong>: {errors.heightCm}</li>}
              </ul>
            </div>
          )}

          {/* If code is duplicate, prompt user with 1-click auto-generation */}
          {codeFeedback.isDuplicate && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>작품번호 <strong>[{code}]</strong>가 이미 사용 중입니다.</span>
              </div>
              <button
                type="button"
                onClick={handleAutoGenerateCode}
                className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-medium hover:bg-neutral-800 shrink-0 transition-colors"
              >
                새 번호 자동 발급 →
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="border-t border-neutral-200 pt-4 flex items-center justify-between gap-2.5">
            <div className="text-[11px] text-neutral-400">
              <span className="text-red-500">*</span> 표시는 필수 입력 항목입니다.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="artwork-form-cancel-btn"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                id="artwork-form-submit-btn"
                disabled={isProcessingImage}
                className="px-5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 rounded shadow-xs transition-all active:scale-[0.99] flex items-center gap-1.5"
              >
                {isProcessingImage ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>이미지 처리 중...</span>
                  </>
                ) : isEditing ? (
                  '작품 정보 저장'
                ) : (
                  '작품 등록 완료'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
