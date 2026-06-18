import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// UI
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const loginSection = document.getElementById('login');
const adminUI = document.getElementById('adminUI');
const doSignInBtn = document.getElementById('doSignIn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const pagesEl = document.getElementById('pages');
const newPageBtn = document.getElementById('newPage');
const slugInput = document.getElementById('slug');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('contentHtml');
const saveDraftBtn = document.getElementById('saveDraft');
const publishBtn = document.getElementById('publish');
const deleteBtn = document.getElementById('deletePage');
const previewBtn = document.getElementById('preview');
const previewArea = document.getElementById('previewArea');

let currentUser = null;

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

signInBtn.addEventListener('click', () => { show(loginSection); });
signOutBtn.addEventListener('click', async () => { await signOut(auth); location.reload(); });

doSignInBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const pw = passwordInput.value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pw);
    currentUser = cred.user;
    initAfterAuth();
  } catch (err) {
    alert('Sign-in failed: ' + err.message);
  }
});

async function initAfterAuth(){
  hide(loginSection);
  hide(signInBtn);
  show(signOutBtn);
  show(adminUI);
  await loadPages();
}

async function loadPages(){
  pagesEl.innerHTML = '';
  const coll = collection(db, 'pages');
  const snaps = await getDocs(coll);
  snaps.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement('div');
    div.className = 'page-item';
    div.innerHTML = `<div><strong>${data.title || docSnap.id}</strong> <small>/${docSnap.id}</small></div><div><button data-slug="${docSnap.id}" class="edit">Edit</button></div>`;
    pagesEl.appendChild(div);
  });
  pagesEl.querySelectorAll('button.edit').forEach(b => b.addEventListener('click', async (e) => {
    const slug = e.currentTarget.dataset.slug;
    await editPage(slug);
  }));
}

newPageBtn.addEventListener('click', () => {
  slugInput.value = prompt('New slug (e.g. home or about)') || '';
  titleInput.value = '';
  contentInput.value = '';
});

async function editPage(slug){
  const dref = doc(db, 'pages', slug);
  const snap = await getDoc(dref);
  if (snap.exists()){
    const data = snap.data();
    slugInput.value = snap.id;
    titleInput.value = data.title || '';
    contentInput.value = data.contentHtml || '';
  } else {
    slugInput.value = slug;
    titleInput.value = '';
    contentInput.value = '';
  }
}

saveDraftBtn.addEventListener('click', async () => {
  const slug = slugInput.value.trim();
  if (!slug) return alert('Slug required');
  const dref = doc(db, 'pages', slug);
  await setDoc(dref, {
    title: titleInput.value,
    contentHtml: contentInput.value,
    published: false,
    updatedAt: serverTimestamp(),
    authorId: currentUser.uid
  }, { merge: true });
  alert('Saved draft');
  await loadPages();
});

publishBtn.addEventListener('click', async () => {
  const slug = slugInput.value.trim();
  if (!slug) return alert('Slug required');
  const dref = doc(db, 'pages', slug);
  await setDoc(dref, {
    title: titleInput.value,
    contentHtml: contentInput.value,
    published: true,
    updatedAt: serverTimestamp(),
    authorId: currentUser.uid
  }, { merge: true });
  alert('Published');
  await loadPages();
});

deleteBtn.addEventListener('click', async () => {
  const slug = slugInput.value.trim();
  if (!slug) return alert('Slug required');
  if (!confirm('Delete page ' + slug + '?')) return;
  await deleteDoc(doc(db, 'pages', slug));
  alert('Deleted');
  slugInput.value=''; titleInput.value=''; contentInput.value='';
  await loadPages();
});

previewBtn.addEventListener('click', () => {
  previewArea.innerHTML = `<article><h2>${escapeHtml(titleInput.value)}</h2>${contentInput.value}</article>`;
  show(previewArea);
});

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// simple bootstrap: check if user is already signed in
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user){
    currentUser = user;
    initAfterAuth();
  } else {
    // show sign in button
    show(signInBtn);
  }
});

// Optional: add a simple file uploader helper (not wired to UI yet)
export async function uploadFile(file){
  if (!currentUser) throw new Error('Not signed in');
  const path = `uploads/${Date.now()}_${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  return { path, url };
}
