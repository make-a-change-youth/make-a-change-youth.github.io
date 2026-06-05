import { db, auth } from './firebase-config.js';
import {
  collection, getDocs, getDoc, doc, updateDoc, addDoc, deleteDoc,
  query, where, orderBy, limit, increment, serverTimestamp, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Load all published blog posts for the listing page
export async function loadBlogPosts() {
  const container = document.getElementById('blog-grid');
  if (!container) return;

  container.innerHTML = skeletonCards(6);

  try {
    const q = query(
      collection(db, 'blogPosts'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#555;">No posts yet. Check back soon!</div>';
      return;
    }

    container.innerHTML = '';
    snap.forEach(docSnap => {
      const post = docSnap.data();
      const date = post.createdAt?.toDate?.()
        ? post.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

      const card = document.createElement('a');
      card.href = `blog/post.html?id=${docSnap.id}`;
      card.className = 'blog-card';
      card.innerHTML = `
        <div class="blog-card-image">
          <img src="${post.coverImage || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=250&fit=crop'}"
               alt="${escapeHtml(post.title)}" loading="lazy" width="400" height="250">
        </div>
        <div class="blog-card-body">
          <div class="blog-card-meta">
            <span class="blog-card-avatar" aria-hidden="true">${escapeHtml((post.authorName || 'U').charAt(0).toUpperCase())}</span>
            <span>${escapeHtml(post.authorName)} &middot; ${date} &middot; ${post.readTime || 3} min read</span>
          </div>
          <h3>${escapeHtml(post.title)}</h3>
          <p class="blog-card-excerpt">${escapeHtml(post.excerpt || '')}</p>
        </div>
        <div class="blog-card-footer">
          <span>${post.views || 0} Views</span>
          <span>${post.commentCount || 0} Comments</span>
          <span>${post.likes || 0} Likes</span>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#c0392b;">Error loading posts. Please try again later.</div>`;
    console.error('Error loading blog posts:', err);
  }
}

// Load the 3 newest published posts for the homepage "Latest stories" strip
export async function loadLatestStories() {
  const container = document.getElementById('latest-stories');
  if (!container) return;

  container.innerHTML = skeletonCards(3);

  try {
    const q = query(
      collection(db, 'blogPosts'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-faint);font-family:var(--font-mono);font-size:.8rem;">No stories yet.</p>';
      return;
    }

    container.innerHTML = '';
    snap.forEach(docSnap => {
      const post = docSnap.data();
      const date = post.createdAt?.toDate?.()
        ? post.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';

      const card = document.createElement('a');
      card.href = `blog/post.html?id=${docSnap.id}`;
      card.className = 'story-card';
      card.innerHTML = `
        <div class="story-card-img">
          <img src="${post.coverImage || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=334&fit=crop'}"
               alt="${escapeHtml(post.title)}" loading="lazy" width="500" height="334">
        </div>
        <div class="story-card-body">
          <time>${date}</time>
          <h3>${escapeHtml(post.title)}</h3>
          <span class="read-more">Read more</span>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<p style="grid-column:1/-1;color:var(--ink-faint);font-family:var(--font-mono);font-size:.8rem;">Could not load stories.</p>';
    console.error('Error loading latest stories:', err);
  }
}

// Load a single blog post for the post viewer page
export async function loadSinglePost() {
  const container = document.getElementById('blog-post-dynamic');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (!postId) {
    container.innerHTML = '<div class="empty-state"><p>Post not found.</p><a href="../blog.html" class="btn btn-outline">Back to Blog</a></div>';
    return;
  }

  try {
    const postDoc = await getDoc(doc(db, 'blogPosts', postId));

    if (!postDoc.exists()) {
      container.innerHTML = '<div class="empty-state"><p>Post not found.</p><a href="../blog.html" class="btn btn-outline">Back to Blog</a></div>';
      return;
    }

    const post = postDoc.data();
    const date = post.createdAt?.toDate?.()
      ? post.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    // Count a view once per device (localStorage) — touches only the views counter
    const viewedKey = `macy_viewed_${postId}`;
    if (!localStorage.getItem(viewedKey)) {
      updateDoc(doc(db, 'blogPosts', postId), { views: increment(1) })
        .then(() => localStorage.setItem(viewedKey, '1'))
        .catch(() => {});
    }

    container.innerHTML = `
      <article class="blog-post">
        <div class="blog-post-header">
          <h1>${escapeHtml(post.title)}</h1>
          <div class="blog-post-byline">
            <span class="blog-card-avatar" aria-hidden="true">${escapeHtml((post.authorName || 'U').charAt(0).toUpperCase())}</span>
            <span>By <strong>${escapeHtml(post.authorName)}</strong> &middot; ${date} &middot; ${post.readTime || 3} min read</span>
          </div>
        </div>
        ${post.coverImage ? `
        <div class="blog-post-hero">
          <img src="${post.coverImage}" alt="${escapeHtml(post.title)}" width="800" height="400">
        </div>` : ''}
        <div class="blog-post-content">${post.content}</div>
        <div class="blog-post-actions">
          <button class="like-btn" id="like-btn" type="button" aria-pressed="false" aria-label="Like this post">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <span class="like-count" id="like-count">${post.likes || 0}</span>
          </button>
          <span class="post-stat" id="view-stat">${post.views || 0} views</span>
        </div>
        <a href="../blog.html" class="blog-post-back">&larr; Back to all posts</a>
      </article>

      <!-- COMMENTS SECTION -->
      <section class="comments-section" id="comments-section" data-post-id="${postId}" data-parent-type="blog">
        <h3 class="comments-heading">Comments</h3>
        <div id="comment-form-area"></div>
        <div id="comments-list"></div>
      </section>
    `;

    document.title = `${post.title} | MACY`;
    loadComments(postId, 'blog');
    setupCommentForm(postId, 'blog');
    setupLikeButton(postId);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error loading post.</p><a href="../blog.html" class="btn btn-outline">Back to Blog</a></div>`;
    console.error('Error loading post:', err);
  }
}

// Anonymous like toggle — one like per device, tracked in localStorage
function setupLikeButton(postId) {
  const btn = document.getElementById('like-btn');
  const countEl = document.getElementById('like-count');
  if (!btn || !countEl) return;

  const likedKey = `macy_liked_${postId}`;
  let liked = localStorage.getItem(likedKey) === '1';
  setLikedState(btn, liked);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;

    const delta = liked ? -1 : 1;
    const current = parseInt(countEl.textContent, 10) || 0;
    const next = Math.max(0, current + delta);
    countEl.textContent = next; // optimistic update

    try {
      await updateDoc(doc(db, 'blogPosts', postId), { likes: increment(delta) });
      liked = !liked;
      if (liked) localStorage.setItem(likedKey, '1');
      else localStorage.removeItem(likedKey);
      setLikedState(btn, liked);
    } catch (err) {
      countEl.textContent = current; // revert on failure
      console.error('Error updating like:', err);
    } finally {
      btn.disabled = false;
    }
  });
}

function setLikedState(btn, liked) {
  btn.classList.toggle('liked', liked);
  btn.setAttribute('aria-pressed', String(liked));
}

// ===== COMMENTS =====
async function loadComments(parentId, parentType) {
  const list = document.getElementById('comments-list');
  if (!list) return;

  try {
    const q = query(
      collection(db, 'comments'),
      where('parentId', '==', parentId),
      where('parentType', '==', parentType),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);

    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p class="no-comments">No comments yet. Be the first!</p>';
      return;
    }

    snap.forEach(docSnap => {
      const c = docSnap.data();
      const date = c.createdAt?.toDate?.()
        ? c.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

      const el = document.createElement('div');
      el.className = 'comment-item';
      el.innerHTML = `
        <div class="comment-avatar" aria-hidden="true">${(c.authorName || 'U')[0].toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-meta"><strong>${escapeHtml(c.authorName)}</strong> <span>&middot; ${date}</span></div>
          <p>${escapeHtml(c.content)}</p>
        </div>
      `;
      list.appendChild(el);
    });
  } catch (err) {
    list.innerHTML = '<p class="no-comments">Could not load comments.</p>';
    console.error('Error loading comments:', err);
  }
}

function setupCommentForm(parentId, parentType) {
  const area = document.getElementById('comment-form-area');
  if (!area) return;

  // Listen for auth state
  document.addEventListener('auth-ready', (e) => {
    renderCommentForm(area, parentId, parentType, e.detail.user, e.detail.userData);
  });

  // Also check if auth already loaded
  if (auth.currentUser) {
    import('./auth.js').then(mod => {
      renderCommentForm(area, parentId, parentType, auth.currentUser, mod.getCurrentUserData());
    });
  } else {
    renderCommentForm(area, parentId, parentType, null, null);
  }
}

function renderCommentForm(area, parentId, parentType, user, userData) {
  if (!user) {
    area.innerHTML = '<p class="comment-login-prompt">Log in to leave a comment.</p>';
    return;
  }

  area.innerHTML = `
    <form class="comment-form" id="comment-form">
      <input type="text" id="comment-input" placeholder="Write a comment..." required>
      <button type="submit" class="btn btn-primary btn-sm">Post</button>
    </form>
  `;

  document.getElementById('comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content) return;

    try {
      await addDoc(collection(db, 'comments'), {
        parentId,
        parentType,
        authorId: user.uid,
        authorName: userData?.displayName || user.displayName || user.email.split('@')[0],
        content,
        createdAt: serverTimestamp()
      });

      // Update comment count on the parent
      const parentCollection = parentType === 'blog' ? 'blogPosts' : 'groupPosts';
      updateDoc(doc(db, parentCollection, parentId), { commentCount: increment(1) }).catch(() => {});

      input.value = '';
      loadComments(parentId, parentType);
    } catch (err) {
      alert('Error posting comment: ' + err.message);
    }
  });
}

// Render N shimmer placeholder cards while real content loads
function skeletonCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line title"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
        </div>
      </div>`;
  }
  return html;
}

// Count published posts and groups for the homepage hero stats
export async function loadHomeStats() {
  const storiesEl = document.getElementById('stat-stories');
  const groupsEl = document.getElementById('stat-groups');
  if (!storiesEl && !groupsEl) return;

  if (storiesEl) {
    try {
      const c = await getCountFromServer(
        query(collection(db, 'blogPosts'), where('status', '==', 'published'))
      );
      storiesEl.textContent = c.data().count;
    } catch (err) {
      console.error('Error counting stories:', err);
    }
  }

  if (groupsEl) {
    try {
      const c = await getCountFromServer(collection(db, 'groups'));
      groupsEl.textContent = c.data().count;
    } catch (err) {
      console.error('Error counting groups:', err);
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Auto-initialize based on which page we're on
if (document.getElementById('blog-grid')) {
  loadBlogPosts();
}
if (document.getElementById('blog-post-dynamic')) {
  loadSinglePost();
}
if (document.getElementById('latest-stories')) {
  loadLatestStories();
}
if (document.getElementById('stat-stories') || document.getElementById('stat-groups')) {
  loadHomeStats();
}
