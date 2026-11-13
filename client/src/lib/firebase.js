// Optional Google sign-in via Firebase. Loaded lazily so the SDK is only
// downloaded when someone actually clicks "Continue with Google".
export const googleEnabled = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);

let authInstance = null;

export async function getGoogleIdToken() {
  const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  if (!authInstance) {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    authInstance = getAuth(app);
  }
  const result = await signInWithPopup(authInstance, new GoogleAuthProvider());
  return result.user.getIdToken();
}
