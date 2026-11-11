import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { env } from '../config/env.js'

export class FirebaseAdminNotConfiguredError extends Error {
  constructor(provider = 'Google') {
    super(`Đăng nhập ${provider} chưa được cấu hình trên Backend.`)
    this.name = 'FirebaseAdminNotConfiguredError'
  }
}

export class InvalidFirebaseIdTokenError extends Error {
  constructor(provider = 'Google') {
    super(`Token đăng nhập ${provider} không hợp lệ hoặc tài khoản chưa được xác minh.`)
    this.name = 'InvalidFirebaseIdTokenError'
  }
}

export function getFirebaseAdminApp() {
  const serviceAccount = env.firebaseServiceAccount
  const projectId = serviceAccount?.projectId || env.firebaseProjectId

  if (!projectId) return null

  const appName = 'shopnova-firebase-auth'
  const app = getApps().find((candidate) => candidate.name === appName) || initializeApp(
    serviceAccount
      ? {
          credential: cert({
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKey: serviceAccount.privateKey,
          }),
          projectId: serviceAccount.projectId,
        }
      : { projectId },
    appName,
  )

  return app
}

function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp()
  if (!app) throw new FirebaseAdminNotConfiguredError()

  return { auth: getAuth(app), hasServiceAccount: Boolean(env.firebaseServiceAccount) }
}

export async function verifyFirebaseIdToken(idToken, providerName = 'Google') {
  const { auth: firebaseAuth, hasServiceAccount } = getFirebaseAdminAuth()
  let decodedToken

  try {
    decodedToken = await firebaseAuth.verifyIdToken(idToken, hasServiceAccount)
  } catch (error) {
    if ([
      'auth/argument-error',
      'auth/invalid-credential',
      'auth/invalid-id-token',
      'auth/id-token-expired',
      'auth/id-token-revoked',
      'auth/user-disabled',
    ].includes(error?.code)) {
      throw new InvalidFirebaseIdTokenError(providerName)
    }
    throw error
  }

  const email = typeof decodedToken.email === 'string' ? decodedToken.email.trim().toLowerCase() : ''
  const emailValid = email ? (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) : true
  const signInProvider = decodedToken.firebase?.sign_in_provider
  const isGoogle = signInProvider === 'google.com'
  const isFacebook = signInProvider === 'facebook.com'

  if (
    typeof decodedToken.uid !== 'string' ||
    !decodedToken.uid.trim() ||
    decodedToken.uid.length > 128 ||
    (!isGoogle && !isFacebook && !decodedToken.email_verified) ||
    !emailValid
  ) {
    throw new InvalidFirebaseIdTokenError(providerName)
  }

  if (providerName.toLowerCase() === 'google' && !email) {
    throw new InvalidFirebaseIdTokenError(providerName)
  }

  return {
    firebaseUid: decodedToken.uid,
    email: email || null,
    fullName: typeof decodedToken.name === 'string' ? decodedToken.name.trim() : '',
    phone: typeof decodedToken.phone_number === 'string' ? decodedToken.phone_number.trim() : '',
    avatarUrl: typeof decodedToken.picture === 'string' ? decodedToken.picture.trim() : null,
    provider: signInProvider || providerName.toLowerCase(),
  }
}
