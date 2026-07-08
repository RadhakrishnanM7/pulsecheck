import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ============================================================================
//  PASTE YOUR FIREBASE CONFIG BELOW
//  (README.md, "Connect Firebase" section, walks you through getting this.)
//  Replace every "PASTE_..." value with the real values from your Firebase
//  project. Once you do, live student join links start working.
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyABRNWoF2zoX0LjZrsjHZ52523df0H26ko",
  authDomain: "pulsecheck-d7d4d.firebaseapp.com",
  projectId: "pulsecheck-d7d4d",
  storageBucket: "pulsecheck-d7d4d.firebasestorage.app",
  messagingSenderId: "1051167812921",
  appId: "1:1051167812921:web:1672fc9497f9670ef18ce8",
};

const isConfigured = !String(firebaseConfig.apiKey).startsWith(
  apiKey: "AIzaSyABRNWoF2zoX0LjZrsjHZ52523df0H26ko",
  authDomain: "pulsecheck-d7d4d.firebaseapp.com",
  projectId: "pulsecheck-d7d4d",
  storageBucket: "pulsecheck-d7d4d.firebasestorage.app",
  messagingSenderId: "1051167812921",
  appId: "1:1051167812921:web:1672fc9497f9670ef18ce8",);
export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
