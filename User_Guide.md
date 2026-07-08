# VOX User Guide — End-to-End Platform Documentation

Welcome to **VOX**, a premium MERN stack podcast streaming platform built for independent creators, active listeners, and platform administrators. This guide covers every feature from your first login to moderating content as an admin.

---

## 📖 Table of Contents
1. [Getting Started & Authentication](#-getting-started--authentication)
2. [User Roles & Permissions](#-user-roles--permissions)
3. [Listener Guide](#-listener-guide)
4. [Creator Guide](#-creator-guide)
5. [Admin Guide](#-admin-guide)
6. [UI & Accessibility](#-ui--accessibility)
7. [Keyboard Shortcuts](#-keyboard-shortcuts)
8. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🔑 Getting Started & Authentication

VOX uses **Supabase Auth** for secure, token-based user sessions.

### Creating an Account
1. Visit the [VOX App](https://aether-cast-mern.vercel.app/).
2. Click **Sign Up** in the top navigation bar.
3. Fill in your **Name**, **Username**, **Email**, and **Password**.
4. Alternatively, click **Continue with Google** to sign up instantly.
5. Once registered, you will be automatically logged in with the default **Listener** role.

### Logging In
1. Click **Log In** in the top navigation bar.
2. Enter your credentials or use **Continue with Google**.
3. Upon login you are redirected to your personalized home feed.

### Forgot Password
1. Click **Forgot password?** on the login page.
2. Enter your email. A reset link will be sent to your inbox.
3. Follow the link to set a new password.

---

## 👥 User Roles & Permissions

| Role | What You Can Do |
| :--- | :--- |
| **Listener** *(Default)* | Browse & search, listen, like episodes, download offline, write reviews & comments, create playlists, manage profile. |
| **Creator** | All listener features + create/edit podcast shows, record & upload episodes, manage draft content, generate AI summaries, view analytics. |
| **Admin** | All creator/listener features + manage all user accounts & roles, moderate flagged content, full CRUD over all podcasts & episodes. |

> To be upgraded from Listener to Creator, contact your platform administrator.

---

## 🎧 Listener Guide

### 1. Browsing & Searching
- **Landing Page** — Displays featured shows, trending broadcasts, and platform highlights.
- **Explore Page** — Full search with filters by category, language, and status.
- **Search Bar** — Type podcast titles, episode names, creator names, or tags.

### 2. The Global Sticky Player
The **Persistent Player** lives at the bottom of the screen at all times.
- Audio keeps playing uninterrupted as you navigate between pages.
- **Speed Control** — Tap the speed button to cycle: `0.5×` → `1.0×` → `1.5×` → `2.0×`.
- **Sleep Timer** — Click the clock icon to auto-stop after `15`, `30`, `45`, or `60` minutes.
- **Volume** — Drag the volume slider or press `M` to mute/unmute.

### 3. Interactive Transcripts
When an episode has a transcript attached:
- Open the episode's detail page.
- Click the **Transcript** tab to read the full text.
- The active line highlights and auto-scrolls in real-time as the audio plays.

### 4. Listening Parties 🎉
Host or join a synchronized listening session with friends:
1. Open any episode detail page.
2. Click **Start Listening Party**.
3. Share the generated room link with friends.
4. Everyone's playback stays in sync — including play, pause, and seek.
5. Live chat with emoji reactions is available inside the party drawer.

### 5. Offline Downloads (PWA)
VOX is a **Progressive Web App** — install it like a native app:
- **Installing** — Click the install icon in your browser address bar (Chrome/Edge) or tap **"Add to Home Screen"** (Safari iOS).
- **Downloading Episodes** — Click the **Download** button on any episode. The service worker caches the audio.
- **Offline Playback** — Go to the **Downloads** tab to access cached episodes without internet.

### 6. Playlists, Likes & Reviews
- **Like an Episode** — Click the **Heart ❤️** icon to save to your Liked Episodes library.
- **Create a Playlist** — Go to **Playlists → Create New Playlist**, name it, then add episodes.
- **Reviews** — Rate and review any podcast show with a star rating + written review.
- **Comments** — Comment on individual episodes. Flag inappropriate content with the report button.

### 7. Listen History & Library
- **Library** — Your full chronological listening history with timestamps.
- **Liked Episodes** — All episodes you've hearted, accessible from your profile.

---

## 🎙️ Creator Guide

> [!NOTE]
> The Creator role must be assigned by an Admin. Once granted, the **Creator Workspace** appears in your navigation.

### 1. The Creator Workspace
Click **Dashboard** in the navbar to open your Creator Workspace. Tabs include:
- **Analytics** — Listen counts, play trends, and listener stats.
- **My Podcasts** — All your published podcast shows.
- **Upload Episode** — Add a new episode to an existing show.
- **Recording Booth** — Record audio directly in the browser.
- **Drafts Workspace** — Manage all your unpublished draft content.

### 2. Creating a Podcast Show
1. Click **Create Podcast** inside My Podcasts.
2. Fill in **Title**, **Description**, **Category**, **Language**, and upload a **Cover Image**.
3. Set **Status** to `draft` to save privately or `published` to go live immediately.
4. Click **Create Show**.

### 3. Editing a Podcast Show
You can update your show at any time:
1. Open the show's detail page.
2. Click the **Edit Broadcast Show** button (only visible to the creator of that show).
3. Update any fields — title, description, category, language, status, cover art, or banner image.
4. Click **Save Changes**.

### 4. Recording in the Recording Booth
1. Click **Recording Booth** in the Creator Workspace.
2. Click **Start Recording** and allow microphone access when prompted.
3. A live canvas waveform visualizes your voice in real time.
4. Click **Stop Recording** when done. Play back to check quality.
5. Click **Use Recording** to load it directly into the episode upload form.

### 5. Uploading & Publishing an Episode
1. Click **Upload Episode** in your workspace.
2. Select the **Podcast Show** from the dropdown.
3. Fill in **Episode Title** and **Description**.
4. Upload your `.mp3` or `.wav` audio file.
5. Optionally paste or upload a **Transcript**.
6. Set **Status**: `draft` (private, visible only to you) or `published` (live to all listeners).
7. Click **Upload Episode**.

### 6. AI Summary & Smart Tagging
After uploading an episode:
1. Click **Generate AI Features** on the episode.
2. Gemini 1.5 Flash analyzes your description or transcript.
3. It outputs a professional summary and relevant search tags.
4. Review, edit if needed, then click **Accept**.

### 7. Transcript Editor
1. Open any episode you own.
2. Click **Edit Transcript**.
3. The inline editor lets you type or paste transcript text.
4. Use the **Find & Replace** tool for bulk edits.
5. Click **Save Transcript**.

### 8. Drafts Workspace
All your unpublished content lives here:
- **Draft Shows** — Podcast series saved as `draft`. Click **Publish Show** to go live.
- **Draft Episodes** — Episodes uploaded as `draft`. Click **Publish Episode** to notify followers and go live.

---

## 🛡️ Admin Guide

Access the **Admin Command Center** from the navbar (Admin accounts only).

### 1. Metrics Overview
A real-time dashboard showing:
- Total users, total podcasts, total episodes, total comments.
- Pending moderation queue count.

### 2. User Accounts Management
1. Go to the **User Accounts** tab.
2. Search by name, username, or email.
3. **Change Role** — Promote a Listener to Creator, or demote as needed.
4. **Suspend Account** — Blocks login and content uploads.
5. **Reactivate Account** — Lifts the suspension.

### 3. Content Moderation Queue
When a user flags a comment or review:
1. Go to the **Flagged Content** tab.
2. Review the flagged item and the reason.
3. Choose an action:
   - **Dismiss** — Removes the flag, content stays online.
   - **Delete** — Permanently removes the comment or review.

### 4. Podcasts & Episodes CRUD
- **Podcasts CRUD tab** — View, edit, or delete any podcast show on the platform.
- **Episodes CRUD tab** — View, edit, or delete any episode on the platform.

---

## 🎨 UI & Accessibility

### Theme Toggle
Click the **Sun / Moon** icon in the navbar to switch between:
- **Light Mode** — Clean white background with a green accent color scheme (default).
- **Dark Mode** — Deep black background with an orange accent color scheme.

Your preference is saved automatically and persists across sessions.

### Custom Cursor
VOX replaces the default browser cursor with a **premium glowing cursor**:
- A small glowing **dot** that snaps to your cursor position instantly.
- A slightly larger **ring** that smoothly follows behind it.
- Both **expand and glow** when hovering over interactive elements (buttons, cards, links).

### Navbar Effects
- **Scroll Blur** — The navbar becomes frosted glass as you scroll down the page.
- **Active Indicator** — A small pulsing dot appears beside the current page's nav link.
- **Liquid Underline** — A smooth gradient line expands under each link on hover.
- **Magnetic Buttons** — Nav links subtly attract toward your cursor as you hover.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Spacebar` | Play or Pause |
| `← Left Arrow` | Rewind 10 seconds |
| `→ Right Arrow` | Fast Forward 10 seconds |
| `M` | Mute / Unmute |

---

## 🔧 Troubleshooting & FAQs

#### Q: Why can't I see my draft podcasts in the Creator Workspace?
Make sure you are logged in as the creator who owns those drafts. The backend only returns draft content when the authenticated user's ID matches the creator ID.

#### Q: My offline download isn't playing.
Service Workers require the app to be installed as a PWA and cannot function in Incognito/Private browsing mode. Switch to a regular browser tab.

#### Q: The AI Summary button isn't generating anything.
Check that the `GEMINI_API_KEY` is correctly set in the backend `.env` file. If missing, the feature gracefully falls back to manual input with no error shown.

#### Q: I see a CORS or "Failed to Fetch" error.
Ensure both frontend and backend servers are running locally. If deployed, confirm the backend `CLIENT_URL` environment variable exactly matches your frontend deployment URL.

#### Q: The delete popup appears but I need to scroll to reach it.
This was a known issue that has been resolved. If you still see it, force-refresh the page (`Ctrl+Shift+R`) to clear the browser cache and load the latest version.

#### Q: Can I change my role myself?
No. Role changes (e.g., Listener → Creator) must be performed by a platform Admin via the Admin Command Center.
