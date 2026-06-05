import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyA-VJnZ6Vgwh-EmU6T1bbXY6LCAnyDqD_Q",
  authDomain: "macy-website.firebaseapp.com",
  projectId: "macy-website",
  storageBucket: "macy-website.firebasestorage.app",
  messagingSenderId: "497288280454",
  appId: "1:497288280454:web:8a7787c89db9ad17bc1407"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
