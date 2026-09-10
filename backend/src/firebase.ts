import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from './config.js';

let database: Firestore | undefined;

export function getDatabase(): Firestore {
  if (database) return database;

  const serviceAccountPath = env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? existsSync(resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH))
      ? resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : resolve(process.cwd(), '..', env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : undefined;

  const credential = env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? (() => {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
          project_id: string;
          client_email: string;
          private_key: string;
        };
        return {
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key
        };
      })()
    : serviceAccountPath
    ? (() => {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as {
          project_id: string;
          client_email: string;
          private_key: string;
        };
        return {
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key
        };
      })()
    : env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
      ? {
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }
      : null;

  if (!credential) throw new Error('Firebase Admin no esta configurado. Revisa backend/.env.');

  const app = getApps()[0] ?? initializeApp({
    credential: cert(credential)
  });

  database = getFirestore(app);
  return database;
}
