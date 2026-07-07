# Pending Tasks & Rework Checklist

This document tracks upcoming roadmap items, optimization tasks, and features pending for future development sprints.

---

## 🎧 Real-time Engagement & Communities
- [ ] **Live Chat Rooms & Listening Parties**:
  - Build a WebSockets-based listening room so multiple listeners can sync playback of the same episode.
  - Implement a real-time chat overlay for live commentary during listening parties.

---

## 🛠️ Creator tools
- [ ] **Interactive Transcript Editor**:
  - Provide a dashboard text editor for creators to correct auto-parsed timestamps or edit transcription texts.
  - Add search-and-replace capabilities within transcripts.

---

## 🛡️ Administrative Moderation
- [ ] **Admin Dashboard & Content Flagging**:
  - Build a moderation dashboard to review flagged reviews, comments, or podcasts.
  - Implement suspend/activate actions on user profiles and general platform metrics monitoring.

---

## 🧼 Code Quality & Optimization
- [ ] **Mock Logic Cleanup**:
  - Audit the auth controller to ensure no mock/placeholder fallback code remains when Supabase session state is fully synced.
- [ ] **Integration Tests**:
  - Add Jest/Supertest suite for the backend API endpoints to verify Supabase JWT validation, podcast creation, and AI summaries.
- [ ] **Cache Lifespans & Cache Eviction**:
  - Add automatic cache eviction for the backend JWKS cache memory block.
