import { db, auth } from './firebase-config.js';
import {
  collection, getDocs, getDoc, doc, updateDoc, addDoc, deleteDoc,
  query, where, orderBy, limit, increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Load all published blog posts for the listing page
export async function loadBlogPosts() {
  const container = document.getElementById('blog-grid');
  if (!container) return;

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
            <span class="blog-card-avatar">${escapeHtml((post.authorName || 'U').charAt(0).toUpperCase())}</span>
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

    // Increment view count
    updateDoc(doc(db, 'blogPosts', postId), { views: increment(1) }).catch(() => {});

    container.innerHTML = `
      <article class="blog-post">
        <div class="blog-post-header">
          <h1>${escapeHtml(post.title)}</h1>
          <div class="blog-post-byline">
            <span class="blog-card-avatar">${escapeHtml((post.authorName || 'U').charAt(0).toUpperCase())}</span>
            <span>By <strong>${escapeHtml(post.authorName)}</strong> &middot; ${date} &middot; ${post.readTime || 3} min read</span>
          </div>
        </div>
        ${post.coverImage ? `
        <div class="blog-post-hero">
          <img src="${post.coverImage}" alt="${escapeHtml(post.title)}" width="800" height="400">
        </div>` : ''}
        <div class="blog-post-content">${post.content}</div>
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
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error loading post.</p><a href="../blog.html" class="btn btn-outline">Back to Blog</a></div>`;
    console.error('Error loading post:', err);
  }
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
        <div class="comment-avatar">${(c.authorName || 'U')[0].toUpperCase()}</div>
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
