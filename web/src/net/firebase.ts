import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

export type FirebaseHandles = {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
};

function envConfig(): Record<string, string> | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !databaseURL || !projectId) return null;
  return { apiKey, authDomain: authDomain ?? "", databaseURL, projectId, appId: appId ?? "" };
}

export function firebaseConfigured(): boolean {
  return envConfig() !== null;
}

let handles: FirebaseHandles | null = null;

export async function connectFirebase(): Promise<FirebaseHandles | null> {
  if (handles) return handles;
  const config = envConfig();
  if (!config) return null;
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  if (!auth.currentUser) return null;
  handles = { app, auth, db };
  return handles;
}
