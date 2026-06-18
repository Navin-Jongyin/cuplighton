# Firebase and Vite env

Create a local file named `.env.local` in the repository root with these values (do NOT commit this file):

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id


## Run locally

1. npm install
2. Create `.env.local` with your Firebase config (see above).
3. Start dev server: npm run dev
4. Visit http://localhost:5173 for the site and http://localhost:5173/cms-admin/ for the admin UI


## How it works

- The public site (index.html) fetches published pages from Firestore collection `pages` by slug (document id). The admin can create/update pages using the CMS at /cms-admin.
- The admin UI uses Firebase Auth (email/password) to sign in. After you create an account in the Firebase Console and sign in once, you should add an admin document under `admins/{uid}` in Firestore to allow the user to write (see security rules).


## Security rules (example)

See `firebase.rules` for example Firestore/Storage rules to start with. Review and adapt to your needs before deploying to production.
