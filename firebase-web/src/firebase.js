
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";

// ========================================
// FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyA6rBsf6vmBHhc4gOVlhSL54KBsTUmFf6k",
    authDomain: "aru-marketplace.firebaseapp.com",
    projectId: "aru-marketplace",
    storageBucket: "aru-marketplace.firebasestorage.app",
    messagingSenderId: "229967603084",
    appId: "1:229967603084:web:4f871cf9076aa88e26a2a9",
    measurementId: "G-SQKDW8SXMH"
};

// ========================================
// INITIALIZE FIREBASE
// ========================================

const app = initializeApp(firebaseConfig);

// ========================================
// FIREBASE AUTHENTICATION
// ========================================

export const auth = getAuth(app);

// ========================================
// FIRESTORE WITH PERSISTENT CACHING
// ========================================

export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// ========================================
// GOOGLE ANALYTICS
// ========================================

export const analytics = getAnalytics(app);

// ========================================
// EXPORT FIREBASE APP
// ========================================

export default app;
