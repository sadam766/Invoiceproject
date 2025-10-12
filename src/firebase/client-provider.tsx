'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    let app: FirebaseApp;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    setServices({ app, auth, firestore });
  }, []); // Empty dependency array ensures this runs only once on mount.

  // Render a loading state or null while Firebase is initializing.
  if (!services) {
    // You can replace this with a more sophisticated loading spinner component
    return <div>Loading Firebase...</div>;
  }

  // Once initialized, render the provider with the Firebase services.
  return (
    <FirebaseProvider
      firebaseApp={services.app}
      auth={services.auth}
      firestore={services.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
