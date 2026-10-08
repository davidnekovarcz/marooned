import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

export type AdminHandles = {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
};

function envValue(name: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value : "";
}

/** Separate app so admin sign-in does not replace a player's anonymous session. */
export async function connectAdminFirebase(): Promise<AdminHandles | null> {
  const prefix = "VITE_FIREBASE_";
  const apiKey = envValue(prefix + "API_KEY");
  const authDomain = envValue(prefix + "AUTH_DOMAIN");
  const databaseURL = envValue(prefix + "DATABASE_URL");
  const projectId = envValue(prefix + "PROJECT_ID");
  const appId = envValue(prefix + "APP_ID");
  if (!apiKey || !databaseURL || !projectId) return null;
  const existing = getApps().find((app) => app.name === "admin");
  const app = existing ?? initializeApp({ apiKey, authDomain, databaseURL, projectId, appId }, "admin");
  return { app, auth: getAuth(app), db: getDatabase(app, databaseURL) };
}
