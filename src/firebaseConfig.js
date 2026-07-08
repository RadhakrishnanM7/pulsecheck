import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ============================================================================
//  PASTE YOUR FIREBASE CONFIG BELOW
//  (README.md, "Connect Firebase" section, walks you through getting this.)
//  Replace every "PASTE_..." value with the real values from your Firebase
//  project. Once you do, live student join links start working.
// ============================================================================
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

const isConfigured = !String(firebaseConfig.apiKey).startsWith("PASTE_");
export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
