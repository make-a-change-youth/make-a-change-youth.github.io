import { db, auth } from './firebase-config.js';
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, increment, serverTimestamp, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const HEART = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
const FALLBACK_COVER = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=160&h=160&fit=crop';

const DEFAULT_GROUPS = [
  {
    name: 'Youth Changemakers Hub',
    description: 'A space for teens to share ideas, stories, and projects about making a difference in their communities. Connect with others, ask questions, and get inspired to lead local change together.',
    coverImage: 'https://static.wixstatic.com/media/64b673_a534f824b76242a5b150363281ae065c~mv2.png'
  },
  {
    name: 'Teen Bloggers Connect',
    description: 'For young writers and contributors of Path2Create to swap blog tips, brainstorm new topics, and support each other’s creative journeys. A place to grow your voice and improve your posts.',
    coverImage: 'https://static.wixstatic.com/media/64b673_f6b8f32d91d9426bb81c65e3f4a7f5b9~mv2.png'
  },
  {
    name: 'Community Impact Chat',
    description: 'Anyone passionate about positive change can join to discuss current youth initiatives, plan events, and celebrate small wins. Open to readers, supporters, and those ready to start something new.',
    coverImage: 'https://static.wixstatic.com/media/64b673_8047b21ee02e4cceac3363fc3e4d6973~mv2.png'
  },
  {
    name: 'Path2Create Group',
    description: '',
    coverImage: 'https://static.wixstatic.com/media/1cd9b7_fa5dc5086eab48c2bf0f5df91358187a~mv2.jpeg'
  }
];

let allGroups = [];
let activeGroupId = '';
let groupsPageInit = false;

// ===== Init =====
async function ensureGroups() {
  const snap = await getDocs(collection(db, 'groups'));
  if (!snap.empty) return;
  for (const g of DEFAULT_GROUPS) {
    await addDoc(collection(db, 'groups'), {
      name: g.name,
      description: g.description,
      coverImage: g.coverImage || '',
      memberCount: 0,
      members: [],
      createdAt: serverTimestamp()
    });
  }
}

export async function initGroupsPage() {
  if (groupsPageInit) return;
  const feed = document.getElementById('groups-feed-dynamic');
  const sidebar = document.getElementById('groups-sidebar-dynamic');
  if (!feed && !sidebar) return;
  groupsPageInit = true;

  try {
    await ensureGroups();
  } catch (err) {
    console.warn('Skipping group seeding:', err.message);
  }
  await loadGroups();
  loadSidebar();
  loadGroupFeed();
}

async function loadGroups() {
  const snap = await getDocs(collection(db, 'groups'));
  allGroups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const memberCountOf = (g) => (g.members && g.members.length) || 0;
const isMemberOf = (g) => !!(auth.currentUser && g.members?.includes(auth.currentUser.uid));

// ===== Sidebar =====
function loadSidebar() {
  const container = document.getElementById('groups-sidebar-dynamic');
  if (!container) return;

  let html = `
    <div class="sidebar-search"><input type="text" placeholder="Search groups" id="group-search-input"></div>
    <h3 class="sidebar-title">Groups</h3>
    <div class="sidebar-groups" id="sidebar-groups-list">
      <button class="sidebar-all ${activeGroupId === '' ? 'active' : ''}" data-group-id="">All groups</button>
  `;

  allGroups.forEach(g => {
    const count = memberCountOf(g);
    html += `
      <div class="sidebar-group ${activeGroupId === g.id ? 'active' : ''}" data-group-id="${g.id}" role="button" tabindex="0">
        <div class="sidebar-group-avatar">
          <img src="${g.coverImage || FALLBACK_COVER}" alt="${escapeHtml(g.name)}" width="80" height="80">
        </div>
        <div class="sidebar-group-info">
          <h4>${escapeHtml(g.name)}</h4>
          <span>${count} member${count !== 1 ? 's' : ''}</span>
        </div>
        <button class="sidebar-join-btn ${isMemberOf(g) ? 'joined' : ''}" data-group-id="${g.id}">
          ${isMemberOf(g) ? 'Joined' : 'Join'}
        </button>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelector('.sidebar-all')?.addEventListener('click', () => setActiveGroup(''));

  container.querySelectorAll('.sidebar-group').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-join-btn')) return;
      setActiveGroup(el.dataset.groupId);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') setActiveGroup(el.dataset.groupId);
    });
  });

  container.querySelectorAll('.sidebar-join-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleJoinGroup(btn.dataset.groupId);
    });
  });

  const searchInput = container.querySelector('#group-search-input');
  searchInput?.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase();
    container.querySelectorAll('.sidebar-group').forEach(el => {
      const name = el.querySelector('h4').textContent.toLowerCase();
      el.style.display = name.includes(val) ? '' : 'none';
    });
  });
}

function setActiveGroup(id) {
  activeGroupId = id;
  loadSidebar();
  loadGroupFeed();
}

// ===== Join / leave =====
async function toggleJoinGroup(groupId) {
  if (!auth.currentUser) {
    import('./auth.js').then(mod => mod.openAuthModal());
    return;
  }
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'groups', groupId);
  const g = allGroups.find(x => x.id === groupId);
  if (!g) return;
  const members = g.members || [];
  const isMember = members.includes(uid);

  try {
    if (isMember) {
      await updateDoc(ref, { members: arrayRemove(uid), memberCount: increment(-1) });
      g.members = members.filter(u => u !== uid);
    } else {
      await updateDoc(ref, { members: arrayUnion(uid), memberCount: increment(1) });
      g.members = [...members, uid];
    }
    loadSidebar();
    patchGroupHeader(g);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function patchGroupHeader(g) {
  const header = document.querySelector(`.group-header[data-group-id="${g.id}"]`);
  if (!header) return;
  const count = memberCountOf(g);
  const cs = header.querySelector('.group-header-count');
  if (cs) cs.textContent = `${count} member${count !== 1 ? 's' : ''}`;
  const jb = header.querySelector('.group-header-join');
  if (jb) {
    const member = isMemberOf(g);
    jb.textContent = member ? 'Joined' : 'Join';
    jb.classList.toggle('joined', member);
  }
}

// ===== Feed =====
async function loadGroupFeed() {
  const container = document.getElementById('groups-feed-dynamic');
  if (!container) return;

  try {
    const snap = await getDocs(query(collection(db, 'groupPosts'), orderBy('createdAt', 'desc')));
    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !activeGroupId || p.groupId === activeGroupId);

    let html = '';

    if (activeGroupId) {
      const g = allGroups.find(x => x.id === activeGroupId);
      if (g) html += renderGroupHeader(g);
    }

    if (auth.currentUser) html += renderComposer();

    if (posts.length === 0) {
      const place = activeGroupId ? 'in this group yet' : 'yet';
      const cta = auth.currentUser ? 'Be the first to share!' : 'Log in to start a discussion!';
      html += `<div class="empty-state"><p>No posts ${place}. ${cta}</p></div>`;
    }

    posts.forEach(p => { html += renderPost(p); });

    container.innerHTML = html;

    // Wire header
    document.getElementById('group-back')?.addEventListener('click', () => setActiveGroup(''));
    container.querySelector('.group-header-join')?.addEventListener('click', (e) =>
      toggleJoinGroup(e.currentTarget.dataset.groupId));

    wireComposer();
    posts.forEach(p => wirePost(p.id));
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading posts.</p></div>';
    console.error(err);
  }
}

function renderGroupHeader(g) {
  const count = memberCountOf(g);
  return `
    <div class="group-header" data-group-id="${g.id}">
      <button class="group-back" id="group-back">&larr; All groups</button>
      <div class="group-header-main">
        <div class="group-header-avatar"><img src="${g.coverImage || FALLBACK_COVER}" alt="${escapeHtml(g.name)}"></div>
        <div class="group-header-info">
          <h2>${escapeHtml(g.name)}</h2>
          <span class="group-header-count">${count} member${count !== 1 ? 's' : ''}</span>
          ${g.description ? `<p>${escapeHtml(g.description)}</p>` : ''}
        </div>
        <button class="sidebar-join-btn group-header-join ${isMemberOf(g) ? 'joined' : ''}" data-group-id="${g.id}">
          ${isMemberOf(g) ? 'Joined' : 'Join'}
        </button>
      </div>
    </div>
  `;
}

function renderComposer() {
  const u = auth.currentUser;
  const initial = (u.displayName || u.email || 'U')[0].toUpperCase();
  return `
    <div class="feed-new-post">
      <form id="new-group-post-form">
        <div class="composer-top">
          <div class="feed-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
          <textarea id="group-post-content" placeholder="Share something with the community…" rows="2"></textarea>
        </div>
        <div class="composer-actions">
          <select id="post-group-select"><option value="">Choose a group…</option></select>
          <button type="submit" class="btn btn-primary btn-sm">Post</button>
        </div>
      </form>
    </div>
  `;
}

function renderPost(p) {
  const date = p.createdAt?.toDate?.() ? timeAgo(p.createdAt.toDate()) : '';
  const initial = (p.authorName || 'U')[0].toUpperCase();
  const liked = auth.currentUser && p.likedBy?.includes(auth.currentUser.uid);
  const mine = auth.currentUser && p.authorId === auth.currentUser.uid;

  return `
    <div class="feed-post" data-post-id="${p.id}">
      <div class="feed-author">
        <div class="feed-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="feed-author-info">
          <strong>${escapeHtml(p.authorName)}</strong>
          <span>${date}${p.groupName ? ' &middot; ' + escapeHtml(p.groupName) : ''}</span>
        </div>
        ${mine ? `<button class="feed-post-delete" title="Delete post" aria-label="Delete post">${TRASH}</button>` : ''}
      </div>
      <div class="feed-post-body"><p>${escapeHtml(p.content)}</p></div>
      <div class="feed-actions">
        <button class="feed-action like-action ${liked ? 'liked' : ''}" aria-pressed="${liked ? 'true' : 'false'}">
          ${HEART}<span class="like-count">${p.likes || 0}</span>
        </button>
        <button class="feed-action comment-toggle">
          <span class="comment-count">${p.commentCount || 0}</span> Comments
        </button>
        <span class="feed-views">${p.views || 0} Views</span>
      </div>
      <div class="feed-comments" id="comments-${p.id}" hidden>
        <div class="feed-comments-list" id="comments-list-${p.id}"></div>
        ${auth.currentUser
          ? `<input type="text" class="group-comment-input" placeholder="Write a comment…">`
          : '<p class="feed-comment-login">Log in to join the conversation.</p>'}
      </div>
    </div>
  `;
}

function wireComposer() {
  const select = document.getElementById('post-group-select');
  if (select) {
    allGroups.forEach(g => {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = g.name;
      if (g.id === activeGroupId) o.selected = true;
      select.appendChild(o);
    });
  }

  const form = document.getElementById('new-group-post-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = select.value;
    const content = document.getElementById('group-post-content').value.trim();
    if (!groupId) { alert('Please choose a group.'); return; }
    if (!content) { alert('Please write something.'); return; }
    const g = allGroups.find(x => x.id === groupId);

    try {
      await addDoc(collection(db, 'groupPosts'), {
        groupId,
        groupName: g?.name || '',
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
        content,
        createdAt: serverTimestamp(),
        views: 0,
        likes: 0,
        likedBy: [],
        commentCount: 0
      });
      loadGroupFeed();
    } catch (err) {
      alert('Error posting: ' + err.message);
    }
  });
}

function wirePost(postId) {
  const root = document.querySelector(`.feed-post[data-post-id="${postId}"]`);
  if (!root) return;
  root.querySelector('.like-action')?.addEventListener('click', (e) => toggleLikePost(postId, e.currentTarget));
  root.querySelector('.comment-toggle')?.addEventListener('click', () => toggleComments(postId));
  root.querySelector('.feed-post-delete')?.addEventListener('click', () => deletePost(postId));
  const input = root.querySelector('.group-comment-input');
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGroupComment(postId, input); });
}

// ===== Likes =====
async function toggleLikePost(postId, btn) {
  if (!auth.currentUser) {
    import('./auth.js').then(mod => mod.openAuthModal());
    return;
  }
  if (btn.disabled) return;
  btn.disabled = true;

  const uid = auth.currentUser.uid;
  const ref = doc(db, 'groupPosts', postId);
  const liked = btn.classList.contains('liked');
  const countEl = btn.querySelector('.like-count');
  const cur = parseInt(countEl.textContent, 10) || 0;

  try {
    if (liked) {
      await updateDoc(ref, { likedBy: arrayRemove(uid), likes: increment(-1) });
      btn.classList.remove('liked');
      btn.setAttribute('aria-pressed', 'false');
      countEl.textContent = Math.max(0, cur - 1);
    } else {
      await updateDoc(ref, { likedBy: arrayUnion(uid), likes: increment(1) });
      btn.classList.add('liked');
      btn.setAttribute('aria-pressed', 'true');
      countEl.textContent = cur + 1;
    }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ===== Comments + views =====
async function toggleComments(postId) {
  const wrap = document.getElementById(`comments-${postId}`);
  if (!wrap) return;
  const opening = wrap.hidden;
  wrap.hidden = !wrap.hidden;
  if (opening) {
    await loadPostComments(postId);
    countView(postId);
  }
}

async function loadPostComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (!list) return;
  list.innerHTML = '<p class="feed-comments-note">Loading…</p>';

  try {
    const snap = await getDocs(query(
      collection(db, 'comments'),
      where('parentId', '==', postId),
      where('parentType', '==', 'group'),
      orderBy('createdAt', 'desc')
    ));

    if (snap.empty) {
      list.innerHTML = '<p class="feed-comments-note">No comments yet. Start the conversation.</p>';
      return;
    }

    list.innerHTML = '';
    snap.forEach(d => {
      const c = d.data();
      const date = c.createdAt?.toDate?.() ? timeAgo(c.createdAt.toDate()) : '';
      const el = document.createElement('div');
      el.className = 'feed-comment';
      el.innerHTML = `
        <div class="feed-comment-avatar" aria-hidden="true">${escapeHtml((c.authorName || 'U')[0].toUpperCase())}</div>
        <div class="feed-comment-content">
          <strong>${escapeHtml(c.authorName)}</strong><span>${date}</span>
          <p>${escapeHtml(c.content)}</p>
        </div>
      `;
      list.appendChild(el);
    });
  } catch (err) {
    list.innerHTML = '<p class="feed-comments-note">Could not load comments.</p>';
    console.error(err);
  }
}

// Count a view once per device when a member opens the discussion
function countView(postId) {
  if (!auth.currentUser) return; // group post writes require login
  const key = `macy_gviewed_${postId}`;
  if (localStorage.getItem(key)) return;
  updateDoc(doc(db, 'groupPosts', postId), { views: increment(1) })
    .then(() => {
      localStorage.setItem(key, '1');
      const el = document.querySelector(`.feed-post[data-post-id="${postId}"] .feed-views`);
      if (el) el.textContent = `${(parseInt(el.textContent, 10) || 0) + 1} Views`;
    })
    .catch(() => {});
}

async function addGroupComment(postId, input) {
  const content = input.value.trim();
  if (!content || !auth.currentUser) return;

  try {
    await addDoc(collection(db, 'comments'), {
      parentId: postId,
      parentType: 'group',
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
      content,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'groupPosts', postId), { commentCount: increment(1) });
    input.value = '';
    await loadPostComments(postId);

    const countEl = document.querySelector(`.feed-post[data-post-id="${postId}"] .comment-count`);
    if (countEl) countEl.textContent = (parseInt(countEl.textContent, 10) || 0) + 1;
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'groupPosts', postId));
    loadGroupFeed();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }
}

// ===== Helpers =====
function timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago';
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Auto-init on the groups page
if (document.getElementById('groups-feed-dynamic') || document.getElementById('groups-sidebar-dynamic')) {
  document.addEventListener('auth-ready', () => initGroupsPage());
  setTimeout(() => initGroupsPage(), 1500);
}
