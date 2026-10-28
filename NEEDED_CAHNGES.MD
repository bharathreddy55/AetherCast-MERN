# AetherCast — Needed Changes

## Product direction

Build **a private, ad-free music app for your own library, with podcasts as an optional section**.

The app should let its owner import music, organize a library, create playlists, stream across personal devices, and download music for offline listening. It should provide a polished Spotify-style listening experience using the owner's own media. Spotify integration and a public commercial streaming catalog are outside the initial scope.

This document is the implementation checklist and progress record. Checked items have been implemented locally; deployment and external setup are recorded separately. Findings are based on inspection of the current local source. The live deployment could not be inspected successfully, so deployed behavior still needs verification.

## Completion notes

### 2026-10-28 — Change 1: Owner access and closed registration

- **Implemented locally:** Public application registration and legacy account/token routes return 403; `/register` redirects to sign-in; sign-up actions were removed from the navbar/login screen. Client registration and OTP helpers no longer create accounts or report false success.
- **Implemented locally:** Protected endpoints require the configured `OWNER_SUPABASE_USER_ID` to match the verified Supabase token subject. Other accounts receive 403; missing owner configuration receives 503. New profile roles no longer come from editable metadata. Suspended accounts are rejected.
- **Implemented locally:** Tokens validate issuer and audience. Sign-in waits for profile synchronization, displays profile errors, cancels stale requests, and navigates to the listening home only after profile success.
- **Verified:** All 18 backend tests pass, including owner/non-owner, missing configuration, suspended accounts, invalid issuer/audience, expired tokens, metadata role tampering, and closed account routes. Frontend production build passes. Targeted lint has no errors; existing navbar-unused-variable and context fast-refresh warnings remain. Frontend build reports a bundle-size advisory.
- **Setup pending:** Supply the actual owner User UID and set `OWNER_SUPABASE_USER_ID` on the backend. The supplied `qapyqxqdswrocuoutdfs` is the project reference, not a user UID. Disable new-user signup in hosted Supabase settings. See `PRIVATE_SETUP.md`.
- **Privacy work still pending:** Previously public catalog routes, direct media delivery, hosted storage policies, and cached data are not yet fully private. No deployment or hosted setting changes have been made. Do not treat this first change as completed end-to-end privacy.
- **Next:** Protect catalog/library requests and update their frontend callers, then implement private media delivery and durable storage.

### 2026-10-28 — Change 2: Owner configuration and private catalog

- **Done locally:** Set `OWNER_SUPABASE_USER_ID=22ee4604-30c6-4efa-9bc6-b522de3770e9` in the ignored backend environment file, preserving any other values. Production startup now requires an explicit owner setting.
- **Done locally:** Apply owner authentication before all non-authentication API routes, including catalog/search, episode details, playlists, comments, stream endpoints, anonymous play events, and episode AI chat. Redirect the root to the private listening home and protect Explore/podcast details in the frontend.
- **Done locally:** Route active library API calls through a shared authenticated client. It gets the current session token, replaces stale bearer headers, preserves request bodies/cancellation, disables response caching and redirects, and refuses to send credentials outside the configured API.
- **Done locally:** Centralize API/media backend URLs so deployed local-upload links no longer independently fall back to localhost.
- **Done locally:** Add unique immutable `supabaseUserId` linkage, preserve existing profile IDs and library relationships during first-login migration, and reject attempts to reuse a profile bound to another identity. The live database remains unchanged until owner sign-in after deployment.
- **Verified:** 32 backend tests and 5 frontend tests pass; frontend production build passes. Coverage includes guest/non-owner catalog denial, owner catalog success, profile linking, identity conflicts, and authenticated-client token isolation/refresh behavior.
- **Deployment pending:** Add the same owner environment value to Render and deploy these changes. Disable hosted Supabase signup. Local configuration alone does not change either hosted service.
- **Next:** Private object storage and media delivery; `/uploads`, existing public storage URLs, browser downloads, and listening-party sockets are still outside the completed API privacy boundary.

### 2026-10-28 — Change 3: Private media delivery and download identity

- **Done locally:** Replace public `/uploads` serving with a temporary signed media route. Owned audio/artwork fields in nested API responses receive scoped 15-minute URLs; URLs do not contain Supabase account access tokens or service credentials. Request logs redact media capabilities.
- **Done locally:** Proxy private cloud objects using server credentials and stream local development files through signed links. Verify signatures, owner identity, audience and expiry; reject path traversal; support local byte ranges, suffix/open-ended ranges, HEAD, and cloud range forwarding.
- **Done locally:** New cloud uploads verify that the bucket is private, use a server-only service credential, and store stable object references. Cloud failures never silently fall back to disk; production rejects local file storage. A local media-signing secret was generated without exposing it.
- **Done locally:** Refresh media details before online playback/downloads, reject denied/failed detail lookups instead of using an old URL, ignore stale track-selection results, display playback errors, and stop playback on logout. Pressing play after an expiry/interruption refreshes the link while retaining the current position where available.
- **Done locally:** Share download logic across player, details, and Downloads. Cache complete audio by owner/episode identity, verify cached-file availability, and stop depending on temporary URLs for cache identity. Logout cancels pending downloads and clears that account's cache/index.
- **Done locally:** Stop automatic shared caching of signed media, cloud storage, and APIs. Remove legacy shared `vox-*` caches during the worker upgrade and preserve new owner-scoped downloads. Copy non-private stock category artwork into frontend assets so closing `/uploads` does not break fallback art.
- **Verified:** All 50 backend tests and 16 frontend tests pass (66 total); the frontend production build passes. Backend media tests cover direct-file denial, link constraints, local/cloud seeking, HEAD, nested response serialization, private bucket checks, and upload failure behavior. Frontend tests cover fresh-link lookup, denial without fallback, account isolation, cache eviction, metadata-write failure, and service-worker cache boundaries. New download/store/worker modules pass targeted lint with no warnings. Existing player/context lint warnings and the frontend bundle-size advisory remain.
- **Hosted setup pending:** Make the Supabase bucket private, audit bucket policies, set `SUPABASE_SERVICE_ROLE_KEY` and `MEDIA_SIGNING_SECRET` on the backend host, deploy both applications, and verify real storage/device behavior. Full instructions are in `PRIVATE_SETUP.md`. No hosted settings or live database rows were changed.
- **Remaining:** Existing public cloud files require hosted privacy verification. Complete offline launch/artwork, seamless mid-stream renewal, stale artwork refresh, progress saving, and socket privacy are not marked complete. Old browser downloads need downloading again after the cache migration; server originals are preserved.

### 2026-10-28 — Change 4: Playback progress and resume reliability

- **Done locally:** Replace the React-time-update interval with one tracker tied to actual playing/pause/ended events. Read the live media element when saving, rather than stale render values.
- **Done locally:** Snapshot the outgoing episode, owner, position, duration, and current token before switching or closing. Serialize progress requests within the player so ordinary overlapping saves retain their order. A failed request does not block subsequent writes.
- **Done locally:** Save periodically, on pause, explicit seeking, completion, player close, page hide/visibility change, and before explicit logout. Page-lifecycle saves use `keepalive` and remain best effort under browser shutdown restrictions.
- **Done locally:** Keep owner-scoped in-memory checkpoints for immediate return to recently played episodes, apply resume positions after metadata loads, clamp seeks, and restart naturally finished episodes at zero. These checkpoints are cleared on logout and are not a durable offline synchronization queue.
- **Done locally:** Bind media listeners once and use the attached media identity when handling events. Ignore stale selection results and outdated play failures; actual media events determine playing state. Reset position/duration when changing or closing media.
- **Done locally:** Validate progress IDs and finite numeric ranges on the server, reject saves for missing episodes, derive completion at 95% or greater, and enable model update validators.
- **Verified:** All 72 backend tests and 22 frontend tests pass (94 total); the final frontend production build passes. Coverage includes continuous playback timer behavior, outgoing snapshot identity, delayed save ordering, failed-save recovery, completion, lifecycle request options, invalid input, and owner-scoped backend writes. Targeted lint has no errors; player context fast-refresh/ref-cleanup warnings and the existing bundle-size advisory remain.
- **Limitations:** No live deployment or phone/browser playback session was performed. Offline write retry after reload, multi-device conflict resolution, music-specific resume defaults, and full queue behavior remain pending. Network/browser termination can still prevent a final save from arriving.
- **Next:** Continue the remaining P0 authentication/storage checks and add the music catalog foundation before expanding queue and music-library behavior.

### 2026-10-28 — Change 5: Signing-key rotation and explicit website access

- **Done locally:** Extract Supabase token verification into a project-scoped verifier. Cache public signing keys for ten minutes, refresh when a new key ID appears, share concurrent fetches, bound repeated unknown-key refreshes, and time out failed fetches. Expired caches are not used after a failed refresh.
- **Done locally:** Require token expiry and verify the signing key's type/curve/use, algorithm, issuer, audience and signature. Legacy HS256 is accepted only with an explicitly configured real secret, used as its exact string; secret length no longer triggers incorrect base64 decoding.
- **Done locally:** Remove the hardcoded Supabase project fallback, placeholder JWT secrets, and unused custom registration/login/Google-token/OTP/refresh controllers. Existing MongoDB profiles and historical password fields are preserved; owner sign-in and refresh continue through Supabase.
- **Done locally:** Share an explicit website-origin policy between HTTP, socket polling, and WebSocket upgrade checks. Permit only `CLIENT_URL` and individually listed `ADDITIONAL_CLIENT_ORIGINS`; arbitrary Vercel subdomains and localhost ports are rejected. Development permits localhost/127.0.0.1 on port 5173. Requests without an Origin header still require the existing API authentication checks.
- **Done locally:** Validate required production configuration before serving requests, including project URL, owner UUID, storage/media credentials, MongoDB URI and HTTPS client origins. Legacy JWT secret and backend anon key are no longer required for ES256 verification. Frontend Supabase public-key configuration remains required separately.
- **Verified:** All 94 backend tests pass. New coverage exercises signing-key rotation, shared fetches, cache expiry, failed refreshes, project isolation, forged/expired tokens, long raw legacy secrets, origin matching, production validation, and HTTP preflight/authentication behavior. Modified server modules pass syntax checks and the patch passes whitespace checks. Frontend source is unchanged in this batch; its previous 22 passing tests and successful build remain the latest frontend verification.
- **Hosted setup pending:** Set `CLIENT_URL=https://aether-cast-mern.vercel.app` on the deployed backend. List each approved preview/custom domain explicitly if needed. Complete the earlier private storage and owner setup before expecting deployment to run.
- **Remaining:** Socket origin checks do not replace socket owner authentication, room permissions, or event limits; those remain unchecked. Real Supabase rotation and hosted deployment have not been exercised from this workspace.

### 2026-10-28 — Change 6: Private listening-room connections

- **Done locally:** Share owner-token authentication between HTTP and sockets. Room connections reject guests and non-owner accounts, disconnect at token expiry, and recheck the owner/account status before each action.
- **Done locally:** Validate episode existence and room IDs before joining. Keep one episode room per connection and reject playback/chat for rooms the connection has not joined.
- **Done locally:** Elect a host from actual room membership; only the host can sync play/pause/seek. Another signed-in owner device can explicitly take control. Reassign the host and publish member counts when a device leaves/disconnects.
- **Done locally:** Validate finite playback positions against known episode duration, limit messages to 1000 characters, cap transport packets at 16 KiB, serialize each connection's room actions, and impose per-owner minute limits across connections: 10 room joins/leaves, 120 playback/host actions, and 30 chat messages.
- **Done locally:** Derive names/avatars from the authenticated server profile rather than supplied event fields. Do not log room messages or tokens. Handle malformed legacy artwork without breaking disconnect cleanup.
- **Done locally:** Fetch a current session token for socket handshakes, reconnect/rejoin after token refresh, remove stale playback closures, and clean up listeners/timers on close. Show connection/action errors and host controls; display outgoing messages and clear drafts only after server acceptance.
- **Verified:** All 109 backend tests and 28 frontend tests pass (137 total); the frontend production build passes. Backend policy/adapter tests cover owner denial, membership, host permissions/takeover, bad positions, chat validation, shared event limits, expiry/account invalidation, host reassignment, and room changes. Frontend tests cover handshake token refresh, reconnect/rejoin, control permissions, server acknowledgements, stale-room/old-connection events, and cleanup. Targeted frontend lint, backend syntax checks, and whitespace checks pass; the existing frontend bundle-size advisory remains.
- **Remaining:** Real two-device/browser WebSocket verification and hosted deployment are pending. Room state and limits currently use one Node process; distributed/multi-instance coordination is not implemented. These private rooms are optional and do not add public invitations or guest access.
- **Next:** Add the music catalog foundation (tracks, artists, albums, and media assets), then connect it to music imports and the library.

### 2026-10-28 — Change 7: Owner-scoped music catalog foundation

- **Done locally:** Add Artist, Album, Track and MediaAsset models with immutable owners and catalog indexes. Keep podcast collections and episode playlists unchanged.
- **Done locally:** Store primary/featured credits, compilation albums, artwork references, release dates, disc/track numbers, genres, language and explicit flags. MediaAsset holds private object references, format/codec/size/checksum information and processing state.
- **Done locally:** Add protected list/detail/create/edit/soft-delete routes for artists, albums and tracks, with bounded pagination, literal search, and stable album ordering. Validate references against the authenticated owner and reject arbitrary ownership/source/status fields.
- **Done locally:** Require owned ready audio for track creation, derive duration from the asset, and provide a dedicated short-lived track playback endpoint. Asset metadata is read-only through this API; future server imports manage asset creation and processing.
- **Done locally:** Return explicit DTOs, hide object locations/credentials, and scope populated relations. Block deleting referenced artists/albums, soft-delete tracks, and retain original media for recovery. Add owner/checksum and active-track/asset duplicate protection.
- **Done locally:** Document the API and additive migration/rollout plan in `MUSIC_CATALOG.md`. Initial music playlists will be separate from podcasts; mixed playlists are outside the first release.
- **Verified:** All 137 backend tests pass. New tests cover schema validation, reference ownership, list/population scoping, ordering, invalid filters/IDs, soft deletion, duplicate handling, asset metadata privacy and temporary playback. Controller/utility syntax and whitespace checks pass. Frontend code is unchanged in this batch; its prior 28 passing tests and successful build remain the latest frontend verification.
- **Remaining:** No live MongoDB migration, backup, music upload, metadata extraction, frontend music screen, or track-player integration has been performed. Existing podcast data is preserved. The current React player still calls episode APIs; the new track API is a foundation for the next import/library step.
- **Next:** Implement server-side music importing and metadata extraction, then add the music library and player integration.

## Priority definitions

- **P0 — Foundation:** Fix security, data durability, and playback correctness before extending the app.
- **P1 — Core product:** Implement the music catalog, imports, library, and everyday playback.
- **P2 — Daily-use quality:** Complete offline listening, mobile behavior, search, and accessibility.
- **P3 — Enhancements:** Add advanced audio features, personalization, and device handoff after the core is reliable.

## 1. Private access and authentication — P0

- [ ] Restrict access to the owner; disable public self-registration or require an explicit owner-controlled invitation if additional personal accounts are introduced later.
  - Application changes and local owner UID configuration are implemented; deployed owner configuration and hosted Supabase signup settings remain pending.
- [ ] Enforce private access on the server for catalog, library, search, uploads, playback, and downloads; hiding frontend routes is insufficient.
  - Done for non-authentication API routes; direct media/static delivery, storage policies, and cached downloads remain pending.
- [x] Assign roles through trusted server-side operations. Never create an administrator from user-editable Supabase `user_metadata.role`.
- [x] Use the Supabase user ID (`sub`) as the durable external identity, with a unique database field, rather than relying only on email matching.
- [x] Validate JWT issuer and audience as well as signature, allowed algorithm, and expiry.
- [x] Handle signing-key rotation by refreshing the key set when an unfamiliar key ID is encountered.
- [x] Remove placeholder authentication secrets and validate required configuration at startup.
- [x] Check suspended/disabled account status in authentication middleware on every protected request.
- [x] Await profile synchronization before completing authentication loading or redirecting protected pages.
- [ ] Handle expired sessions, failed profile loads, refresh, logout, and account changes with clear recovery states.
- [x] Consolidate authentication around Supabase; retire unused legacy password, token, and OTP flows after checking callers and migrating any required data.
- [x] Remove OTP handlers that return success without performing verification.
- [x] Restrict credentialed CORS to explicitly configured origins instead of accepting every Vercel subdomain.
- [ ] Apply appropriate rate limits to authentication, uploads, search, and expensive processing.
- [x] If listening parties remain, authenticate sockets and enforce room membership, host permissions, payload limits, and event rate limits.

Source references: `backend/src/middlewares/auth.js`, `backend/src/controllers/authController.js`, `backend/src/app.js`, `backend/src/server.js`, `frontend/src/context/AuthContext.jsx`.

## 2. Private media and durable storage — P0

- [ ] Store music and private artwork in private object storage with restrictive storage policies.
- [ ] Store object keys and media metadata in the database instead of permanent public media URLs.
  - New uploads store stable object references and new music MediaAsset records support file metadata. Existing podcast rows are interpreted compatibly at delivery; stored-reference migration remains pending.
- [x] Issue short-lived playback/download URLs after checking ownership, or provide an authenticated streaming endpoint.
- [x] Stop returning usable protected media URLs to unauthorized clients.
- [ ] Audit list, detail, search, playlist, and podcast endpoints for private media and draft visibility.
- [x] Ensure seeking works with byte-range requests, including valid `206` and invalid-range handling.
- [ ] Refresh expired playback URLs without unnecessarily losing playback position.
- [x] Use an authorized server upload flow or narrowly scoped signed upload URLs; keep privileged storage credentials on the server.
- [x] Remove silent fallback to server-local files in production. Report storage failures instead of claiming a durable upload succeeded.
- [x] Centralize API/media configuration; remove conflicting localhost and deployed-backend fallbacks.
- [ ] Validate upload type using file contents and permitted formats, not just filename and declared MIME type.
- [ ] Set file-size, request, storage, and processing limits appropriate for a personal library.
- [ ] Clean up abandoned uploads, replaced artwork, failed imports, and deleted media safely.
- [ ] Back up database metadata and original media; document and test restoration.

Source references: `backend/src/utils/supabaseStorage.js`, `backend/src/middlewares/upload.js`, `backend/src/controllers/episodeController.js`, `frontend/src/main.jsx`.

## 3. Remove personal-use friction — P0/P1

- [ ] Remove simulated checkout and episode-purchase requirements from the personal listening experience.
- [ ] Migrate or retire premium flags, prices, and purchased-episode fields without losing existing media or playlists.
- [ ] Remove subscription prompts, upgrade messaging, ads, and payment navigation wherever present.
- [ ] Replace creator onboarding with an owner-only **Import & Manage Music** area.
- [ ] Hide public creator, moderation, ratings, comments, and publishing workflows unless explicitly retained.
- [ ] Keep only a compact owner settings/maintenance area instead of a public-platform admin command center.
- [ ] Decide which existing podcast features to retain before removing their code or data.

The current `backend/src/controllers/paymentController.js` simulates a purchase by adding an episode to the user's purchased list without collecting payment. It should not be treated as a production payment system.

## 4. Music catalog and data migration — P1

- [x] Add separate **Artist**, **Album**, **Track**, and **MediaAsset** models.
- [x] Track artist credits, album artists, album artwork, release date/year, disc number, track number, duration, genre, language, and optional explicit-content metadata.
- [x] Support multiple artists and compilation albums.
- [x] Store media format, codec, bitrate, sample rate where useful, byte size, object key, checksum, and processing status.
- [x] Add owner scoping to personal records and enforce it in database queries.
  - Applied to new music records and references. Existing podcast schemas remain unchanged.
- [ ] Add saved albums, followed artists, liked tracks, listening events, and user playback preferences.
- [ ] Introduce playlist items with stable IDs and explicit positions so reordering and repeated tracks have defined behavior.
- [x] Keep music tracks distinct from podcast episodes; define whether mixed playlists are supported.
- [ ] Define deletion behavior for tracks referenced by playlists, likes, downloads, and history.
  - Track soft deletion and retention of originals are implemented; music-playlist/like/download/history reference behavior will be completed with those features.
- [ ] Add indexes for ownership, artist/album relationships, search, playlist ordering, and listening history.
  - Catalog ownership, artist/album relationships, ordering and duplicate indexes are implemented. Music-playlist/history indexes remain pending.
- [ ] Move growing listening-history collections out of the user document; avoid unbounded embedded arrays.
- [x] Write a migration plan for existing podcast playlists, media URLs, history, and user records.
  - See `MUSIC_CATALOG.md`; use additive collections and preserve existing podcast IDs/records. No live conversion has been run.
- [ ] Back up existing data and make migration steps repeatable before applying them.

Existing models are podcast-centric: `backend/src/models/Episode.js`, `backend/src/models/Podcast.js`, `backend/src/models/Playlist.js`, and `backend/src/models/User.js`.

## 5. Music import and management — P1

- [ ] Support single-file, multi-file, and album/folder imports.
- [ ] Support an explicit initial format list, such as MP3, M4A/AAC, FLAC, OGG, and WAV, with conversion for unsupported playback formats where needed.
- [ ] Extract embedded track titles, artists, album names, track/disc numbers, artwork, and duration automatically.
- [ ] Provide an editable preview before committing an import.
- [ ] Detect exact duplicates using checksums and offer review for likely metadata duplicates.
- [ ] Preserve original files; record any derived playback versions separately.
- [ ] Run metadata extraction, artwork processing, and audio conversion in background jobs rather than long API requests.
- [ ] Show upload and processing progress, per-file failures, cancellation, and retry.
- [ ] Support resumable/direct uploads where file sizes justify them.
- [ ] Allow metadata correction, album regrouping, artwork replacement, and bulk edits.
- [ ] Generate appropriately sized artwork thumbnails and provide attractive missing-artwork placeholders.
- [ ] Make import jobs retry-safe so retries do not create duplicate tracks or orphan files.

## 6. Playback correctness — P0/P1

- [x] Fix the progress-saving effect: changes to `currentTime` currently recreate the ten-second interval, which can prevent periodic saves during continuous playback.
- [x] Use stable timers and current refs for progress; save when pausing, switching media, closing the player, and when page lifecycle events permit.
- [x] Save the outgoing track's position before replacing it and avoid associating old progress with a newly selected track.
- [x] Cancel or ignore stale asynchronous requests when the user rapidly selects different tracks.
- [x] Handle authorization/detail request failures explicitly; playback should not accidentally proceed because authorization defaulted to allowed.
- [ ] Provide a separate verified offline playback path that does not depend on successful online API requests.
- [ ] Initialize one stable media element and audio graph; clean up listeners and resources correctly.
- [ ] Model loading, buffering, playing, paused, ended, unavailable, and error states explicitly.
- [ ] Handle media errors, interrupted playback, autoplay restrictions, and retry with useful feedback.
- [x] Apply saved seek positions at an appropriate media lifecycle stage and clamp invalid positions.
- [ ] Default songs to starting from the beginning; resume podcasts according to saved episode progress.
- [ ] Separate play-start events from meaningful listening events so retries and failed starts do not inflate history or counts.
- [ ] Persist volume, mute, equalizer, playback speed, and other relevant preferences.
- [ ] Test Bluetooth/headphone and audio-device changes; avoid pausing for unrelated device changes.

Primary source: `frontend/src/context/PlayerContext.jsx`.

## 7. Queue and music controls — P1

- [ ] Add a visible queue with **Play Next**, **Add to Queue**, remove, reorder, and clear actions.
- [ ] Distinguish the manually added queue from the remaining album/playlist playback context.
- [ ] Support repeated occurrences of a track using queue-item identity rather than track ID alone.
- [ ] Add shuffle with a stable order and usable previous-track history.
- [ ] Add repeat off, repeat all, and repeat one.
- [ ] Define previous-button behavior: restart the current song after a short playback threshold, otherwise go to the previous item.
- [ ] Restore the queue, current item, position, and preferences after reload without unexpected autoplay.
- [ ] Make album playback follow disc/track order by default.
- [ ] Provide seek, elapsed/remaining time, volume, mute, like, and playlist actions consistently.
- [ ] Add keyboard shortcuts that respect text fields and accessible focus behavior.
- [ ] Keep podcast speed and sleep-timer controls available without crowding the primary music controls.

## 8. Listening-first interface — P1

- [ ] Open the listening home after login; keep any public landing page separate from the private app.
- [ ] Build a desktop sidebar for Home, Search, Your Library, and playlists.
- [ ] Use a persistent bottom player and optional queue/Now Playing side panel on desktop.
- [ ] Build mobile Home/Search/Library navigation, a mini-player, and a full-screen Now Playing view.
- [ ] Add album, artist, track, liked-songs, playlist, import, and queue views.
- [ ] Turn `/library`, currently used for history, into a unified library; give history its own view or filter.
- [ ] Use compact track rows with title, artist, album, duration, liked state, download state, and contextual actions.
- [ ] Add Home sections such as Recently Played, Recently Added, Favorite Albums, and Your Playlists.
- [ ] Keep search available throughout the app.
- [ ] Replace the custom cursor with standard pointer behavior.
- [ ] Reduce decorative effects that make browsing and playback slower or harder to read.
- [ ] Standardize spacing, typography, colors, artwork proportions, menus, dialogs, and loading states.
- [ ] Unify AetherCast/VOX names, page titles, manifest metadata, icons, and theme colors.
- [ ] Add clear loading, empty, offline, permission, processing, and failure states with relevant actions.
- [ ] Confirm the player never obscures the last list item or mobile navigation.

## 9. Library and playlists — P1

- [ ] Provide views for songs, albums, artists, playlists, downloads, and optional podcasts.
- [ ] Add track likes, album saves, artist follows, and pinned favorites.
- [ ] Support sorting by title, artist, album, date added, duration, and play count where appropriate.
- [ ] Support playlist creation, renaming, deletion, descriptions, cover artwork, and drag-to-reorder.
- [ ] Support adding tracks from search, albums, the player, and multi-selection.
- [ ] Define duplicate-track behavior and offer undo for common destructive actions.
- [ ] Add playlist-local search and display track count and total duration.
- [ ] Add playlist import/export in documented formats, with a clear report for unmatched tracks.
- [ ] Keep playlists private by default; do not introduce public sharing as a requirement.
- [ ] Handle deleted/unavailable tracks gracefully without breaking the entire playlist.

## 10. Search — P1/P2

- [ ] Search tracks, artists, albums, playlists, and optional podcasts with grouped results.
- [ ] Search relevant metadata rather than only podcast titles/descriptions.
- [ ] Add recent searches, suggestions, useful filters, and a clear-search action.
- [ ] Preserve search/filter state in the URL where useful.
- [ ] Cancel or ignore stale responses so earlier queries cannot replace newer results.
- [ ] Add pagination or incremental loading for large libraries.
- [ ] Start with indexed database search; add a dedicated search service only if library size or matching requirements justify it.

## 11. Offline downloads and installed app — P2

- [ ] Store download metadata in an account-scoped structured store such as IndexedDB.
- [ ] Cache artwork, required catalog metadata, playlists, and built application assets alongside downloaded audio.
- [ ] Verify that audio is actually present before marking a track as downloaded.
- [ ] Add download progress, cancellation, retry, batch download, and deletion.
- [ ] Display storage usage and available capacity; handle quota failures and browser eviction.
- [ ] Request persistent browser storage when supported, while explaining that availability varies by browser.
- [ ] Make downloaded tracks playable after an offline reload without waiting for live catalog, authorization-detail, or progress endpoints.
- [ ] Define how offline access works with private storage, expiring URLs, session expiry, and logout.
- [ ] Clear or isolate private cached data when accounts change.
- [ ] Queue listening progress/history updates for later synchronization without duplicate events.
- [ ] Correctly handle audio range requests, invalid ranges, and unsupported range forms in the service worker.
- [ ] Replace broad runtime caching with explicit caching rules; do not inadvertently cache private API responses as public static assets.
- [ ] Add a service-worker update flow that avoids interrupting current playback.
- [ ] Verify installability, icon appearance, deep-link reloads, and standalone navigation.

Source references: `frontend/public/sw.js`, `frontend/public/manifest.json`, `frontend/src/pages/Downloads.jsx`, `frontend/src/components/AudioPlayer.jsx`.

## 12. Mobile and accessibility — P2

- [ ] Add Media Session metadata and supported play, pause, seek, previous, and next actions.
- [ ] Test lock-screen controls, background playback, screen locking, incoming interruptions, and Bluetooth on real Android and iOS devices.
- [ ] Provide sufficiently large touch targets, safe-area spacing, and readable layouts at small widths.
- [ ] Label icon-only buttons and make menus, sliders, dialogs, and the queue keyboard-accessible.
- [ ] Add visible focus indicators, adequate contrast, reduced-motion behavior, and sensible screen-reader announcements.
- [ ] Avoid hover-only actions and support touch equivalents for playlist/queue reordering.
- [ ] Consider a native wrapper or native app only after browser testing identifies concrete unmet requirements.

## 13. Optional podcasts — P2

- [ ] Keep podcasts in a separate section that can be hidden in settings.
- [ ] Preserve existing shows/episodes and their listening progress during the music migration.
- [ ] Retain podcast-specific resume, speed controls, sleep timer, bookmarks, and transcripts where useful.
- [ ] If external podcast subscriptions are desired, add RSS import, subscription management, episode refresh, and new-episode indicators.
- [ ] If fetching external feeds/media server-side, validate URLs, redirects, response sizes, timeouts, and private-network destinations.
- [ ] Define per-show auto-download and played-episode cleanup preferences if needed.
- [ ] Keep publishing, recording, AI summaries, and listening parties optional rather than core navigation.

## 14. Audio quality and personalization — P3

- [ ] Add playback/download quality preferences when multiple encoded versions are available.
- [ ] Add loudness analysis and optional volume normalization with appropriate headroom.
- [ ] Add gapless playback and configurable crossfade; preserve album transitions and disable crossfade where inappropriate.
- [ ] Improve equalizer preference persistence and provide a clear reset action.
- [ ] Add synchronized lyrics from user-supplied or otherwise authorized sources, with a plain-text fallback.
- [ ] Generate simple mixes from local genres, artists, favorites, recency, completion, and skips.
- [ ] Add a setting to exclude unwanted tracks/artists from recommendations.
- [ ] Add optional listening statistics and yearly summaries using the owner's listening history.
- [ ] Add synchronized library/preferences across devices, followed by optional active-device control and playback handoff.
- [ ] Define device ownership, authentication, conflict resolution, and simultaneous playback behavior before implementing handoff.

## 15. Maintainability and deployment — P0/P2

- [ ] Keep the current React/Vite, Express, MongoDB, and Supabase foundation unless a specific requirement warrants replacement.
- [ ] Separate catalog, library, playback, imports, downloads, and optional podcast responsibilities.
- [ ] Centralize frontend API requests, authentication handling, cancellation, and error presentation.
- [ ] Break large player/detail/dashboard components into focused modules as those areas change.
- [ ] Validate API inputs, ownership, IDs, pagination limits, and numeric playback values consistently.
- [ ] Return safe production errors without internal stack traces or unnecessary implementation details.
- [ ] Add timeouts and bounded retries for external storage, authentication, and processing calls.
- [ ] Fail startup or readiness clearly when required services are unavailable.
- [ ] Use a persistent worker for media processing; document which deployment hosts run HTTP, background jobs, and any sockets.
- [ ] Review dependency advisories and upgrade affected packages with compatibility checks.
- [ ] Commit lockfiles and document supported runtime versions and required environment variables.
- [ ] Add deployment checks, readiness monitoring, actionable error logging, and storage/job failure alerts.
- [ ] Remove unused public-platform code and dependencies after feature migration is verified.
- [ ] Update README, setup instructions, architecture notes, and user guide to match the actual private music product.
- [ ] Document expected storage/bandwidth usage and choose hosting capacity for the personal library.

## 16. Verification and release criteria

The current backend tests cover a small set of mocked API responses. Add focused coverage for the behaviors below as they are implemented.

- [ ] Verify that anonymous users and other accounts cannot access private catalog/media/downloads or privileged actions.
- [ ] Test user-metadata role tampering, suspended accounts, expired sessions, and authentication-loading races.
- [ ] Test valid/invalid media ranges, expired URLs, failed uploads, and import retries.
- [ ] Test rapid track switching, queue ordering, repeated tracks, shuffle history, repeat modes, and next/previous behavior.
- [ ] Verify progress saves during continuous playback and does not attach to the wrong track.
- [ ] Verify session restoration and distinct song/podcast resume rules.
- [ ] Test importing a full album, duplicate detection, metadata correction, deletion, and cleanup.
- [ ] Test offline reload, offline seeking, expired sessions, storage exhaustion, and missing cached files.
- [ ] Test search ordering, stale responses, large libraries, and unavailable tracks.
- [ ] Run frontend build/lint and relevant backend checks in continuous integration.
- [ ] Verify key listening flows on desktop, Android, and iOS, including accessibility checks.
- [ ] Perform and document a successful database/media restore before relying on the app as the only library copy.

## Delivery milestones

### Milestone 1 — Secure and dependable foundation

Complete P0 authentication, private media, configuration, storage, and playback fixes. Remove personal-use checkout friction. Confirm existing media remains accessible to its owner.

### Milestone 2 — Personal music MVP

Import an album, inspect/edit its metadata, browse artists/albums/tracks, search, like songs, build a playlist, and play an album in order with a reliable queue, shuffle, and repeat.

### Milestone 3 — Everyday listening

Deliver the listening-first desktop/mobile interface, session restoration, verified offline downloads, lock-screen controls, and appropriate device testing. Keep podcasts optional.

### Milestone 4 — Premium polish

Add normalization, advanced transitions, lyrics, local recommendations, and optional device handoff based on actual daily-use needs.

## First end-to-end acceptance scenario

1. Sign in as the owner; an anonymous visitor cannot browse or play the private library.
2. Import an album and review extracted metadata/artwork.
3. Find it through search and play it in album order.
4. Add and reorder songs in the queue; verify shuffle and repeat.
5. Like a song and add tracks to a private playlist.
6. Close and reopen the app; restore the listening session without unexpected autoplay.
7. Download the album, reload offline, and play/seek through it.
8. Reconnect and confirm listening history/progress synchronize correctly.
9. Verify the same core experience on a phone, including lock-screen controls.

The initial release is complete when this scenario works reliably and the owner's media can be backed up and restored.
