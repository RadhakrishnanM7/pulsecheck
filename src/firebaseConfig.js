import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyABRNWoF2zoX0LjZrsjHZ52523df0H26ko",
  authDomain: "pulsecheck-d7d4d.firebaseapp.com",
  projectId: "pulsecheck-d7d4d",
  storageBucket: "pulsecheck-d7d4d.firebasestorage.app",
  messagingSenderId: "1051167812921",
  appId: "1:1051167812921:web:1672fc9497f9670ef18ce8"
};
// Fixed: Removed "!" and added "export"
export const isConfigured = String(firebaseConfig.apiKey).startsWith("AIza");

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
