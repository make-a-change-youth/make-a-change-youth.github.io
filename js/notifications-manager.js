import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Run a query but never throw — a missing collection/index shouldn't break the feed
async function safeGet(q) {
  try {
    return await getDocs(q);
  } catch (err) {
    console.warn('Activity query failed:', err.message);
    return { forEach: () => {} };
  }
}

// Build a merged, time-sorted feed from posts, comments, and group posts
export async function loadActivityFeed() {
  const container = document.getElementById('activity-feed');
  if (!container) return;

  const [posts, comments, groupPosts] = await Promise.all([
    safeGet(query(collection(db, 'blogPosts'), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(8))),
    safeGet(query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(12))),
    safeGet(query(collection(db, 'groupPosts'), orderBy('createdAt', 'desc'), limit(8)))
  ]);

  const items = [];

  posts.forEach(d => {
    const p = d.data();
    const ts = p.createdAt?.toDate?.();
    if (ts) items.push({ ts, kind: 'post', title: p.title, href: `blog/post.html?id=${d.id}` });
  });

  comments.forEach(d => {
    const c = d.data();
    const ts = c.createdAt?.toDate?.();
    if (!ts) return;
    const isBlog = c.parentType === 'blog';
    items.push({
      ts,
      kind: 'comment',
      author: c.authorName,
      snippet: c.content,
      where: isBlog ? 'a post' : 'a group',
      href: isBlog ? `blog/post.html?id=${c.parentId}` : 'groups.html'
    });
  });

  groupPosts.forEach(d => {
    const g = d.data();
    const ts = g.createdAt?.toDate?.();
    if (ts) items.push({ ts, kind: 'grouppost', author: g.authorName, group: g.groupName, href: 'groups.html' });
  });

  items.sort((a, b) => b.ts - a.ts);
  const top = items.slice(0, 18);

  if (top.length === 0) {
    container.innerHTML = '<p class="activity-empty">No activity yet. New posts, comments, and group discussions will show up here.</p>';
    return;
  }

  container.innerHTML = top.map(renderItem).join('');
}

function renderItem(it) {
  const time = timeAgo(it.ts);
  let tag, text;

  if (it.kind === 'post') {
    tag = '<span class="activity-tag activity-tag--post">Post</span>';
    text = `New story: <strong>${escapeHtml(it.title)}</strong>`;
  } else if (it.kind === 'comment') {
    tag = '<span class="activity-tag activity-tag--comment">Comment</span>';
    const snip = it.snippet ? ` &ldquo;${escapeHtml(truncate(it.snippet, 60))}&rdquo;` : '';
    text = `<strong>${escapeHtml(it.author)}</strong> commented on ${it.where}${snip}`;
  } else {
    tag = '<span class="activity-tag activity-tag--group">Group</span>';
    text = `<strong>${escapeHtml(it.author)}</strong> posted in <strong>${escapeHtml(it.group || 'a group')}</strong>`;
  }

  const inner = `${tag}<span class="activity-text">${text}</span><span class="activity-time">${time}</span>`;
  return it.href
    ? `<a class="activity-item" href="${it.href}">${inner}</a>`
    : `<div class="activity-item">${inner}</div>`;
}

function truncate(s, n) {
  s = (s || '').trim();
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

if (document.getElementById('activity-feed')) {
  loadActivityFeed();
}
