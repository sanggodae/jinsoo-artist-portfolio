import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  LogIn,
  LogOut,
  CheckCircle2,
  Lock,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  UploadCloud,
  Database,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { loadArtworksFromIndexedDB, loadArtworksFromStorage } from '../utils/storage';
import { checkArtworkExistsInFirestore, migrateArtworkToFirestoreWithSkip } from '../services/firestoreService';
import { uploadBlobToStorage, getArtworkStoragePaths } from '../services/storageService';
import { isUnauthorizedDomainError, getFriendlyAuthErrorMessage } from '../services/authService';
import { Artwork } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    isAdmin,
    isLoading,
    isIframe,
    loginWithEmail,
    loginWithGoogle,
    loginWithGooglePopup,
    logout,
    refreshAdminStatus,
    redirectError,
    clearRedirectError,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPopupLoading, setIsPopupLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [tokenClaims, setTokenClaims] = useState<Record<string, unknown> | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    running: boolean;
    step: string;
    artworksList?: Artwork[];
    firstArtwork?: Artwork;
    error?: string;
    finished?: boolean;
  }>({ running: false, step: '' });

  // Read-only inspection of IndexedDB artworks_store / artworks_list
  // STRICT: Absolutely NO writes to Firestore, Storage, or IndexedDB
  const handleInspectIndexedDB = useCallback(async () => {
    setSyncStatus({ running: true, step: 'IndexedDB (artworks_store / artworks_list) 읽기 진행 중...' });
    try {
      // 1. Strictly read from IndexedDB directly via IDB API without fallback to INITIAL_ARTWORKS
      let list: Artwork[] | null = null;
      if (typeof window !== 'undefined' && window.indexedDB) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = window.indexedDB.open('ARTWORK_MANAGEMENT_INDEXED_DB', 1);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('IndexedDB 열기 실패'));
        });

        if (db.objectStoreNames.contains('artworks_store')) {
          list = await new Promise<Artwork[] | null>((resolve) => {
            const tx = db.transaction('artworks_store', 'readonly');
            const store = tx.objectStore('artworks_store');
            const req = store.get('artworks_list');
            req.onsuccess = () => {
              const val = req.result;
              if (Array.isArray(val) && val.length > 0) {
                resolve(val);
              } else {
                resolve(null);
              }
            };
            req.onerror = () => resolve(null);
          });
        }
      }

      // 2. If IndexedDB was empty, check localStorage strictly
      if (!list || list.length === 0) {
        const raw = localStorage.getItem('ARTWORK_MANAGEMENT_DB_V1');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              list = parsed;
            }
          } catch (e) {
            console.error(e);
          }
        }
      }

      if (!list || list.length === 0) {
        throw new Error('IndexedDB (artworks_store/artworks_list)에 저장된 실제 작품 데이터가 비어있습니다.');
      }

      console.log('======================================================');
      console.log(`[IndexedDB INSPECTION] Found ${list.length} artworks in artworks_store / artworks_list:`);
      list.slice(0, 5).forEach((art, idx) => {
        console.log(`  #${idx + 1} | ID: ${art.id} | Code: ${art.code} | Title: ${art.title}`);
      });
      console.log('======================================================');

      fetch('/api/indexeddb/log-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Browser IndexedDB: artworks_store / artworks_list',
          totalCount: list.length,
          artworks: list.slice(0, 5).map(({ id, code, title, canvasSizeCode, material, year }) => ({
            id,
            code,
            title,
            canvasSizeCode,
            material,
            year,
          })),
        }),
      }).catch(() => {});

      const firstArt = list[0];
      setSyncStatus({
        running: false,
        step: `성공: 실제 IndexedDB 저장소에서 총 ${list.length}개의 작품을 안전하게 읽었습니다.`,
        artworksList: list,
        firstArtwork: firstArt,
        finished: true,
      });
    } catch (err: any) {
      console.error('IndexedDB inspection error:', err);
      setSyncStatus({
        running: false,
        step: `조회 실패: ${err.message || 'IndexedDB 읽기 오류'}`,
        error: err.message,
        finished: true,
      });
    }
  }, []);

  // Auto-run inspection when modal is opened
  useEffect(() => {
    if (isOpen) {
      handleInspectIndexedDB();
    }
  }, [isOpen, handleInspectIndexedDB]);

  // Fetch fresh claims directly from current user
  const fetchCurrentClaims = useCallback(async () => {
    if (!user) {
      setTokenClaims(null);
      return;
    }
    try {
      const tokenResult = await user.getIdTokenResult(true);
      setTokenClaims(tokenResult.claims || {});
    } catch (err) {
      console.error('[AdminLoginModal] Failed to fetch ID token claims:', err);
    }
  }, [user]);

  // When modal opens, refresh admin status in the background if a user is logged in
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setInfoMsg(null);
      setIsUnauthorizedDomain(false);
      clearRedirectError();
      if (user) {
        refreshAdminStatus();
        fetchCurrentClaims();
      }
    }
  }, [isOpen, user, refreshAdminStatus, clearRedirectError, fetchCurrentClaims]);

  // Reset popup loading state whenever user state transitions to authenticated
  useEffect(() => {
    if (user && isPopupLoading) {
      setIsPopupLoading(false);
    }
  }, [user, isPopupLoading]);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHost = (host: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(host);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2500);
    }
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  const handleGooglePopup = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsUnauthorizedDomain(false);
    clearRedirectError();
    setIsPopupLoading(true);
    try {
      const loggedUser = await loginWithGooglePopup();
      if (loggedUser) {
        // Non-blocking background call to bootstrap server claims with short timeout
        if (loggedUser.email?.toLowerCase().trim() === 'jinsoop10@gmail.com') {
          loggedUser.getIdToken(false).then((idToken) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            fetch('/api/admin/bootstrap', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              signal: controller.signal,
            })
              .catch(() => {})
              .finally(() => clearTimeout(timeoutId));
          }).catch(() => {});
        }
        await refreshAdminStatus();
        await fetchCurrentClaims();
      }
    } catch (err: unknown) {
      if (isUnauthorizedDomainError(err)) {
        setIsUnauthorizedDomain(true);
        setErrorMsg(getFriendlyAuthErrorMessage(err));
      } else if (err instanceof Error) {
        // If popup was closed or blocked, provide direct guidance
        if (err.message.includes('popup-closed-by-user')) {
          setErrorMsg('브라우저에서 팝업이 차단되었거나 로그인 창이 닫혔습니다. 아래 [새 창(새 탭)에서 열기] 버튼을 이용하시면 팝업 차단 없이 즉시 로그인할 수 있습니다.');
        } else {
          setErrorMsg(getFriendlyAuthErrorMessage(err));
        }
      } else {
        setErrorMsg('Google 로그인 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsPopupLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setIsUnauthorizedDomain(false);
    clearRedirectError();

    // If inside an iframe, warn that accounts.google.com blocks iframe redirect
    if (isIframe) {
      setErrorMsg('AI Studio Preview(iframe) 내부에서는 보안상 Google 로그인 페이지로의 직접 리디렉션이 브라우저에 의해 차단됩니다. [새 창(새 탭)에서 열기]를 클릭하여 독립 창에서 진행해 주세요.');
      return;
    }

    setIsRedirecting(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setIsRedirecting(false);
      if (isUnauthorizedDomainError(err)) {
        setIsUnauthorizedDomain(true);
        setErrorMsg(getFriendlyAuthErrorMessage(err));
      } else if (err instanceof Error) {
        setErrorMsg(getFriendlyAuthErrorMessage(err));
      } else {
        setErrorMsg('Google 로그인 페이지로 이동하는 중 오류가 발생했습니다.');
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    clearRedirectError();
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      // Success will update the user state via onAuthStateChanged
    } catch (err: unknown) {
      if (isUnauthorizedDomainError(err)) {
        setIsUnauthorizedDomain(true);
        setErrorMsg(getFriendlyAuthErrorMessage(err));
      } else if (err instanceof Error) {
        setErrorMsg(getFriendlyAuthErrorMessage(err));
      } else {
        setErrorMsg('로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshClaims = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      if (user && user.email?.toLowerCase().trim() === 'jinsoop10@gmail.com') {
        try {
          const idToken = await user.getIdToken(false);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          await fetch('/api/admin/bootstrap', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            signal: controller.signal,
          }).catch(() => {}).finally(() => clearTimeout(timeoutId));
        } catch (bootstrapErr) {
          console.warn('[AdminBootstrap] Server claim sync notice:', bootstrapErr);
        }
      }
      const isNowAdmin = await refreshAdminStatus();
      await fetchCurrentClaims();
      if (isNowAdmin) {
        setInfoMsg('관리자 계정 (jinsoop10@gmail.com, 인증 완료) 권한이 성공적으로 확인되었습니다!');
      } else {
        setErrorMsg('관리자 권한 확인 실패: jinsoop10@gmail.com 계정으로 로그인되어 있으며 이메일 인증(email_verified)이 완료되었는지 확인해 주세요.');
      }
    } catch {
      setErrorMsg('권한 상태 확인 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const activeError = redirectError || errorMsg;
  const isUnauthorizedDomainActive =
    isUnauthorizedDomain ||
    isUnauthorizedDomainError(errorMsg) ||
    isUnauthorizedDomainError(redirectError);

  return (
    <div
      id="admin-auth-modal-backdrop"
      className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="admin-auth-modal-container"
        className="relative w-full max-w-md bg-white border border-neutral-300 rounded-sm shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'}`}>
              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] tracking-widest uppercase font-mono-code text-neutral-400">
                FIREBASE AUTHENTICATION
              </span>
              <h2 className="text-base font-serif-title font-medium text-neutral-900">
                {user ? '관리자 인증 계정 관리' : '작가 전용 관리자 로그인'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading && !user ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
              <p className="text-xs font-medium text-neutral-600">Firebase 인증 상태 확인 중...</p>
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className={`p-4 rounded border ${isAdmin ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isAdmin ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-xs text-emerald-900">
                        관리자 권한 승인됨 (jinsoop10@gmail.com, 이메일 인증 완료)
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-xs text-amber-900">
                        관리자 권한 없음 (일반 방문자 상태)
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-neutral-600">
                  <p className="break-all">
                    로그인된 계정: <strong className="text-neutral-900">{user.email || user.displayName || '(계정 정보)'}</strong>
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-neutral-500 font-mono-code">Firebase UID:</span>
                    <code className="text-[11px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800 font-mono-code break-all select-all">
                      {user.uid}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUid}
                      title="UID 복사"
                      className="p-1 text-neutral-500 hover:text-neutral-800 rounded transition-colors"
                    >
                      {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="mt-3 pt-2 border-t border-emerald-200 space-y-2">
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      Google 계정(jinsoop10@gmail.com)으로 정상 인증되어 관리자 권한이 활성화되었습니다. 모든 작품의 등록·수정·삭제 및 전시 관리가 가능합니다.
                    </p>

                    {/* IndexedDB Artworks Read-Only Inspector Card */}
                    <div className="p-3 bg-white border border-emerald-300 rounded text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900 text-[11px] flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-emerald-700" />
                          IndexedDB 실제 작품 13개 조회 및 첫 번째 작품 확인
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono-code bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                          읽기 전용 (무손실)
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-600 leading-relaxed">
                        IndexedDB (<code className="font-mono text-[10px] bg-neutral-100 px-1 py-0.5 rounded">artworks_store / artworks_list</code>)에 실제로 저장된 데이터만 직접 조회합니다. 샘플 데이터(INITIAL_ARTWORKS)는 완전히 배제되며 Firestore/Storage/IndexedDB에 어떠한 데이터도 쓰지 않습니다.
                      </p>

                      {syncStatus.step && (
                        <div
                          className={`p-2.5 rounded text-[11px] border leading-relaxed ${
                            syncStatus.error
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : syncStatus.finished
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            {syncStatus.running ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0 mt-0.5" />
                            ) : syncStatus.error ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1.5 min-w-0 w-full">
                              <p className="font-medium break-all">{syncStatus.step}</p>

                              {/* First Artwork Highlight */}
                              {syncStatus.firstArtwork && (
                                <div className="p-2 bg-white/90 border border-emerald-300 rounded text-[11px] space-y-1">
                                  <div className="font-semibold text-emerald-950 flex items-center gap-1">
                                    <span>🎯 테스트 대상 (실제 첫 번째 작품):</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono-code text-neutral-700">
                                    <div>ID: <strong className="text-neutral-900">{syncStatus.firstArtwork.id}</strong></div>
                                    <div>Code: <strong className="text-neutral-900">{syncStatus.firstArtwork.code}</strong></div>
                                    <div className="col-span-2">제목: <strong className="text-neutral-900">{syncStatus.firstArtwork.title}</strong></div>
                                    <div>규격: {syncStatus.firstArtwork.widthCm} × {syncStatus.firstArtwork.heightCm} cm ({syncStatus.firstArtwork.canvasSizeCode})</div>
                                    <div>재료: {syncStatus.firstArtwork.material} ({syncStatus.firstArtwork.year}년)</div>
                                  </div>
                                </div>
                              )}

                              {/* Top 5 Artworks for Verification */}
                              {syncStatus.artworksList && (
                                <div className="space-y-1.5 pt-1.5 border-t border-emerald-200/80">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-neutral-800 flex items-center gap-1">
                                      <span>📋 상위 5개 작품 (ID, Code, Title):</span>
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono-code">총 {syncStatus.artworksList.length}건 중 1~5번</span>
                                  </div>
                                  <div className="border border-neutral-300 bg-white rounded overflow-hidden shadow-xs">
                                    <table className="w-full text-left text-[10px] border-collapse">
                                      <thead>
                                        <tr className="bg-neutral-100 text-neutral-600 font-semibold border-b border-neutral-200">
                                          <th className="py-1 px-2 text-center w-8">#</th>
                                          <th className="py-1 px-2 font-mono">ID</th>
                                          <th className="py-1 px-2 font-mono">작품번호 (Code)</th>
                                          <th className="py-1 px-2">작품 제목 (Title)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-neutral-100">
                                        {syncStatus.artworksList.slice(0, 5).map((art, idx) => (
                                          <tr key={art.id} className={idx === 0 ? 'bg-amber-50/70 font-semibold text-amber-950' : 'hover:bg-neutral-50'}>
                                            <td className="py-1 px-2 text-center text-neutral-400">{idx + 1}</td>
                                            <td className="py-1 px-2 font-mono text-neutral-600">{art.id}</td>
                                            <td className="py-1 px-2 font-mono text-blue-700">{art.code}</td>
                                            <td className="py-1 px-2 text-neutral-900 truncate max-w-[160px]">{art.title}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* All Artworks List in IndexedDB */}
                              {syncStatus.artworksList && syncStatus.artworksList.length > 5 && (
                                <div className="space-y-1 pt-1 border-t border-neutral-200">
                                  <div className="text-[10px] font-semibold text-neutral-600 flex justify-between">
                                    <span>전체 저장 목록 (6번 ~ {syncStatus.artworksList.length}번):</span>
                                    <span className="font-mono text-[9px] text-neutral-400">artworks_list</span>
                                  </div>
                                  <div className="max-h-24 overflow-y-auto space-y-0.5 border border-neutral-200 bg-neutral-50 rounded p-1 font-mono-code text-[10px]">
                                    {syncStatus.artworksList.slice(5).map((art, idx) => (
                                      <div
                                        key={art.id}
                                        className="flex items-center justify-between p-0.5 rounded hover:bg-white text-neutral-600"
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="text-neutral-400 w-4 text-right shrink-0">{idx + 6}.</span>
                                          <span className="text-blue-700 shrink-0">{art.code}</span>
                                          <span className="truncate text-neutral-700 font-sans">{art.title}</span>
                                        </div>
                                        <span className="text-[9px] text-neutral-400 shrink-0 ml-2 font-mono">
                                          {art.id}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        id="inspect-indexeddb-btn"
                        onClick={handleInspectIndexedDB}
                        disabled={syncStatus.running}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>
                          {syncStatus.running
                            ? 'IndexedDB 작품 데이터 읽는 중...'
                            : 'IndexedDB 실제 작품 13개 읽기 및 첫 번째 대상 확인'}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full mt-2 py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-medium transition-colors"
                    >
                      관리자 모드로 계속 작업하기
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-amber-200/80 space-y-2">
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      현재 로그인된 계정은 관리자(jinsoop10@gmail.com, 이메일 인증 완료) 조건과 일치하지 않습니다. jinsoop10@gmail.com 계정으로 재로그인하시거나 아래 [권한 상태 새로고침]을 눌러주세요.
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleRefreshClaims}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? '확인 중...' : '권한 상태 새로고침'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 6-Point Live Verification Box */}
              <div className="p-3.5 bg-neutral-50 rounded border border-neutral-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800 text-[11px] uppercase tracking-wider">
                    관리자 권한 6대 점검 결과
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {isAdmin ? '관리자 승인' : '권한 미부여'}
                  </span>
                </div>

                <div className="space-y-2 bg-white p-2.5 rounded border border-neutral-200 text-[11px]">
                  <div className="flex justify-between items-start gap-2 border-b border-neutral-100 pb-1.5">
                    <span className="text-neutral-500 shrink-0">1. 로그인 사용자 이메일</span>
                    <strong className="text-neutral-900 break-all text-right font-mono-code">{user.email || '(이메일 없음)'}</strong>
                  </div>

                  <div className="flex justify-between items-start gap-2 border-b border-neutral-100 pb-1.5">
                    <span className="text-neutral-500 shrink-0">2. Firebase UID</span>
                    <code className="text-neutral-700 break-all text-right font-mono-code text-[10px]">{user.uid}</code>
                  </div>

                  <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                    <span className="text-neutral-500">3. 이메일 인증 (email_verified)</span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${user.emailVerified || tokenClaims?.email_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {user.emailVerified || tokenClaims?.email_verified ? '인증 완료 (true)' : '미인증 (false)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                    <span className="text-neutral-500">4. 단일 관리자 일치 여부</span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${user.email?.toLowerCase().trim() === 'jinsoop10@gmail.com' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {user.email?.toLowerCase().trim() === 'jinsoop10@gmail.com' ? '일치 (jinsoop10@gmail.com)' : '불일치'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-neutral-100 pb-1.5">
                    <span className="text-neutral-500">5. isAdmin() 판정 결과</span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-700'}`}>
                      {isAdmin ? 'true (관리자)' : 'false (일반 사용자)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">6. 실제 관리자 모드 활성화</span>
                    <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${isAdmin ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                      {isAdmin ? '활성화됨 (등록·수정·삭제 가능)' : '비활성화됨 (읽기 전용)'}
                    </span>
                  </div>
                </div>
              </div>

              {infoMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {activeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="space-y-1">
                    <strong className="block font-semibold">인증 오류:</strong>
                    <span>{activeError}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-neutral-300 hover:bg-neutral-50 rounded text-xs font-medium text-neutral-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-neutral-500" />
                <span>{isAdmin ? '관리자 로그아웃' : '다른 계정으로 로그인 (로그아웃)'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-neutral-600 leading-relaxed">
                일반 방문자는 로그인 없이 갤러리 작품과 포트폴리오를 자유롭게 열람하실 수 있습니다. 작품 등록·수정·삭제를 위해 관리자로 로그인해 주세요.
              </p>

              {/* Unauthorized Domain Resolution Banner */}
              {isUnauthorizedDomainActive ? (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded text-xs space-y-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-semibold text-amber-950 text-xs">
                        Firebase Authentication 승인된 도메인(Authorized Domain) 등록 필요
                      </h4>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        현재 접속 환경의 도메인이 Firebase 인증 허용 목록에 등록되지 않아 Google 로그인이 차단되었습니다.
                      </p>
                    </div>
                  </div>

                  {/* Safety Assurance Badge */}
                  <div className="p-2.5 bg-white/90 border border-amber-200 rounded text-[11px] text-neutral-700 leading-relaxed space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>기존 Firestore 데이터베이스 및 컬렉션 100% 안전 유지</span>
                    </div>
                    <p className="text-neutral-600 text-[10.5px]">
                      연결된 Firebase 프로젝트(<code className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">gen-lang-client-0635539736</code>) 및 기존 작품 데이터는 일체 변경되거나 삭제되지 않습니다. 도메인 허용 설정만 추가하시면 즉시 정상 작동합니다.
                    </p>
                  </div>

                  {/* Domain to copy */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-neutral-800">
                      Firebase 콘솔에 추가할 도메인:
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border border-amber-300 px-2.5 py-1.5 rounded text-[11px] font-mono text-neutral-900 select-all truncate">
                        {currentHost || 'ais-pre-nbrkcsb3qv3ljs4oaebcvj-536497088671.asia-east1.run.app'}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyHost(currentHost || 'ais-pre-nbrkcsb3qv3ljs4oaebcvj-536497088671.asia-east1.run.app')}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                        title="도메인 주소 복사"
                      >
                        {copiedHost ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedHost ? '복사됨' : '도메인 복사'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 3-Step Setup Instructions */}
                  <div className="space-y-1 text-[11px] text-neutral-800 bg-amber-100/60 p-2.5 rounded border border-amber-200">
                    <p className="font-semibold text-amber-950">간단 설정 3단계:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[10.5px] leading-relaxed text-neutral-700">
                      <li>위 <strong>[도메인 복사]</strong> 버튼을 클릭합니다.</li>
                      <li>아래 <strong>[Firebase 콘솔 설정 바로가기]</strong> 버튼을 클릭하여 설정 페이지로 이동합니다.</li>
                      <li><strong>[승인된 도메인] &gt; [도메인 추가]</strong>를 누르고 붙여넣은 뒤 저장합니다.</li>
                    </ol>
                  </div>

                  {/* Link Button to Firebase Console */}
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0635539736/authentication/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Firebase Console 승인된 도메인 설정 열기</span>
                  </a>
                </div>
              ) : activeError ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-rose-900">로그인 안내</p>
                    <p className="leading-relaxed">{activeError}</p>
                  </div>
                </div>
              ) : null}

              {/* Primary Method: Google Login */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-900">Google 계정 로그인</span>
                  <span className="text-[10px] text-neutral-500 bg-white px-2 py-0.5 border border-neutral-200 rounded">
                    Firebase Authentication
                  </span>
                </div>

                <button
                  type="button"
                  id="google-popup-login-btn"
                  onClick={handleGooglePopup}
                  disabled={isPopupLoading || isRedirecting || loading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-300 rounded shadow-2xs text-xs font-medium text-neutral-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isPopupLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-neutral-600" />
                      <span>Google 로그인 인증 중...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span className="font-medium">Google 계정으로 로그인</span>
                    </>
                  )}
                </button>

                {/* Open in New Window option for iframe environments */}
                {isIframe && (
                  <div className="pt-2 border-t border-neutral-200/80">
                    <button
                      type="button"
                      id="open-in-new-tab-btn"
                      onClick={handleOpenInNewTab}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200/80 rounded text-[11px] font-medium text-neutral-700 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-neutral-600" />
                      <span>새 창(독립 탭)에서 열어 로그인하기 (권장)</span>
                    </button>
                    <p className="text-[10px] text-neutral-500 mt-1 text-center">
                      AI Studio 미리보기(iframe)의 팝업/리디렉션 차단 없이 원활하게 인증됩니다.
                    </p>
                  </div>
                )}
              </div>

              {/* Secondary Method: Email & Password (Collapsible) */}
              <div className="pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowEmailLogin(!showEmailLogin)}
                  className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center justify-between w-full py-1"
                >
                  <span>이메일 / 비밀번호로 로그인 (미리보기 내부 즉시 인증)</span>
                  <span className="text-[11px] text-neutral-400">{showEmailLogin ? '▲ 접기' : '▼ 펼치기'}</span>
                </button>

                {showEmailLogin && (
                  <form onSubmit={handleEmailLogin} className="space-y-3 pt-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                        이메일 주소
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="admin@example.com"
                        className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-700 mb-1">
                        비밀번호
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs border border-neutral-300 rounded focus:border-neutral-900 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || isPopupLoading || isRedirecting}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{loading ? '인증 확인 중...' : '이메일 계정으로 로그인'}</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Host Domain Info */}
              {currentHost && (
                <div className="pt-1 text-[10px] text-neutral-400 text-center font-mono-code">
                  Host: {currentHost}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-6 py-3 bg-neutral-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
