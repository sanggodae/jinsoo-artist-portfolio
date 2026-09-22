import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export interface RedirectAuthResult {
  user: User | null;
  isAdmin: boolean;
  error: string | null;
  isRedirectResult: boolean;
}

/**
 * Checks if the current window is running inside an iframe (e.g. AI Studio preview)
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Checks if an error is caused by Firebase auth unauthorized domain restriction
 */
export function isUnauthorizedDomainError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'string') {
    return error.includes('unauthorized-domain');
  }
  const err = error as { code?: string; message?: string };
  return (
    err.code === 'auth/unauthorized-domain' ||
    Boolean(err.message && err.message.includes('unauthorized-domain'))
  );
}

/**
 * Converts Firebase Auth errors into clear, friendly Korean messages
 */
export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';
  if (typeof error === 'string') {
    if (error.includes('unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      return `현재 접속 도메인(${currentHost})이 Firebase Authentication 승인된 도메인에 등록되어 있지 않습니다. Firebase Console > Authentication > Settings > Authorized Domains에 '${currentHost}'를 추가해 주세요.`;
    }
    return error;
  }

  const err = error as { code?: string; message?: string };
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const code = err.code || '';
  const message = err.message || '';

  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain') || message.includes('unauthorized-domain')) {
    return `현재 접속 도메인(${currentHost})이 Firebase Authentication 승인된 도메인에 등록되어 있지 않습니다. Firebase Console > Authentication > Settings > Authorized Domains에 '${currentHost}'를 추가해 주세요.`;
  }

  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return '브라우저 팝업이 차단되었거나 로그인 창이 닫혔습니다. [새 탭에서 열기] 버튼을 통해 단독 창에서 진행하시거나, 아래의 이메일 로그인을 이용해 주세요.';
  }

  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  if (code === 'auth/user-disabled') {
    return '관리자에 의해 비활성화된 계정입니다.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Firebase 콘솔에서 해당 로그인 공급자(Google 또는 이메일)가 사용 설정되어 있지 않습니다.';
  }

  if (code === 'auth/network-request-failed') {
    return '네트워크 연결이 불안정합니다. 인터넷 연결 상태를 확인해 주세요.';
  }

  if (code === 'auth/redirect-cancelled-by-user') {
    return 'Google 로그인이 취소되었습니다.';
  }

  if (code === 'auth/internal-error') {
    return '인증 서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }

  return message || '인증 처리 중 오류가 발생했습니다.';
}

export const ADMIN_EMAIL = 'jinsoop10@gmail.com';

export async function checkUserIsAdmin(user: User | null, forceRefresh = false): Promise<boolean> {
  if (!user) return false;

  // 1. Direct synchronous email check: if email is jinsoop10@gmail.com, immediately true
  const userEmail = (user.email || '').toLowerCase().trim();
  if (userEmail === ADMIN_EMAIL) {
    return true;
  }

  // 2. Token claims check with forceRefresh option
  try {
    const idTokenResult = await user.getIdTokenResult(forceRefresh);
    const email = (user.email || (idTokenResult.claims.email as string) || '').toLowerCase().trim();

    // Primary admin rule: specific administrator email
    if (email === ADMIN_EMAIL) {
      return true;
    }

    // Secondary fallback: custom claim 'admin === true'
    return idTokenResult.claims.admin === true;
  } catch (err) {
    console.error('Failed to verify admin status:', err);
    if (userEmail === ADMIN_EMAIL) {
      return true;
    }
    return false;
  }
}

/**
 * Force refresh the ID token to re-check admin custom claims immediately
 */
export async function refreshAdminClaims(): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) return false;
  return checkUserIsAdmin(auth.currentUser, true);
}

export async function loginAdminWithEmail(email: string, pass: string): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, pass);
  return credential.user;
}

/**
 * Google Sign-In with Popup
 * Ideal for iframe & standard browsers.
 * Uses a robust racing pattern with onAuthStateChanged and safety timeout to guarantee resolution.
 */
export async function loginAdminWithGooglePopup(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // If already logged in, return current user immediately
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise<User>((resolve, reject) => {
    let settled = false;
    let timer: any = null;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    // 1. Parallel listener: as soon as auth detects the user from popup or storage sync, settle immediately
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !settled) {
        settled = true;
        cleanup();
        resolve(user);
      }
    });

    // 2. Call signInWithPopup
    signInWithPopup(auth, provider)
      .then((result) => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(result.user);
        }
      })
      .catch((err) => {
        // If onAuthStateChanged already settled, ignore popup close error
        if (settled) return;

        // If currentUser is already set (popup closed after completing sign-in)
        if (auth.currentUser) {
          settled = true;
          cleanup();
          resolve(auth.currentUser);
          return;
        }

        settled = true;
        cleanup();
        reject(err);
      });

    // 3. Safety timeout: prevent infinite loading if popup hangs
    timer = setTimeout(() => {
      if (!settled) {
        if (auth.currentUser) {
          settled = true;
          cleanup();
          resolve(auth.currentUser);
        } else {
          settled = true;
          cleanup();
          reject(new Error('Google 로그인 응답 대기 시간이 초과되었습니다. 팝업 차단 여부를 확인하거나 다시 시도해 주세요.'));
        }
      }
    }, 45000);
  });
}

/**
 * Initiate Google Sign-In via full-page redirect (signInWithRedirect)
 * Note: If inside an iframe, top-level redirection is blocked by accounts.google.com X-Frame-Options.
 */
export async function loginAdminWithGoogleRedirect(): Promise<void> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  sessionStorage.setItem('auth_redirect_pending', 'true');
  await signInWithRedirect(auth, provider);
}

/**
 * Handle and process the result of a signInWithRedirect operation.
 */
export async function handleRedirectResult(): Promise<RedirectAuthResult> {
  const auth = getFirebaseAuth();
  const wasPending = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('auth_redirect_pending') === 'true';
  try {
    const result = await getRedirectResult(auth);
    if (wasPending && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('auth_redirect_pending');
    }

    if (result && result.user) {
      const isAdmin = await checkUserIsAdmin(result.user, true);
      return {
        user: result.user,
        isAdmin,
        error: null,
        isRedirectResult: true,
      };
    }
    return {
      user: null,
      isAdmin: false,
      error: null,
      isRedirectResult: false,
    };
  } catch (err: unknown) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('auth_redirect_pending');
    }
    // Only surface error if user actually initiated a redirect
    if (wasPending) {
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      console.warn('[Firebase Auth] Redirect result error for pending redirect:', err);
      return {
        user: null,
        isAdmin: false,
        error: friendlyMsg,
        isRedirectResult: true,
      };
    }
    return {
      user: null,
      isAdmin: false,
      error: null,
      isRedirectResult: false,
    };
  }
}

export async function logoutAdmin(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth.currentUser;
}

export function subscribeToAuthState(
  callback: (state: AdminAuthState) => void
): () => void {
  const auth = getFirebaseAuth();

  // If currentUser is already restored synchronously by Firebase SDK, verify immediately
  if (auth.currentUser) {
    checkUserIsAdmin(auth.currentUser, false)
      .then((isAdmin) => {
        callback({ user: auth.currentUser, isAdmin, isLoading: false });
      })
      .catch(() => {
        callback({ user: auth.currentUser, isAdmin: false, isLoading: false });
      });
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isAdmin = await checkUserIsAdmin(user, false);
      callback({ user, isAdmin, isLoading: false });
    } else {
      callback({ user: null, isAdmin: false, isLoading: false });
    }
  });
}


