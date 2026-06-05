import { db } from './firebase-config.js';
import {
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Set this after creating a free Formspree form (https://formspree.io) —
// e.g. 'https://formspree.io/f/abcdwxyz'. Leave '' to save to Firestore only.
const FORMSPREE_ENDPOINT = '';

const form = document.getElementById('getinvolved-form');
if (form) {
  const statusEl = document.getElementById('gi-status');
  const submitBtn = document.getElementById('gi-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('gi-name').value.trim();
    const email = document.getElementById('gi-email').value.trim();
    const message = document.getElementById('gi-message').value.trim();
    if (!name || !email) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    statusEl.textContent = '';
    statusEl.className = 'gi-status';

    let ok = false;

    // 1) Save to your site (Firestore)
    try {
      await addDoc(collection(db, 'signups'), {
        name,
        email,
        message,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent
      });
      ok = true;
    } catch (err) {
      console.error('Signup save failed:', err);
    }

    // 2) Email you (Formspree) — only if configured
    if (FORMSPREE_ENDPOINT) {
      try {
        const res = await fetch(FORMSPREE_ENDPOINT, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        if (res.ok) ok = true;
      } catch (err) {
        console.error('Formspree email failed:', err);
      }
    }

    if (ok) {
      form.reset();
      statusEl.textContent = 'Thanks! We’ll be in touch soon.';
      statusEl.classList.add('gi-status--ok');
    } else {
      statusEl.textContent = 'Something went wrong. Please email us at unitedyouth26@gmail.com.';
      statusEl.classList.add('gi-status--err');
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Get involved';
  });
}
