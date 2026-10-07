import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6rBsf6vmBHhc4gOVlhSL54KBsTUmFf6k",
  authDomain: "aru-marketplace.firebaseapp.com",
  projectId: "aru-marketplace",
  storageBucket: "aru-marketplace.firebasestorage.app",
  messagingSenderId: "229967603084",
  appId: "1:229967603084:web:4f871cf9076aa88e26a2a9",
  measurementId:"G-SQKDW8SXMH"
};

const app = initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);

// Firestore Database
export const db = getFirestore(app);

// Google Analytics
export const analytics = getAnalytics(app);

export default app;