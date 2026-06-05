import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, collection, getDocs, query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const googleProvider = new GoogleAuthProvider();

// Current user state
let currentUser = null;
let currentUserData = null;

export function getCurrentUser() { return currentUser; }
export function getCurrentUserData() { return currentUserData; }

// Create or fetch user document in Firestore
async function ensureUserDoc(user) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data();
  }

  // Check if this is the first user (make them admin)
  const usersQuery = query(collection(db, 'users'));
  const usersSnap = await getDocs(usersQuery);
  const role = usersSnap.empty ? 'admin' : 'user';

  const userData = {
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL || null,
    role: role,
    createdAt: serverTimestamp()
  };

  await setDoc(userRef, userData);
  return userData;
}

// Inject auth modal HTML into the page
function injectAuthModal() {
  if (document.getElementById('auth-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-backdrop"></div>
    <div class="auth-modal-content">
      <button class="auth-modal-close">&times;</button>

      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Log In</button>
        <button class="auth-tab" data-tab="signup">Sign Up</button>
      </div>

      <div class="auth-error" id="auth-error"></div>

      <!-- LOGIN FORM -->
      <form class="auth-form" id="login-form">
        <div class="auth-field">
          <label for="login-email">Email</label>
          <input type="email" id="login-email" required placeholder="your@email.com">
        </div>
        <div class="auth-field">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" required placeholder="Your password">
        </div>
        <button type="submit" class="btn btn-primary auth-submit">Log In</button>
      </form>

      <!-- SIGNUP FORM -->
      <form class="auth-form" id="signup-form" style="display:none;">
        <div class="auth-field">
          <label for="signup-name">Full Name</label>
          <input type="text" id="signup-name" required placeholder="Your name">
        </div>
        <div class="auth-field">
          <label for="signup-email">Email</label>
          <input type="email" id="signup-email" required placeholder="your@email.com">
        </div>
        <div class="auth-field">
          <label for="signup-password">Password</label>
          <input type="password" id="signup-password" required minlength="6" placeholder="At least 6 characters">
        </div>
        <button type="submit" class="btn btn-primary auth-submit">Create Account</button>
      </form>

      <div class="auth-divider"><span>or</span></div>

      <button class="auth-google-btn" id="google-signin-btn">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z"/></svg>
        Continue with Google
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  setupModalEvents(modal);
}

function setupModalEvents(modal) {
  const backdrop = modal.querySelector('.auth-modal-backdrop');
  const closeBtn = modal.querySelector('.auth-modal-close');
  const tabs = modal.querySelectorAll('.auth-tab');
  const loginForm = modal.querySelector('#login-form');
  const signupForm = modal.querySelector('#signup-form');
  const googleBtn = modal.querySelector('#google-signin-btn');
  const errorEl = modal.querySelector('#auth-error');

  // Close modal
  backdrop.addEventListener('click', () => closeAuthModal());
  closeBtn.addEventListener('click', () => closeAuthModal());

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      errorEl.textContent = '';
      if (tab.dataset.tab === 'login') {
        loginForm.style.display = '';
        signupForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        signupForm.style.display = '';
      }
    });
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeAuthModal();
    } catch (err) {
      errorEl.textContent = friendlyError(err.code);
    }
  });

  // Signup
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await ensureUserDoc(cred.user);
      closeAuthModal();
    } catch (err) {
      errorEl.textContent = friendlyError(err.code);
    }
  });

  // Google sign-in
  googleBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    try {
      await signInWithPopup(auth, googleProvider);
      closeAuthModal();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        errorEl.textContent = friendlyError(err.code);
      }
    }
  });
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

export function openAuthModal() {
  injectAuthModal();
  document.getElementById('auth-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Update the nav bar based on auth state
function updateNavUI(user, userData) {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // Remove old auth UI
  const oldAuthArea = nav.querySelector('.nav-auth');
  if (oldAuthArea) oldAuthArea.remove();

  const authArea = document.createElement('div');
  authArea.className = 'nav-auth';

  if (user && userData) {
    const isAdmin = userData.role === 'admin';
    const isAuthor = userData.role === 'author';

    authArea.innerHTML = `
      ${isAdmin ? '<a href="' + getBasePath() + 'admin.html" class="nav-auth-link">Admin</a>' : ''}
      ${isAuthor ? '<a href="' + getBasePath() + 'admin.html" class="nav-auth-link">Write</a>' : ''}
      <span class="nav-user-name">${userData.displayName || user.email.split('@')[0]}</span>
      <button class="btn btn-outline btn-sm nav-logout-btn">Log Out</button>
    `;
    authArea.querySelector('.nav-logout-btn')?.addEventListener('click', async () => {
      await signOut(auth);
    });
  } else {
    authArea.innerHTML = `
      <button class="btn btn-primary btn-sm nav-login-btn">TAKE ACTION</button>
    `;
    authArea.querySelector('.nav-login-btn').addEventListener('click', () => openAuthModal());
  }

  // Replace the existing TAKE ACTION link
  const existingCta = nav.querySelector('.nav-cta');
  if (existingCta) existingCta.remove();

  nav.appendChild(authArea);
}

// Detect base path relative to site root
function getBasePath() {
  // Find the current script's location to determine depth
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const filename = parts[parts.length - 1] || '';

  // If we're inside /blog/ directory, go up one level
  if (parts.some((p, i) => p === 'blog' && i < parts.length - 1)) {
    return '../';
  }
  return '';
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    currentUserData = await ensureUserDoc(user);
    updateNavUI(user, currentUserData);
    document.dispatchEvent(new CustomEvent('auth-ready', { detail: { user, userData: currentUserData } }));
  } else {
    currentUserData = null;
    updateNavUI(null, null);
    document.dispatchEvent(new CustomEvent('auth-ready', { detail: { user: null, userData: null } }));
  }
});
