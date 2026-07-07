# Product Requirements Document (PRD)

## Podcast Streaming Service (MERN Stack)

**Version:** 2.0\
**Project Type:** B.Tech Final Year MERN Project\
**Timeline:** 8--12 Weeks

------------------------------------------------------------------------

# 1. Product Vision

Build a production-style podcast platform where creators can publish and
manage podcast series while listeners can discover, stream, follow, and
engage with content through a responsive web application.

## Problem Statement

Independent creators need an easy platform to publish podcasts without
complex hosting, while listeners need a lightweight and organized
streaming experience.

## Goals

-   Demonstrate full MERN development skills.
-   Build secure authentication and authorization.
-   Implement scalable audio streaming.
-   Showcase production-ready architecture.

------------------------------------------------------------------------

# 2. Target Users

## Listener

**Goals** - Discover podcasts - Stream episodes - Follow creators -
Continue listening from last position

**Pain Points** - Poor search - Slow loading - Losing playback progress

## Creator

**Goals** - Upload podcasts - Publish episodes - View analytics - Manage
audience

## Administrator

**Goals** - Moderate content - Manage users - Review reports - Monitor
platform health

------------------------------------------------------------------------

# 3. User Stories

### Listener

-   As a listener, I want to register so I can follow podcasts.
-   As a listener, I want playback to resume from my last position.
-   As a listener, I want search filters to quickly discover podcasts.

### Creator

-   As a creator, I want to upload podcast episodes securely.
-   As a creator, I want analytics on episode performance.

### Admin

-   As an administrator, I want to remove inappropriate content.
-   As an administrator, I want to suspend abusive users.

------------------------------------------------------------------------

# 4. Functional Requirements

## Authentication

-   Register/Login
-   JWT Access Token
-   Refresh Token
-   Password Reset
-   Email Verification
-   Logout All Devices
-   Role-Based Authorization

## Podcast Management

-   Create/Edit/Delete Podcast
-   Categories
-   Tags
-   Cover Image
-   Banner Image
-   Draft & Published Status

## Episode Management

-   Upload MP3
-   Draft/Publish
-   Transcript
-   Episode Thumbnail
-   Edit/Delete

## Audio Player

-   Play/Pause
-   Seek
-   Playback Speed
-   Resume Playback
-   Auto Next Episode
-   Progress Save
-   Volume Control

## Search

-   Title
-   Episode
-   Creator
-   Category
-   Tags
-   Sort
-   Pagination
-   Autocomplete

## Creator Analytics

-   Plays
-   Followers
-   Completion Rate
-   Top Episodes
-   Daily Statistics

------------------------------------------------------------------------

# 5. Non-Functional Requirements

-   Responsive on Mobile/Desktop
-   API Response \< 300 ms (average)
-   Audio starts within 2 seconds on broadband
-   Lighthouse Performance ≥ 90
-   Input Validation
-   Error Handling
-   RESTful APIs

------------------------------------------------------------------------

# 6. Database Schema

## Users

-   \_id
-   username
-   name
-   email
-   password
-   role
-   avatar
-   bio
-   isVerified
-   accountStatus
-   lastLogin
-   createdAt
-   updatedAt

## Podcasts

-   \_id
-   title
-   slug
-   description
-   category
-   tags
-   language
-   coverImage
-   bannerImage
-   creatorId
-   followersCount
-   episodeCount
-   status
-   createdAt
-   updatedAt

## Episodes

-   \_id
-   podcastId
-   title
-   description
-   audioUrl
-   transcript
-   duration
-   playCount
-   downloads
-   publishDate
-   status
-   createdAt
-   updatedAt

## Followers

-   userId
-   podcastId

------------------------------------------------------------------------

# 7. API Specification

## Auth

POST /api/auth/register POST /api/auth/login POST /api/auth/refresh POST
/api/auth/logout GET /api/auth/profile

## Podcasts

GET /api/podcasts?page=1&limit=10 POST /api/podcasts PUT
/api/podcasts/:id DELETE /api/podcasts/:id

## Episodes

POST /api/podcasts/:id/episodes GET /api/episodes/:id PUT
/api/episodes/:id DELETE /api/episodes/:id

------------------------------------------------------------------------

# 8. Authorization Matrix

  Feature              Listener   Creator   Admin
  -------------------- ---------- --------- -------
  Stream               ✓          ✓         ✓
  Upload               ✗          ✓         ✓
  Delete Own Podcast   ✗          ✓         ✓
  Delete Any Podcast   ✗          ✗         ✓
  Manage Users         ✗          ✗         ✓

------------------------------------------------------------------------

# 9. UI Pages

Public: - Landing - Explore - Podcast Details

Authenticated: - Home - Player - Profile - Settings

Creator: - Dashboard - Upload Episode - Analytics

Admin: - Dashboard - User Management - Reports

Each page must define loading, empty, success, and error states.

------------------------------------------------------------------------

# 10. Security

-   JWT
-   Refresh Tokens
-   bcrypt
-   Helmet
-   Rate Limiting
-   CORS
-   Input Validation
-   File Type Validation
-   Max Upload Size
-   Protected Routes

------------------------------------------------------------------------

# 11. Testing

-   Unit Tests
-   API Tests
-   Integration Tests
-   Manual UI Testing
-   Responsive Testing
-   Browser Compatibility

------------------------------------------------------------------------

# 12. Risks

-   Large uploads
-   Storage cost growth
-   Network interruption
-   Unauthorized file access
-   Free-tier hosting limits

------------------------------------------------------------------------

# 13. MVP

-   Authentication
-   Podcast CRUD
-   Episode CRUD
-   Audio Streaming
-   Search
-   Creator Dashboard

------------------------------------------------------------------------

# 14. Future Enhancements

-   Google Login
-   Comments
-   Ratings
-   Notifications
-   AI Recommendations
-   Playlists
-   Offline Downloads
-   Progressive Web App

------------------------------------------------------------------------

# 15. Acceptance Criteria

-   Users can register/login successfully.
-   Creators can upload podcasts and episodes.
-   Playback resumes correctly.
-   Search supports filters and pagination.
-   Admin can moderate users and content.
-   Application is deployed publicly.

------------------------------------------------------------------------

# 16. Success Metrics

-   Login Success ≥ 99%
-   Upload Success ≥ 99%
-   API Error Rate \< 1%
-   Audio Start Time ≤ 2 s
-   Lighthouse Performance ≥ 90
