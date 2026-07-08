# VOX — Project Defense & Technical Review Guide
## MERN Stack Production-Style Podcast Streaming Platform

This document serves as the official technical blueprint and defense manual for the **VOX** platform. It has been prepared to help you defend this project during academic presentations (Final Year Project Viva) and professional technical reviews. It covers architecture, request lifecycles, codebase walkthroughs, database schemas, security models, and answers to hard questions designed to test if you genuinely built the system.

---

## 📖 Table of Contents
1. **Project Overview** (Problem, Objectives, Features, Tech Stack)
2. **System Architecture & Request Lifecycle** (Visual Diagrams & Flowcharts)
3. **Codebase Walkthrough** (Folder Structure & Hierarchy)
4. **Core MERN Concepts Explained** (Why & Where they are used)
5. **Database Design & Schema Reference** (Collections & Relationships)
6. **API Endpoints Reference** (Purpose, Request, Response, Validation)
7. **Security Architecture** (JWT, Roles, CORS, Helmet, Rate Limiter)
8. **Deployment & DevOps** (Vercel, Render, Supabase, Atlas)
9. **Performance & Scalability Optimization** (Snapping, Lerp, Indexing)
10. **MERN Core Use Cases** (Role of MongoDB, Express, React, Node)
11. **Defense Q&A: Hard Reviewer Questions & Expert Answers**

---

## 1. Project Overview

### Problem Statement
Independent audio creators face highly fragmented workflows. They must record audio in local tools, upload it to host servers, manually write summaries, research relevant SEO tags, transcribe speech, and use external messaging tools to host synchronous listening events. Listeners, on the other hand, encounter audio dropouts during page transitions, lack offline playback capabilities on mobile web browsers, and suffer from static, uninspiring user interfaces. 

### Objectives
* Build **VOX** (formerly AetherCast), a high-fidelity, role-based MERN stack platform that integrates the entire podcast lifecycle: in-browser audio recording, AI-driven tagging and metadata generation, interactive word-sync transcripts, offline PWA access, real-time shared listening rooms, and administrative content governance.
* Ensure a premium user experience featuring custom cursors, smooth scroll-morphing capsules, and a floating mini-player with spring physics.

### Target Users
1. **Listeners**: Browse, stream, join real-time listening parties, read live transcripts, create playlists, and download files for offline use.
2. **Creators**: Create/edit podcast shows, manage draft episodes, record voice directly, invoke Gemini AI to generate metadata, and analyze stats.
3. **Administrators**: Moderate reviews/comments, configure user roles, suspend/reactivate accounts, and manage platform-wide media resources.

### Tech Stack
* **Frontend**: React 18 (compiled via Vite), React Context API for global state, React Router v6, HTML5 Canvas API (visualizers), Service Workers (PWA offline caching), IntersectionObserver (scroll reveal).
* **Backend**: Node.js runtime, Express.js framework, MVC pattern, Multer (file upload parsing).
* **Database**: MongoDB Atlas, Mongoose ODM.
* **Services**: Supabase Auth (JWT validation), Supabase Storage (media asset buckets), Google Gemini 1.5 Flash API (AI text analysis).

---

## 2. Complete Architecture

### System Architecture
The application runs as a decoupled architecture: the React client communicates over HTTPS with the Node/Express REST API.

```
+-----------------------------------------------------------+
|                      Client Browser                       |
|   +---------------------------------------------------+   |
|   |                  React Frontend                   |   |
|   |   - Context API   - Router    - Canvas Player      |   |
|   +---------------------------------------------------+   |
+-----------------------------------------------------------+
        |                                           |
  HTTPS / REST Calls (Auth Header)            Session Sync
        v                                           v
+-------------------------------+           +---------------+
|     Express Backend Server    |           | Supabase Auth |
|  - Router     - Controllers   |           |  - Session DB |
|  - Middleware - Mongoose ODM  |           |  - JWT Issuer |
+-------------------------------+           +---------------+
    |             |             |
    v             v             v
+-------+   +-----------+   +--------+
| Mongo |   | Supabase  |   | Gemini |
| Atlas |   |  Storage  |   | AI API |
+-------+   +-----------+   +--------+
```

### Complete Request Lifecycle
The diagram below details the sequence of a secure, authorized user request (e.g., uploading an episode):

```
[ User Action ]
       │  (e.g., Click "Upload Episode" with audio file and description)
       ▼
[ React Frontend ]
       │  (Form data validation; retrieve Auth token from Context)
       ▼
[ Fetch API / HTTP Request ]
       │  (POST request to /api/podcasts/:id/episodes; Authorization: Bearer <JWT>)
       ▼
[ Express Router ]
       │  (Route matches endpoint backend/src/routes/podcastRoutes.js)
       ▼
[ Middleware Stack ]
       │  1. cors() & helmet() -> Security headers
       │  2. rateLimit() -> Rate limit validation
       │  3. protect() -> Decrypt token, verify signature with Supabase public key
       │  4. multer.single('audio') -> Parse multipart form-data, write file to buffer
       ▼
[ Controller ]
       │  (podcastController.js - extract req.body, req.file, req.user)
       ▼
[ Service / Helper Layer ]
       │  (Upload parsed buffer to Supabase Storage bucket; get public URL)
       ▼
[ Model Layer ]
       │  (Mongoose Schema - validate properties against Episode Schema validation rules)
       ▼
[ Database (MongoDB Atlas) ]
       │  (Perform atomic INSERT; write record to 'episodes' collection)
       ▼
[ Express Controller Response ]
       │  (Format standard JSON payload: { success: true, episode: {...} })
       ▼
[ Client Browser ]
       │  (State updates in React; UI triggers success message; cursor glows green)
```

---

## 3. Code Walkthrough

### Folder Structure
```
├── backend/
│   ├── src/
│   │   ├── config/           # Database & Supabase connection configs
│   │   ├── controllers/      # MVC Controllers (auth, podcast, episode, admin, etc.)
│   │   ├── middlewares/      # auth (JWT), role verification, upload limits
│   │   ├── models/           # Mongoose schemas (User, Podcast, Episode, Comment, etc.)
│   │   ├── routes/           # REST API routes matching controllers
│   │   ├── utils/            # Supabase upload helpers, Gemini Fallbacks
│   │   ├── app.js            # Express app setup & route aggregation
│   │   └── server.js         # Port listener & socket.io mount
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/       # CustomCursor, Navbar, AudioPlayer, AudioVisualizer
│   │   ├── context/          # AuthContext, PlayerContext, ThemeContext
│   │   ├── pages/            # View Pages (Landing, Explore, CreatorDashboard, etc.)
│   │   ├── main.jsx          # React bootstrap mount
│   │   └── index.css         # Theme tokens, custom scrollbars, animations
│   ├── public/
│   │   ├── manifest.json     # PWA meta configuration
│   │   └── sw.js             # Service Worker for offline asset caching
│   └── package.json
```

### Authentication Flow
```
User clicks "Continue with Google" -> Supabase OAuth redirect -> Success
                                                                   │
                                                                   ▼
Frontend Context intercepts session -> Saves JWT -> Applies to axios header defaults
                                                                   │
                                                                   ▼
Requests sent to `/api/*` -> Backend `protect` middleware verifies JWT structure
                                                                   │
                                                                   ▼
Extracts `sub` (User ID) -> Queries/registers User in MongoDB -> Attaches user to `req.user`
```

### File Upload Flow
```
Form submission -> Multer reads file streams -> Saves buffer locally in temp folder
                                                                   │
                                                                   ▼
Controller calls Supabase storage client -> Uploads buffer -> Generates public URL
                                                                   │
                                                                   ▼
Deletes local temp file -> Saves database record with public URL reference
```

---

## 4. Core MERN Concepts Explained

### 1. React Components
* **What & Why**: Modular, self-contained view components that compile to DOM elements. Used to isolate features (like `AudioPlayer`, `NotificationsBell`, `PodcastCard`) so that styling and logic updates do not cause full-page re-renders.

### 2. React Hooks
* `useState`: Manages local mutable state variables (e.g., `isPlaying`, `isFloating`, `liked`).
* `useEffect`: Handles side effects (e.g., tracking mouse movement, setting up scroll timers, establishing WebSocket listening party connection).
* `useRef`: Retains persistent, non-rendering references (e.g., DOM references to canvas visualizers, the audio element, and coordinates for dragging states).
* `useCallback`: Memoizes inline callbacks (like magnetic button mouse handlers) to prevent wasteful re-render cycles of child components.
* `useContext`: Connects pages with global state containers (like `AuthContext` for credentials, `PlayerContext` for audio streaming, and `ThemeContext` for accents).

### 3. Client-Side Routing
* **What & Why**: Managed by `react-router-dom` v6. It intercepts anchor tag click events and dynamically swapped components in the DOM tree, avoiding slow full-browser refreshes.

### 4. Express & Custom Middleware
* **What & Why**: Express manages the Node HTTP server. Middlewares intercept incoming requests sequentially. 
  * `protect`: Ensures a valid JWT header exists and decodes it.
  * `optionalProtect`: Decodes the token if present (letting creators view their private drafts) but lets guests fetch published items.
  * `isAdmin`: Rejects access if the active user role !== `admin`.

### 5. REST APIs
* **What & Why**: Stateless HTTP endpoints following strict protocol guidelines (GET for reading, POST for creating, PUT for updating, DELETE for removal). This decouples the client design from backend database details.

### 6. MongoDB & Mongoose ODM
* **What & Why**: MongoDB stores data as documents. Mongoose enforces structure over the schema-less DB, providing validations, virtual properties, population queries, and pre-save hooks (like password hashing fallback).

---

## 5. Database Design & Schema Reference

### Collections & Entity Relationships
```
   +--------------+             +-----------------+             +-----------------+
   |    Users     |             |    Podcasts     |             |    Episodes     |
   |  - _id       |1 -------- * |  - _id          |1 -------- * |  - _id          |
   |  - email     |             |  - creatorId    |             |  - podcastId    |
   |  - role      |             |  - status       |             |  - status       |
   +--------------+             +-----------------+             +-----------------+
        1                             1                               1
        │                             │                               │
        │ 1                           │ 1                             │ 1
        ▼ *                           ▼ *                             ▼ *
   +--------------+             +-----------------+             +-----------------+
   |  Playlists   |             |     Reviews     |             |    Comments     |
   |  - userId    |             |  - podcastId    |             |  - episodeId    |
   |  - episodes  |             |  - userId       |             |  - userId       |
   +--------------+             +-----------------+             +-----------------+
```

### Why MongoDB over SQL?
1. **Document-Schema Alignment**: JSON payloads match MongoDB documents natively. There is no Object-Relational Impedance mismatch, which simplifies translation in Node.js.
2. **Dynamic Metadata Storage**: Podcasts and episodes have dynamic attributes (AI tags, transcripts array objects with timestamps). Storing this as nested subdocuments in a single MongoDB record is much faster than running complex multi-table SQL JOIN queries.
3. **Write Scalability**: High-write platforms benefit from MongoDB's scale-out (sharding) architecture and lock-free memory writes compared to transactional table locking in traditional SQL engines.

---

## 6. API Endpoints Reference

### 1. `GET /api/podcasts`
* **Purpose**: Fetches a filtered list of podcast shows.
* **Request**: Optional query strings: `category`, `search`, `limit`, `status`. Passes token in Authorization header.
* **Response**: `200 OK` with JSON array containing populated `creatorId` user reference fields.
* **Validation**: Restricts draft shows: if request has no token or if the token ID does not match the show's creator, draft shows are excluded.
* **Error Handling**: Standard try/catch block returning a `500 Server Error` JSON response.

### 2. `PUT /api/podcasts/:id`
* **Purpose**: Updates podcast metadata and artwork.
* **Request**: `multipart/form-data` containing updated title, description, cover image, status.
* **Response**: `200 OK` with updated podcast object.
* **Validation**: Verifies if request user ID === podcast `creatorId` or if user role === `admin`.
* **Error Handling**: Returns `403 Forbidden` if unauthorized, `404 Not Found` if the podcast doesn't exist.

### 3. `POST /api/episodes/:id/ai-features`
* **Purpose**: Generates episode summaries and relevant tags.
* **Request**: Route parameter `:id` of the episode.
* **Response**: `200 OK` with generated `{ aiSummary: "...", aiTags: [...] }`.
* **Validation**: Verifies authorization. Uses the Google Gemini API to analyze the description and transcript text.
* **Error Handling**: If the Gemini API limit is exceeded or fails, it falls back to a template text parser to keep the platform running.

---

## 7. Security Architecture

* **Supabase JWT Validation**: Instead of maintaining session storage on the backend, incoming request headers are decoded. The public key issued by Supabase verifies the signature, checking that the user session is active and un-tampered.
* **Role-Based Access Control (RBAC)**: Custom middlewares enforce access limits based on the user's role (`listener`, `creator`, `admin`).
* **Bcrypt Password Hashing**: For non-OAuth login credentials, bcrypt hashes passwords with a cost factor of 10. Passwords are never stored in plain text.
* **CORS (Cross-Origin Resource Sharing)**: Restricts backend access to approved origins (such as the Vercel deployment domain).
* **Helmet Security Headers**: Configures security headers to prevent Clickjacking, Cross-Site Scripting (XSS), and MIME-sniffing attacks.
* **Rate Limiting**: Restricts API endpoints to a maximum of 100 requests per 15 minutes per IP address to prevent brute-force attacks and abuse.

---

## 8. Deployment & DevOps

```
                     +---------------------------------------+
                     |             GitHub Repo               |
                     |  - Branch: main                       |
                     +---------------------------------------+
                                  /             \
                   Auto-deploy   /               \   Auto-deploy
                                v                 v
         +--------------------------+         +--------------------------+
         |     Vercel Platform      |         |     Render Platform      |
         |  - Serves static React   |         |  - Serves Node Express   |
         |  - Handles PWA cache     |         |  - Executes controllers  |
         +--------------------------+         +--------------------------+
                      |                                    |
            JWT Verification Checks                  Queries Database
                      \                                    /
                       v                                  v
         +--------------------------+         +--------------------------+
         |      Supabase Auth       |         |      MongoDB Atlas       |
         |  - OAuth & Sessions      |         |  - Clusters (Replicas)   |
         |  - User storage buckets  |         |  - Standard JSON records |
         +--------------------------+         +--------------------------+
```

### Environment Variables Matrix
* **Frontend**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`.
* **Backend**: `MONGO_URI`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `GEMINI_API_KEY`, `CLIENT_URL`.

---

## 9. Performance & Scalability Optimization

1. **Snapping & Animation Frame Interpolation**: The custom cursor uses `requestAnimationFrame` with a linear interpolation (lerp) equation (`current += (target - current) * 0.12`). This runs animations on the GPU compositor thread, keeping page scroll performance at 60fps.
2. **Virtual Scroll Lists & lazy loading**: Splitting page modules using Vite dynamic imports (`React.lazy`) reduces the initial bundle size, speeding up load times.
3. **Database Indexing**: Added indexes to foreign keys in MongoDB:
   * `episodes`: Index on `{ podcastId: 1 }` to speed up episode lists.
   * `podcasts`: Compound index on `{ category: 1, status: 1 }` to speed up search results.
4. **PWA Cache Strategy**: The Service Worker (`sw.js`) caches audio media using a Cache-First strategy to allow offline playback, while using a Network-First strategy for dynamic API updates.

---

## 10. MERN Stack Core Use Cases

```
+---------------------------------------------------------------------------------+
|                                 THE MERN STACK                                  |
+---------------------------------------------------------------------------------+
|  M  | MongoDB     | Document Database -> Stores podcasts, episodes, comments    |
|  E  | Express.js  | Router Framework  -> Manages routes, REST API controllers  |
|  R  | React.js    | Frontend Library  -> Custom cursor, navbar, visualizer card |
|  N  | Node.js     | Server Runtime    -> Compiles assets, executes operations   |
+---------------------------------------------------------------------------------+
```

* **MongoDB**: Best for high-growth, unstructured metadata (categories, AI tags, transcript arrays).
* **Express.js**: Lightweight framework that handles routing, middlewares, request validation, and error boundaries.
* **React.js**: Powering the dynamic UI, player states, synced transcript scrolling, and custom mouse controls.
* **Node.js**: The server runtime that compiles the code, manages packages via npm, handles API logic, and uploads media buffers.

---

## 11. Defense Q&A: Hard Reviewer Questions & Expert Answers

### Q1: Your app claims to support offline playback. How does it work under the hood?
**Answer**: "We implemented this as a Progressive Web App (PWA) using a custom Service Worker (`sw.js`) and the browser's Cache API. When a listener clicks the 'Download' button, the frontend intercepts the request and fetches the audio stream. The Service Worker caches the audio data in the browser cache. When the app is offline, the Service Worker intercepts the media requests and serves them directly from the cache."

### Q2: Why did you use Supabase Auth alongside MongoDB instead of writing custom JWT logic?
**Answer**: "Supabase Auth provides secure authentication out of the box, including encryption, session tokens, and Google OAuth. By using Supabase to sign tokens and MongoDB to store user-specific metadata (like preferences, roles, and history), we get both security and flexibility. The Express backend verifies Supabase's signature using their public key, ensuring token tamper resistance."

### Q3: When you drag the floating player, does it cause layout thrashing?
**Answer**: "No. We optimized dragging by:
1. Setting `position: fixed` on the player so it sits outside the standard document layout flow and does not trigger page reflows.
2. Animating the positioning using GPU-composited CSS transforms where possible, or inline positioning on the fixed container.
3. Using `requestAnimationFrame` for cursor interpolation, which coordinates animations with the browser refresh cycle to prevent frame drops."

### Q4: If the Gemini API key is missing or fails, does your application crash?
**Answer**: "No. We wrote a wrapper inside the controller with a try/catch fallback block. If the Gemini API throws a network or rate limit error, the application catches the error, logs it, and falls back to a clean manual input template. This ensures the user experience is uninterrupted."

### Q5: How do you prevent SQL Injection and NoSQL Injection in your query inputs?
**Answer**: "First, we validate inputs using Mongoose models, which strictly type-cast values and strip out unexpected operators. Second, we use Mongoose queries (like `findOne({ _id: id })`) instead of raw string concatenation. This automatically sanitizes inputs and blocks MongoDB operator injection attacks (like `$gt`)."
