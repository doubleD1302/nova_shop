import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { env } from '../config/env.js'

export class FirebaseAdminNotConfiguredError extends Error {
  constructor() {
    super('Đăng nhập Google chưa được cấu hình trên Backend.')
    this.name = 'FirebaseAdminNotConfiguredError'
  }
}

export class InvalidFirebaseIdTokenError extends Error {
  constructor() {
    super('Token đăng nhập Google không hợp lệ hoặc email chưa được xác minh.')
    this.name = 'InvalidFirebaseIdTokenError'
  }
}

function getFirebaseAdminAuth() {
  const serviceAccount = env.firebaseServiceAccount
  const projectId = serviceAccount?.projectId || env.firebaseProjectId

  if (!projectId) throw new FirebaseAdminNotConfiguredError()

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

  return { auth: getAuth(app), hasServiceAccount: Boolean(serviceAccount) }
}

export async function verifyFirebaseIdToken(idToken) {
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
      throw new InvalidFirebaseIdTokenError()
    }
    throw error
  }

  const email = typeof decodedToken.email === 'string' ? decodedToken.email.trim().toLowerCase() : ''
  const emailValid = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (
    typeof decodedToken.uid !== 'string' ||
    !decodedToken.uid.trim() ||
    decodedToken.uid.length > 128 ||
    (decodedToken.firebase?.sign_in_provider !== 'google.com' && !decodedToken.email_verified) ||
    !emailValid
  ) {
    throw new InvalidFirebaseIdTokenError()
  }

  return {
    firebaseUid: decodedToken.uid,
    email,
    fullName: typeof decodedToken.name === 'string' ? decodedToken.name.trim() : '',
    phone: typeof decodedToken.phone_number === 'string' ? decodedToken.phone_number.trim() : '',
    avatarUrl: typeof decodedToken.picture === 'string' ? decodedToken.picture.trim() : null,
  }
}
