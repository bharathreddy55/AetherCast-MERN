# VOX User Guide: End-to-End Platform Documentation

Welcome to **VOX**, a high-fidelity MERN stack podcast platform designed for independent creators, listeners, and administrators. This guide walks you through every feature of the platform, from listening to a podcast offline to managing creators and content moderation.

---

## 📖 Table of Contents
1. [Getting Started & Authentication](#-getting-started--authentication)
2. [User Roles & Permissions](#-user-roles--permissions)
3. [Listener Guide (End-to-End)](#-listener-guide-end-to-end)
4. [Creator Guide (End-to-End)](#-creator-guide-end-to-end)
5. [Admin Guide (End-to-End)](#-admin-guide-end-to-end)
6. [Keyboard Shortcuts & Tips](#-keyboard-shortcuts--tips)
7. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🔑 Getting Started & Authentication

VOX uses Supabase Auth to guarantee secure user sessions. 

### Creating an Account
1. Visit the [VOX Frontend App](https://aether-cast-mern.vercel.app/).
2. Click **Sign Up** on the top navigation bar.
3. Fill in your **Name**, **Username**, **Email**, and **Password**.
4. Alternatively, select **Continue with Google** to sign up instantly using your Google account.
5. Once registered, you will be logged in automatically with the default **Listener** role.

### Logging In
1. Click **Log In** on the top navigation bar.
2. Enter your credentials or click **Continue with Google**.
3. Upon logging in, you will be redirected to the main dashboard.

---

## 👥 User Roles & Permissions

Your user account has one of three roles, which controls what pages and tools you can access:

| Role | Permissions |
| :--- | :--- |
| **Listener** (Default) | Browse, listen, like, download offline, write reviews, post comments, create playlists, edit profile. |
| **Creator** | All listener features + create podcast shows, record/upload episodes, generate AI summaries/tags, view analytics dashboard. |
| **Admin** | All creator/listener features + manage user accounts, change roles, suspend/reactivate users, moderate comments/reviews. |

---

## 🎧 Listener Guide (End-to-End)

### 1. Browsing & Searching Content
* **Home Page**: Displays featured shows, popular episodes, and customized recommendations based on your listening habits.
* **Search Bar**: Type podcast titles, episode names, creators, or tags to find specific content.

### 2. Using the Global Sticky Player
VOX features a **Persistent Sticky Player** located at the bottom of the screen.
* **Seamless Transitions**: The audio continues playing uninterrupted as you browse through different pages of the app.
* **Playback Speed**: Adjust the speed control button (supports `0.5x`, `1.0x`, `1.5x`, and `2.0x`).
* **Sleep Timer**: Click the timer icon to schedule the player to turn off automatically in `15`, `30`, `45`, or `60` minutes.

### 3. Real-Time Synced Subtitles
When listening to an episode that has subtitles uploaded:
* Click the **Subtitles/Lyrics** button on the bottom player to open the subtitle drawer.
* The subtitles will scroll and highlight dynamically in sync with the audio speaker.

### 4. Offline Downloads (PWA Feature)
VOX is a **Progressive Web App (PWA)**, meaning you can install it on your device and listen to podcasts offline.
* **Installing the PWA**: Click the download/install icon in your browser URL bar (Chrome/Edge) or select "Add to Home Screen" (Safari on iOS).
* **Downloading Episodes**: On any episode page, click the **Download** button. The service worker will cache the audio track in your browser.
* **Offline Access**: Go to your **Downloads** tab to listen to saved episodes when you don't have internet access.

### 5. Playlists, Likes & Reviews
* **Liking an Episode**: Click the **Heart (❤️)** icon on any episode to save it to your **Liked Episodes** library.
* **Creating a Playlist**: Go to **My Playlists**, click **Create New Playlist**, give it a title, and add episodes directly.
* **Reviews & Comments**: Write reviews for your favorite podcast shows (with star ratings) or comment on specific episodes.

---

## 🎙️ Creator Guide (End-to-End)

> [!NOTE]
> If your account does not have Creator privileges, an administrator must promote your role via the Admin Panel.

### 1. The Creator Dashboard
Click on **Creator Studio** in your navigation menu. Here you will see:
* Overall listen stats, play counts, likes, and listener feedback.
* A list of your created podcasts and episodes.

### 2. Creating a Podcast Show
Before uploading episodes, you must create a show:
1. Click **Create Podcast** in the Creator Studio.
2. Provide a **Title**, **Description**, **Category/Genre**, and upload a **Cover Artwork** image.
3. Save the show. It will now be listed publicly under your profile.

### 3. Recording in the Recording Booth
If you don't have pre-recorded audio, you can record directly inside VOX:
1. Click **Recording Booth** in your Creator Studio.
2. Click **Start Recording** and allow microphone access.
3. A canvas-based audio wave will display real-time visualization of your voice.
4. Click **Stop** when finished. You can play back the recording to test quality.
5. Click **Use Recording** to load it directly into the episode publisher.

### 4. Publishing an Episode & AI Tagging
1. Under your podcast show, click **Add Episode**.
2. Fill in the **Title** and **Description**.
3. **Upload Audio**: Select your recorded audio file or upload an `.mp3`/`.wav`. The file is securely saved to Supabase Storage.
4. **AI Summaries & Smart Tags**:
   * Click **Generate AI Features**.
   * The Gemini 1.5 Flash engine will analyze your description or transcript and generate a professional, concise summary and highly relevant search tags.
   * Review the generated fields and click **Accept**.
5. Click **Publish**.

---

## 🛡️ Admin Guide (End-to-End)

Admin users can access the **Admin Command Center** from the navigation bar.

### 1. System Governance Dashboard
* Displays platform-wide statistics, total active users, number of published podcasts, and moderation queues.

### 2. User Accounts Management
1. Go to the **Users** tab.
2. Search users by username or email.
3. **Edit System Roles**: Change a user's role (e.g., promote a *Listener* to a *Creator*).
4. **Account Control**: Click **Suspend Account** to prevent a user from logging in or uploading content. Click **Reactivate** to lift the suspension.

### 3. Content Moderation Queue
If a listener flags a comment or review:
1. Go to the **Moderation Queue** tab.
2. You will see the flagged item, the reason for the flag, and the content.
3. **Actions**:
   * **Dismiss**: Removes the flag and keeps the content online.
   * **Delete**: Permanently removes the comment or review from the platform.

---

## ⌨️ Keyboard Shortcuts & Tips

Maximize your listening experience with these player shortcuts:

| Key | Action |
| :--- | :--- |
| `Spacebar` | Play or Pause the audio. |
| `Left Arrow` | Rewind 10 seconds. |
| `Right Arrow` | Fast Forward 10 seconds. |
| `M` | Mute or Unmute the player. |

---

## 🔧 Troubleshooting & FAQs

#### Q: Why is my offline download not playing?
* Make sure you have installed the PWA app. Caching requires a Service Worker, which might be blocked by browser private browsing modes (Incognito).

#### Q: I get a "CORS Error" or "Failed to Fetch" when calling the backend.
* Ensure you are running both frontend and backend servers. If deployed, confirm that the backend environment variable `CLIENT_URL` is set to your correct frontend deployment URL.

#### Q: The AI Summary button is not generating anything.
* Verify that the `GEMINI_API_KEY` is correctly defined in your backend `.env` file. If no key is provided, the feature will gracefully fallback to manual input.
