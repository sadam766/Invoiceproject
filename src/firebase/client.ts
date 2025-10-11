'use client';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDhMFk2zI8mBEhQGVhJU9galY83gg1cpMM",
  authDomain: "projectdakota-9e0cc.firebaseapp.com",
  databaseURL: "https://projectdakota-9e0cc-default-rtdb.firebaseio.com",
  projectId: "projectdakota-9e0cc",
  storageBucket: "projectdakota-9e0cc.appspot.com",
  messagingSenderId: "623275029335",
  appId: "1:623275029335:web:9caed78ba96f30d1bc8412",
  measurementId: "G-L83D2RTJW9"
};

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// Initialize Firebase only on the client side
if (typeof window !== 'undefined') {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }
  auth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
}

// Export the initialized services
// Note: These will be undefined on the server, which is expected.
// The provider components will ensure they are only used on the client.
export { firebaseApp, auth, firestore };
