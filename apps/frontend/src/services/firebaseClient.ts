import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
} from 'firebase/auth';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,,
  };

  firebaseApp = initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getFirebaseApp();
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

