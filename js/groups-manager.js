import { db, auth } from './firebase-config.js';
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, increment, serverTimestamp, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const DEFAULT_GROUPS = [
  {
    name: 'Youth Changemakers Hub',
    description: 'A space for teens to share ideas, stories, and projects about making a difference in their communities. Connect with others, ask questions, and get inspired to lead local change together.',
    coverImage: 'https://static.wixstatic.com/media/64b673_a534f824b76242a5b150363281ae065c~mv2.png',
    memberCount: 4
  },
  {
    name: 'Teen Bloggers Connect',
    description: 'For young writers and contributors of M.A.C.Y to swap blog tips, brainstorm new topics, and support each other’s creative journeys. A place to grow your voice and improve your posts.',
    coverImage: 'https://static.wixstatic.com/media/64b673_f6b8f32d91d9426bb81c65e3f4a7f5b9~mv2.png',
    memberCount: 1
  },
  {
    name: 'Community Impact Chat',
    description: 'Anyone passionate about positive change can join to discuss current youth initiatives, plan events, and celebrate small wins. Open to readers, supporters, and those ready to start something new.',
    coverImage: 'https://static.wixstatic.com/media/64b673_8047b21ee02e4cceac3363fc3e4d6973~mv2.png',
    memberCount: 1
  },
  {
    name: 'Make A Change Youth Group',
    description: '',
    coverImage: 'https://static.wixstatic.com/media/1cd9b7_fa5dc5086eab48c2bf0f5df91358187a~mv2.jpeg',
    memberCount: 1
  }
];

// Seed default groups if none exist
async function ensureGroups() {
  const snap = await getDocs(collection(db, 'groups'));
  if (!snap.empty) return;

  for (const g of DEFAULT_GROUPS) {
    await addDoc(collection(db, 'groups'), {
      name: g.name,
      description: g.description,
      coverImage: g.coverImage || '',
      memberCount: g.memberCount,
      members: [],
      createdAt: serverTimestamp()
    });
  }
}

// Load everything on the groups page
let groupsPageInit = false;
export async function initGroupsPage() {
  if (groupsPageInit) return;
  const feed = document.getElementById('groups-feed-dynamic');
  const sidebar = document.getElementById('groups-sidebar-dynamic');
  if (!feed && !sidebar) return;
  groupsPageInit = true;

  // The first admin visit creates the default groups; ignore failures
  // (e.g. a non-admin visiting before any groups exist).
  try {
    await ensureGroups();
  } catch (err) {
    console.warn('Skipping group seeding:', err.message);
  }
  loadSidebar();
  loadGroupFeed();
}

// Load sidebar with groups
async function loadSidebar() {
  const container = document.getElementById('groups-sidebar-dynamic');
  if (!container) return;

  try {
    const snap = await getDocs(collection(db, 'groups'));
    let html = `
      <div class="sidebar-search"><input type="text" placeholder="Search" id="group-search-input"></div>
      <h3 class="sidebar-title">Suggested Groups</h3>
      <div class="sidebar-groups" id="sidebar-groups-list">
    `;

    snap.forEach(docSnap => {
      const g = docSnap.data();
      const isMember = auth.currentUser && g.members?.includes(auth.currentUser.uid);

      html += `
        <div class="sidebar-group" data-group-id="${docSnap.id}">
          <div class="sidebar-group-avatar">
            <img src="${g.coverImage || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=80&h=80&fit=crop'}" alt="${escapeHtml(g.name)}" width="80" height="80">
          </div>
          <div class="sidebar-group-info">
            <h4>${escapeHtml(g.name)}</h4>
            <span>${g.memberCount || 0} member${g.memberCount !== 1 ? 's' : ''}</span>
            ${g.description ? `<p style="font-size:.8rem;color:#666;margin:.3rem 0 0;line-height:1.35;">${escapeHtml(g.description)}</p>` : ''}
          </div>
          <button class="sidebar-join-btn ${isMember ? 'joined' : ''}" data-group-id="${docSnap.id}">
            ${isMember ? 'Joined' : 'Join'}
          </button>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Join/leave handlers
    container.querySelectorAll('.sidebar-join-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleJoinGroup(btn.dataset.groupId, btn));
    });

    // Search filter
    const searchInput = container.querySelector('#group-search-input');
    searchInput?.addEventListener('input', () => {
      const val = searchInput.value.toLowerCase();
      container.querySelectorAll('.sidebar-group').forEach(el => {
        const name = el.querySelector('h4').textContent.toLowerCase();
        el.style.display = name.includes(val) ? '' : 'none';
      });
    });
  } catch (err) {
    container.innerHTML = '<p style="color:#555;padding:1rem;">Error loading groups.</p>';
    console.error(err);
  }
}

// Toggle join/leave
async function toggleJoinGroup(groupId, btn) {
  if (!auth.currentUser) {
    import('./auth.js').then(mod => mod.openAuthModal());
    return;
  }

  const uid = auth.currentUser.uid;
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  const members = groupSnap.data()?.members || [];
  const isMember = members.includes(uid);

  try {
    if (isMember) {
      await updateDoc(groupRef, { members: arrayRemove(uid), memberCount: increment(-1) });
      btn.textContent = 'Join';
      btn.classList.remove('joined');
    } else {
      await updateDoc(groupRef, { members: arrayUnion(uid), memberCount: increment(1) });
      btn.textContent = 'Joined';
      btn.classList.add('joined');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Load group feed with posts
async function loadGroupFeed() {
  const container = document.getElementById('groups-feed-dynamic');
  if (!container) return;

  try {
    const q = query(collection(db, 'groupPosts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    // Add new post form at top
    let html = '';
    if (auth.currentUser) {
      html += `
        <div class="feed-post feed-new-post">
          <form id="new-group-post-form">
            <div class="feed-author" style="margin-bottom:0.75rem;">
              <div class="feed-avatar">${(auth.currentUser.displayName || 'U')[0].toUpperCase()}</div>
              <div class="feed-author-info"><strong>${escapeHtml(auth.currentUser.displayName || auth.currentUser.email)}</strong></div>
            </div>
            <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
              <select id="post-group-select" class="feed-comment-input" style="border-radius:8px;padding:8px;">
                <option value="">Select a group...</option>
              </select>
            </div>
            <textarea id="group-post-content" class="feed-comment-input" style="border-radius:8px;min-height:80px;resize:vertical;" placeholder="Share your thoughts..."></textarea>
            <button type="submit" class="btn btn-primary btn-sm" style="margin-top:0.75rem;">Post</button>
          </form>
        </div>
      `;
    }

    if (snap.empty && !auth.currentUser) {
      html += '<div class="empty-state"><p>No posts yet. Log in to start a discussion!</p></div>';
    } else if (snap.empty) {
      html += '<div class="empty-state"><p>No posts yet. Be the first to share!</p></div>';
    }

    snap.forEach(docSnap => {
      const p = docSnap.data();
      const date = p.createdAt?.toDate?.()
        ? timeAgo(p.createdAt.toDate())
        : '';

      html += `
        <div class="feed-post">
          <div class="feed-author">
            <div class="feed-avatar">${(p.authorName || 'U')[0].toUpperCase()}</div>
            <div class="feed-author-info">
              <strong>${escapeHtml(p.authorName)}</strong><br>
              <span>${date}${p.groupName ? ' &middot; posted in ' + escapeHtml(p.groupName) : ''}</span>
            </div>
          </div>
          <div class="feed-post-body"><p>${escapeHtml(p.content)}</p></div>
          <div class="feed-actions">
            <span>${p.commentCount || 0} Comments</span>
            <span>${p.views || 0} Views</span>
          </div>
          <div class="feed-comment-box">
            <input type="text" class="feed-comment-input group-comment-input" placeholder="Write a comment..." data-post-id="${docSnap.id}" ${!auth.currentUser ? 'disabled' : ''}>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Populate group select
    const select = document.getElementById('post-group-select');
    if (select) {
      const groupsSnap = await getDocs(collection(db, 'groups'));
      groupsSnap.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.data().name;
        select.appendChild(opt);
      });
    }

    // New post form handler
    const form = document.getElementById('new-group-post-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const groupId = document.getElementById('post-group-select').value;
      const content = document.getElementById('group-post-content').value.trim();
      if (!groupId) { alert('Please select a group.'); return; }
      if (!content) { alert('Please write something.'); return; }

      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      const groupName = groupDoc.data()?.name || '';

      try {
        await addDoc(collection(db, 'groupPosts'), {
          groupId,
          groupName,
          authorId: auth.currentUser.uid,
          authorName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
          content,
          createdAt: serverTimestamp(),
          views: 0,
          likes: 0,
          commentCount: 0
        });
        loadGroupFeed();
      } catch (err) {
        alert('Error posting: ' + err.message);
      }
    });

    // Comment input handlers
    container.querySelectorAll('.group-comment-input').forEach(input => {
      input.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        const content = input.value.trim();
        if (!content) return;
        if (!auth.currentUser) return;

        const postId = input.dataset.postId;
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
          loadGroupFeed();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading posts.</p></div>';
    console.error(err);
  }
}

function timeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
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

// Auto-init if on groups page
if (document.getElementById('groups-feed-dynamic') || document.getElementById('groups-sidebar-dynamic')) {
  // Wait for auth to settle before loading
  document.addEventListener('auth-ready', () => initGroupsPage());
  // Fallback if auth already resolved
  setTimeout(() => initGroupsPage(), 1500);
}
