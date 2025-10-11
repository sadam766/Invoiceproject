'use client';

// This file is the main barrel file for all Firebase-related functionality.
// It re-exports modules for easy consumption across the app.

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';

// We no longer export initializeFirebase from here as it's handled in client.ts
// and the providers.
