import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'

/**
 * Cấu hình Firebase Authentication từ các biến môi trường Vite (VITE_FIREBASE_*).
 * Các biến này được định cấu hình trong file .env của dự án.
 */
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
}

const requiredConfigFields = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
]

/**
 * Kiểm tra xem Firebase đã được thiết lập đầy đủ thông tin môi trường chưa.
 * Tránh việc khởi tạo bị sập ứng dụng nếu người dùng chưa điền key trong .env.
 */
export function getFirebaseConfigError() {
  const missingFields = requiredConfigFields
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missingFields.length) {
    return `Thiếu cấu hình Firebase trong file .env: ${missingFields.join(', ')}.`
  }

  const hasPlaceholder = requiredConfigFields.some(([, value]) => (
    /your_|example|placeholder/i.test(value)
  ))
  if (hasPlaceholder) {
    return 'Cấu hình Firebase trong file .env vẫn chứa giá trị mẫu. Hãy thay bằng cấu hình Web App của dự án NOVA SHOP.'
  }

  return ''
}

export function isFirebaseConfigured() {
  return !getFirebaseConfigError()
}

// Khởi tạo Firebase App & Auth một cách an toàn
let app = null
let auth = null
let googleProvider = null

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    auth = getAuth(app)
    googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({
      prompt: 'select_account',
    })
  } catch (error) {
    console.warn('[Firebase] Không thể khởi tạo Firebase Auth:', error)
  }
}

/**
 * Ánh xạ mã lỗi của Firebase Auth sang thông báo tiếng Việt thân thiện, rõ ràng.
 */
export function getFirebaseErrorMessage(error) {
  const code = error?.code || ''
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.'
    case 'auth/cancelled-popup-request':
      return 'Cửa sổ đăng nhập đã bị hủy do có yêu cầu mới.'
    case 'auth/popup-blocked':
      return 'Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cấp quyền mở popup cho trang web để tiếp tục đăng nhập.'
    case 'auth/unauthorized-domain':
      return 'Tên miền hiện tại chưa được cấp phép trong Firebase Console. Vui lòng thêm localhost hoặc tên miền của bạn vào Authentication > Settings > Authorized domains.'
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng khi liên hệ với dịch vụ Google. Vui lòng kiểm tra lại đường truyền internet.'
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập bằng Google chưa được bật trong Firebase Console (Authentication > Sign-in method > Google).'
    case 'auth/account-exists-with-different-credential':
      return 'Tài khoản email này đã được sử dụng với phương thức đăng nhập khác.'
    case 'auth/invalid-api-key':
      return 'Firebase API Key không hợp lệ. Vui lòng kiểm tra lại biến VITE_FIREBASE_API_KEY trong file .env.'
    case 'auth/invalid-auth-domain':
      return 'Firebase Auth Domain không hợp lệ. Hãy kiểm tra VITE_FIREBASE_AUTH_DOMAIN trong cấu hình Web App.'
    default:
      return error?.message || 'Đã xảy ra lỗi khi xác thực tài khoản Google. Vui lòng thử lại sau.'
  }
}

/**
 * Đăng nhập bằng Google thông qua popup thật của Firebase.
 * Trả về { ok: true, user, idToken } hoặc { ok: false, error }.
 */
export async function signInWithGooglePopup() {
  const configError = getFirebaseConfigError()
  if (configError) {
    return {
      ok: false,
      error: configError,
    }
  }

  if (!auth || !googleProvider) {
    try {
      if (!app) {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
      }
      auth = getAuth(app)
      googleProvider = new GoogleAuthProvider()
      googleProvider.setCustomParameters({ prompt: 'select_account' })
    } catch (err) {
      return {
        ok: false,
        error: `Không thể khởi tạo Firebase Auth: ${getFirebaseErrorMessage(err)}`,
      }
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider)
    const user = result.user
    const idToken = await user.getIdToken()
    return {
      ok: true,
      user,
      idToken,
    }
  } catch (error) {
    console.error('[Firebase] Lỗi đăng nhập Google:', error)
    return {
      ok: false,
      error: getFirebaseErrorMessage(error),
      code: error.code,
    }
  }
}

/**
 * Đăng xuất tài khoản khỏi Firebase Authentication.
 */
export async function firebaseSignOut() {
  if (auth && auth.currentUser) {
    await fbSignOut(auth)
  }
}

/**
 * Đăng ký lắng nghe thay đổi trạng thái xác thực Firebase.
 * Trả về hàm hủy đăng ký (unsubscribe).
 */
export function subscribeToFirebaseAuthState(callback) {
  if (!auth) {
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

export { auth }
