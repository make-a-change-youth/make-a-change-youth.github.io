# Make A Change Youth (MACY)

Static site (HTML/CSS/JS) + Firebase (Auth, Firestore). Live: <https://make-a-change-youth.github.io/>

## Run & deploy
- **Local:** `python3 -m http.server 8000` in repo root → http://localhost:8000 (must be served over HTTP, not `file://`).
- **Deploy:** `git add -A && git commit -m "…" && git push` → GitHub Pages rebuilds `main` (~1 min).
- **Firestore rules** live in `firestore.rules`. They are **not** auto-deployed — paste into Firebase Console → Firestore → Rules → **Publish**.

## Admin
Sign in with Google; the first user becomes `admin` (`js/auth.js`). Dashboard at `admin.html`:
- **Blog Posts** — create / edit / delete (Quill editor): title, cover, excerpt, tags, content; shows per-post views/likes/comments + totals.
- **Signups** — get-involved submissions; delete per row.
- **Users** — change roles (user / author / admin).

## Pages
| Page | Functionality |
|---|---|
| `index.html` | Hero, dynamic latest stories, live stats, **get-involved form** (`#cta`) |
| `blog.html` | Post grid from Firestore + **search** + **tag filter** |
| `blog/post.html` | Single post: view count, **like**, comments, **share** (X/FB/WhatsApp/copy) |
| `groups.html` | Group feed: like, readable comments, view count, **clickable groups** filter, join |
| `notifications.html` | Live **activity feed** (recent posts + comments + group posts) |
| `admin.html` | Dashboard (above) |

## Data (Firestore collections)
`blogPosts` · `comments` (`parentType`: `blog`/`group`) · `groups` · `groupPosts` · `users` · `signups`

## Engagement tracking
- **Blog:** views (per-device), likes (anonymous, per-device), comments. Counter writes allowed for anyone via `isCounterUpdate()` rule.
- **Groups:** views (per-device, logged-in only), likes (per-account toggle via `likedBy`), comments.
- **Get-involved:** saved to `signups` (rule `isValidSignup`) **and** emailed via Formspree (`js/getinvolved.js`).

## Known limitations
- Social link previews use one generic image per page; true per-post previews need prerendering (posts render via JS).
- Group view counts only count logged-in opens.
- No footer social links (no Instagram/TikTok accounts yet).

## ⚠️ Pending setup
- **Formspree:** submit the get-involved form once and click the confirmation email to `unitedyouth26@gmail.com` to activate email delivery. (Save-to-site already works.)

## Test checklist

**Auth / admin**
- [ ] Google sign-in works on live site and localhost
- [ ] `admin.html` loads for admin; non-admins see "no permission"

**Blog**
- [ ] Grid loads; **search** filters; **tag** chips filter
- [ ] Open a post → view count +1 (once per device)
- [ ] Like toggles (fills red) and persists after refresh
- [ ] Comment posts and is visible; count increments
- [ ] Share buttons open correct targets; "Copy link" copies URL
- [ ] New post created in admin (with tags) appears on blog + homepage

**Groups**
- [ ] Click a group → feed filters + header shows; "← All groups" resets
- [ ] Like toggles + persists
- [ ] "N Comments" expands and comments are **readable**; posting a comment works
- [ ] Join → member count 0 → 1; leave → back to 0
- [ ] Opening a discussion increments the view count (logged-in)
- [ ] Delete your own post

**Get-involved**
- [ ] Submit → "Thanks" message
- [ ] Entry appears in Admin → **Signups**
- [ ] Email received at `unitedyouth26@gmail.com` (after Formspree confirmation)

**General**
- [ ] Every page: favicon, nav + mobile menu, footer
- [ ] Pasting a post link in a chat/social app shows a title + image preview
- [ ] Mobile layout (blog grid, groups layout, forms) reflows cleanly
