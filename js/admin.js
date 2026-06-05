import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

let quill = null;
let currentRole = null;

// Wait for auth
onAuthStateChanged(auth, async (user) => {
  const loading = document.getElementById('admin-loading');
  const denied = document.getElementById('admin-denied');
  const dashboard = document.getElementById('admin-dashboard');

  if (!user) {
    loading.style.display = 'none';
    denied.style.display = '';
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) {
    loading.style.display = 'none';
    denied.style.display = '';
    return;
  }

  const userData = userDoc.data();
  currentRole = userData.role;

  if (currentRole !== 'admin' && currentRole !== 'author') {
    loading.style.display = 'none';
    denied.style.display = '';
    return;
  }

  // Show dashboard
  loading.style.display = 'none';
  dashboard.style.display = '';

  // Hide users tab for non-admins
  if (currentRole !== 'admin') {
    document.getElementById('users-tab').style.display = 'none';
  }

  initQuill();
  setupTabs();
  setupEditor();
  loadPosts();
});

function initQuill() {
  quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Write your blog post...',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        ['blockquote'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean']
      ]
    }
  });
}

function setupTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');

      if (tab.dataset.panel === 'users' && currentRole === 'admin') {
        loadUsers();
      }
    });
  });
}

function setupEditor() {
  const editorSection = document.getElementById('editor-section');
  const listSection = document.getElementById('post-list-section');
  const newBtn = document.getElementById('new-post-btn');
  const cancelBtn = document.getElementById('cancel-edit');
  const publishBtn = document.getElementById('save-published');
  const draftBtn = document.getElementById('save-draft');

  newBtn.addEventListener('click', () => {
    clearEditor();
    editorSection.style.display = '';
    listSection.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => {
    editorSection.style.display = 'none';
    listSection.style.display = '';
  });

  publishBtn.addEventListener('click', () => savePost('published'));
  draftBtn.addEventListener('click', () => savePost('draft'));
}

function clearEditor() {
  document.getElementById('edit-post-id').value = '';
  document.getElementById('post-title').value = '';
  document.getElementById('post-cover').value = '';
  document.getElementById('post-excerpt').value = '';
  quill.setContents([]);
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function estimateReadTime(html) {
  const text = html.replace(/<[^>]*>/g, '');
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

async function savePost(status) {
  const title = document.getElementById('post-title').value.trim();
  if (!title) { alert('Please enter a title.'); return; }

  const content = quill.root.innerHTML;
  const excerpt = document.getElementById('post-excerpt').value.trim();
  const coverImage = document.getElementById('post-cover').value.trim();
  const editId = document.getElementById('edit-post-id').value;
  const user = auth.currentUser;

  const postData = {
    title,
    slug: generateSlug(title),
    content,
    excerpt: excerpt || content.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
    coverImage: coverImage || '',
    authorId: user.uid,
    authorName: user.displayName || user.email.split('@')[0],
    status,
    readTime: estimateReadTime(content),
    updatedAt: serverTimestamp()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, 'blogPosts', editId), postData);
    } else {
      postData.createdAt = serverTimestamp();
      postData.views = 0;
      postData.likes = 0;
      postData.commentCount = 0;
      await addDoc(collection(db, 'blogPosts'), postData);
    }

    document.getElementById('editor-section').style.display = 'none';
    document.getElementById('post-list-section').style.display = '';
    loadPosts();
  } catch (err) {
    alert('Error saving post: ' + err.message);
  }
}

async function loadPosts() {
  const container = document.getElementById('post-list');
  container.innerHTML = '<div class="admin-loading"><p>Loading posts...</p></div>';

  try {
    const q = query(collection(db, 'blogPosts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = '<div class="empty-state"><p>No blog posts yet. Click "New Blog Post" to create one.</p></div>';
      return;
    }

    container.innerHTML = '';
    snap.forEach(docSnap => {
      const post = docSnap.data();
      const date = post.createdAt?.toDate?.() ? post.createdAt.toDate().toLocaleDateString() : 'Draft';
      const statusClass = post.status === 'published' ? 'post-status--published' : 'post-status--draft';

      const item = document.createElement('div');
      item.className = 'post-list-item';
      item.innerHTML = `
        <div class="post-list-info">
          <h3>${escapeHtml(post.title)}</h3>
          <span class="post-list-meta">${post.authorName} &middot; ${date} &middot; ${post.readTime} min read</span>
        </div>
        <span class="post-status ${statusClass}">${post.status}</span>
        <div class="post-list-actions">
          <button class="btn-icon edit-btn" title="Edit">&#9998;</button>
          <button class="btn-icon btn-icon--danger delete-btn" title="Delete">&#128465;</button>
        </div>
      `;

      item.querySelector('.edit-btn').addEventListener('click', () => editPost(docSnap.id, post));
      item.querySelector('.delete-btn').addEventListener('click', () => deletePost(docSnap.id, post.title));
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error loading posts: ${err.message}</p></div>`;
  }
}

function editPost(id, post) {
  document.getElementById('edit-post-id').value = id;
  document.getElementById('post-title').value = post.title;
  document.getElementById('post-cover').value = post.coverImage || '';
  document.getElementById('post-excerpt').value = post.excerpt || '';
  quill.root.innerHTML = post.content || '';

  document.getElementById('editor-section').style.display = '';
  document.getElementById('post-list-section').style.display = 'none';
}

async function deletePost(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, 'blogPosts', id));
    loadPosts();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }
}

// ===== USER MANAGEMENT =====
async function loadUsers() {
  const container = document.getElementById('user-list');
  container.innerHTML = '<div class="admin-loading"><p>Loading users...</p></div>';

  try {
    const snap = await getDocs(collection(db, 'users'));
    container.innerHTML = '';

    snap.forEach(docSnap => {
      const user = docSnap.data();
      const badgeClass = `role-badge--${user.role}`;

      const item = document.createElement('div');
      item.className = 'user-list-item';
      item.innerHTML = `
        <div class="user-list-info">
          <h4>${escapeHtml(user.displayName || 'Unnamed')}</h4>
          <span>${user.email}</span>
        </div>
        <span class="role-badge ${badgeClass}">${user.role}</span>
        <select class="role-select" data-uid="${docSnap.id}">
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
          <option value="author" ${user.role === 'author' ? 'selected' : ''}>Author</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      `;

      const select = item.querySelector('.role-select');
      select.addEventListener('change', async () => {
        try {
          await updateDoc(doc(db, 'users', docSnap.id), { role: select.value });
          loadUsers();
        } catch (err) {
          alert('Error updating role: ' + err.message);
        }
      });

      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error loading users: ${err.message}</p></div>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
