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
    let app: FirebaseApp;
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    setServices({ app, auth, firestore });
  }, []); 

  // Pass services (which can be null initially) to the provider.
  // This ensures the same component tree is rendered on server and client initially.
  return (
    <FirebaseProvider
      firebaseApp={services?.app}
      auth={services?.auth}
      firestore={services?.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
