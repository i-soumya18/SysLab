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
    apiKey: 'AIzaSyCoWrRXOHChYKLmDTtxiT2zg6DlD9beT6M',
    appId: '1:618824994856:web:916e219b9a2f2903d7251d',
    authDomain: 'syslab-137f7.firebaseapp.com',
    measurementId: 'G-7Y99WYW7QY',
    messagingSenderId: '618824994856',
    projectId: 'syslab-137f7',
    storageBucket: 'syslab-137f7.firebasestorage.app',
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

