import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let appInitialized = false;
let db;

function ensureInit(){
  if (appInitialized) return;
  initializeApp(firebaseConfig);
  db = getFirestore();
  appInitialized = true;
}

export async function fetchPage(slug){
  ensureInit();
  if (!slug) return null;
  const dref = doc(db, 'pages', slug);
  const snap = await getDoc(dref);
  if (!snap.exists()) return null;
  const data = snap.data();
  // only return published pages to public site
  if (!data.published) return null;
  return data;
}
