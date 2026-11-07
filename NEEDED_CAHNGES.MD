# AetherCast — Needed Changes

## Product direction

Build **a private, ad-free music app for your own library, with podcasts as an optional section**.

The app should let its owner import music, organize a library, create playlists and stream across personal devices. It should provide a polished Spotify-style listening experience using the owner's own media. Offline/download development is deferred by the owner as of 2026-11-05 and is excluded from the active plan and release requirements. Existing episode-download behavior is retained. Spotify integration and a public commercial streaming catalog are outside the initial scope.

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

### 2026-10-28 — Change 8: Private music import and metadata review

- **Done locally:** Add owner-only `/music/import` with individual, multiple-file and folder selection, sequential uploads, per-file status, stop/retry controls and durable queued processing. Review extracted metadata before adding tracks to the catalog.
- **Done locally:** Validate signatures and parse MP3, M4A, AAC, FLAC, OGG and WAV; extract audio details, tags and optional embedded JPEG/PNG artwork. Bound upload size, pending jobs, upload requests and parser time/memory. Preserve private originals and verify server-computed checksums before analysis.
- **Done locally:** Recover interrupted jobs through expiring leases, reject stale/cancelled workers, and support manual retries. Reuse exact-file imports/assets. Confirm artists, album, track and job completion transactionally, with owner-scoped matching and duplicate indexes. Repeated confirmation does not overwrite an existing track.
- **Verified:** 165 backend tests and 32 frontend tests pass; frontend production build passes. Coverage includes real WAV parsing, multipart denial/content validation, bounded private reads, new-upload cleanup, cancellation leases, retry limits, reviewed metadata and transaction/session contracts. Targeted frontend lint and whitespace checks pass. The existing bundle-size advisory remains.
- **Deployment pending:** Backend Node.js 22+, MongoDB Atlas/replica set, private storage settings, index verification and a persistent `backend/src/server.js` worker process are required. No live database/storage/browser import session or deployment was performed. See `MUSIC_IMPORTS.md` and `PRIVATE_SETUP.md`.
- **Remaining:** Music-library/player integration, conversion, thumbnails, likely-metadata duplicate review, bulk management, direct/resumable transfer and safe retained-original cleanup. Failed/cancelled originals remain stored; storage quota enforcement is pending. Dependency audit reports 14 advisories, including one critical advisory in existing framework dependencies; the new metadata parser is not listed. Dependency maintenance remains separate work.
- **Next:** Add music browsing and connect tracks to the global player.

### 2026-11-05 — Change 9: My Music browsing and track playback

- **Hosted setup reported complete by owner:** The owner reports completing the previous four steps covering Node runtime, MongoDB transaction support, persistent backend, and private storage/import testing. This is recorded as owner-reported completion; no independent hosted session was performed for this batch.
- **Done locally:** Make My Music the default landing page; provide Songs, Albums and Artists with title/name search, pagination, refresh/retry/loading/empty states and URL-based album/artist filters. Keep optional podcasts accessible and link imports back to the collection.
- **Done locally:** Play tracks using fresh owner-authorized music playback URLs through the shared engine. Render a dedicated responsive music player with artwork, credits, album navigation, play/pause, previous/next, seek, volume and close. Songs start from zero at normal speed; refreshing the same song retains its position where available.
- **Done locally:** Queue the displayed page of songs, automatically advance at completion and stop at the end. Album pages follow disc/track order. Distinguish track/podcast identity and prevent music from calling episode progress/history/play-count APIs or using episode downloads/feature controls. Preserve the existing podcast progress/download behavior and stale-selection protection.
- **Verified:** All 39 frontend tests pass, including seven new music playback tests. Frontend production build and whitespace checks pass; targeted lint has no errors. Existing podcast-player/context lint warnings and the bundle-size advisory remain. Backend source is unchanged; its previous 165 passing tests remain the latest backend verification.
- **Limitations:** No authenticated live browser/device verification of the new library/player was performed. Queues contain at most the displayed 50 songs; whole-library queues, add/reorder/remove, repeated queue items, shuffle/repeat, music likes/playlists/history and music downloads remain pending. Unsupported-codec conversion and seamless streaming-link renewal are still pending.
- **Next:** Add personal music likes/playlists and fuller queue controls. Deploy the latest frontend and verify imported-song playback on desktop/phone. See `MUSIC_LIBRARY.md`.

### 2026-11-05 — Change 10: Distinguish sign-in verification from profile failures

- **Observed live:** The deployed frontend references the expected Supabase project. Its public ES256/P-256 signing-key endpoint returns 200. The Render backend `/health` returns 200 with `database: connected`; unauthenticated profile access correctly returns 401. These checks do not verify the backend's private environment values or an authenticated owner session.
- **Done locally:** Stop reporting every profile/database failure as a failed token. Return separate safe errors for invalid sessions (401), missing server signing/project configuration (503), unavailable signing keys (503), and library profile synchronization failures after successful verification (503). Add server log stage/reason categories without credentials, tokens, account details, or raw exception messages.
- **Verified:** All 170 backend tests pass. New cases cover missing signing configuration, unavailable key discovery, database/duplicate/validation failures and safe error responses. Syntax and whitespace checks pass. Frontend source is unchanged; its previous 39 passing tests and production build remain the latest frontend verification.
- **Still unresolved:** The exact cause of the screenshot's sign-in failure cannot be established from its generic error. No authenticated owner login or Render runtime log inspection was performed, and no owner credentials were changed. Deploy this diagnostic batch to the backend, retry sign-in, then use the new response and sanitized stage/reason log to identify the failing setting or profile operation. See `PRIVATE_SETUP.md`.

### 2026-11-05 — Change 11: Recover duplicate owner profiles and configure Render proxy handling

- **Confirmed from owner-supplied live logs:** Token verification succeeds, then profile synchronization fails with a duplicate-key error. The log also identifies `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`; this proxy/rate-limit issue is separate from profile creation. The supplied log does not identify which unique index conflicted.
- **Done locally:** Generate unique server-owned internal usernames for new profiles instead of reusing editable metadata usernames. Recover simultaneous first-login creation by reloading only the verified Supabase UID/email; retry a username-only collision up to three total attempts. Never adopt a conflicting username's account, overwrite a different linked identity, or allow a suspended account.
- **Done locally:** Match legacy email casing and link missing/null/empty provider IDs without replacing the existing library ID or role. Preserve all existing records and indexes; no live rows/indexes were deleted or manually rewritten. If a different unique index still fails, log only recognized field names with the existing safe reason category.
- **Done locally:** Set bounded Express proxy trust before rate limiting. On Render it defaults to one nearest proxy hop; direct hosting defaults to none. `TRUST_PROXY_HOPS` optionally accepts 0–5, rejecting booleans/wildcards/malformed settings. Extra hosting proxies require checking the real forwarding path before changing the hop count.
- **Verified:** All 186 backend tests pass across 15 suites. New tests cover generated usernames, concurrent duplicate recovery, bounded retries, legacy email/identity linking, cross-account and suspension denial, successful profile HTTP provisioning, proxy configuration and separate client rate limits with forged-header rejection. Syntax and whitespace checks pass. Frontend is unchanged.
- **Hosted verification pending:** Deploy the latest backend and retry sign-in. The confirmed duplicate-profile failure has targeted recovery now, but successful real owner login and hosted client-IP behavior still need verification after deployment. No password, owner UID, database row, index or hosted environment setting was changed from this workspace.

### 2026-11-05 — Change 12: Require explicit credentials on every new page visit

- **Cause found in source:** The frontend used Supabase's default persistent sessions and restored them automatically with `getSession()`/auth-state events. This could reopen an earlier signed-in browser session without new password entry; it did not demonstrate anonymous backend access.
- **Done locally:** Disable persisted Supabase sessions, remove this project's legacy saved login/token entries, and keep authorization in memory only. A page reload, new tab/device or return from browser page cache starts locked; ordinary navigation inside an authorized running app remains signed in.
- **Done locally:** Only explicit email/password submission can grant initial library access, after Supabase verifies the current credentials and the backend authorizes the owner profile. Verify profile/provider identity agreement. Initial/restored SDK sessions, recovery links, unsolicited sign-in events and disabled Google OAuth actions cannot grant initial library access. Password recovery remains available and returns to a required fresh sign-in after updating the password.
- **Done locally:** Gate API and listening-room token access behind this approved in-memory session. Ignore legacy access-token cookies on the backend; owner APIs require an explicit bearer token. Lock immediately on logout, page departure, account changes, failed refresh verification and recovery; cancel stale profile/token reads. Profile verification has a 15-second timeout. Clear entered passwords after submission and never hardcode, retain or commit owner credentials.
- **Verified:** All 187 backend tests and 51 frontend tests pass. New cases cover persisted/recovery/unsolicited sessions, wrong credentials, denied/mismatched profiles, delayed owner approval, new-page gates, failed logout, stale responses, refresh identity, post-lock token reads and legacy-cookie denial. Frontend production build, targeted lint (no errors) and whitespace checks pass; the existing auth-context fast-refresh warning and bundle-size advisory remain.
- **Verification limit:** An attempted fresh-browser check could not start because the browser tool failed to initialize its local assets. No real authenticated multi-device session was exercised in this batch. Deploy frontend and backend together, then verify a normal/incognito/new-device visit, wrong-password denial, successful owner sign-in, reload requiring credentials, logout, password recovery and phone playback.
- **Scope:** Supabase continues to verify passwords; no password is embedded in application code or checked against values from chat. Existing signed media links retain their documented 15-minute lifetime, and previously issued provider tokens are not globally revoked by this frontend policy. Complete offline launch without credentials is intentionally unavailable under the requested fresh-sign-in policy.

### 2026-11-05 — Change 13: Adapt the listening interface using Echo Music as a reference

- **Decision policy:** Echo Music is inspiration; the owner and implementer retain final decisions. Reviewed its README/design notes and home/player screenshots. Record applied and proposed choices in `REFERENCE_DIRECTION.md`. Use original React/CSS without copying Echo source, branding or media.
- **Done locally:** Replace the old platform navbar with an AetherCast desktop sidebar, global song-title search, compact owner controls and mobile Listen/Search/Library/Import tabs. Keep podcasts/tools in secondary navigation; move podcast history to `/history` and make `/library` show music. Remove the custom cursor from the running app.
- **Done locally:** Add rounded artwork cards/grouped song rows, segmented collection views, recent/A–Z ordering and a recently added section based only on real imported records. Provide color-based missing/broken-artwork placeholders. Set browser/manifest naming to AetherCast and add an original SVG app mark; existing raster icon compatibility assets remain.
- **Done locally:** A compact player opens a native Now Playing dialog with large artwork, restrained backdrop, credits/album navigation, touch-sized controls, mute/volume, elapsed/remaining time and a visible current queue with song selection. Support native Escape/focus behavior, standard keyboard playback/seeking/mute shortcuts that ignore text/native controls, focus indicators and reduced-motion preferences.
- **Verified:** All 54 frontend tests pass, production build and whitespace checks pass, and changed UI modules pass targeted lint without warnings. New tests exercise safe keyboard shortcuts. Existing authentication/playback regression suites remain passing. Backend is unchanged; its previous 187 passing tests remain the latest backend verification.
- **Limitations:** No actual logged-in browser/mobile layout session was verified in this batch; the browser tool previously failed to initialize local assets. Queue visibility is implemented, but queue editing, repeated queue-item identity, shuffle/repeat, full-album playback beyond a page, music likes/playlists/history, lyrics and music downloads remain pending. No Echo Android/YouTube provider features are added automatically.
- **Next:** Complete the queue model and controls, then owner-scoped likes and music playlists. Deploy the latest frontend and verify desktop/mobile navigation, Now Playing, focus/Escape, search and logout without changing the fresh-credentials policy.

### 2026-11-05 — Change 14: Complete the music queue and defer offline work

- **Owner direction applied:** Proceed with the reference-based recommendation while removing offline/download development from the active plan. Update `IMPLEMENTATION_PLAN.md` and this checklist; retain existing episode downloads without adding a new offline subsystem.
- **Done locally:** Integrate the existing Change 13 interface draft with a separate bounded music-queue reducer. Give every occurrence a unique ID, including repeated songs; keep manual next-up items distinguishable from collection context. Add Play Next/Add to Queue, queue selection/removal, upcoming-item up/down reordering and keep-current-only clearing.
- **Done locally:** Add stable shuffle, actual previous/forward listening history, repeat off/all/one, natural completion advancement, and a three-second previous-button restart threshold. Removing the current occurrence loads the next or previous item while preserving paused/playing intent; removing the last closes the player. Adding to an empty queue loads a paused item instead of autoplaying.
- **Done locally:** Load complete album/filtered contexts across 100-record API pages, preserving server order, with a 2,000-song bound and visible errors for oversize/changed/partial/denied results. Cancel earlier selections on a newer selection, navigation, explicit cancellation or logout. Paginate the queue display in groups of 100. Keep podcast APIs, source privacy and fresh credential requirements intact; clear playback whenever authorization disappears.
- **Validation:** All 73 frontend tests pass, including 19 new queue tests covering repeated identities, manual insertion, shuffle/history, repeat boundaries, current removal, reorder/clear, limits, complete pagination, cancelled/changed collections and mixed-edit invariants. Production build, targeted lint (no errors) and whitespace checks pass. Existing player-context fast-refresh/ref-cleanup warnings and the bundle-size advisory remain. Backend source is unchanged; its previous 187 passing tests remain the latest backend verification. Real hosted audio and mobile/browser interaction remain unverified; the browser automation tool previously failed to initialize.
- **Remaining:** Queue/current-position restoration after a new sign-in is not implemented. Context pagination detects count/duplicate/partial changes but is not a transactional snapshot during concurrent catalog edits. Music likes, playlists and listening history are the next feature batch. Offline work remains deferred.

### 2026-11-05 — Change 15: Personal music collections and listening history

- **Done locally:** Add owner-scoped TrackLike, SavedAlbum and FollowedArtist records with unique owner/reference indexes. Provide Liked Songs, Saved Albums and Followed Artists views and save controls in the music catalog/player. Saved rows remain removable when their original reference is unavailable.
- **Done locally:** Add separate music playlists with names/descriptions, create/rename/soft-delete, add/remove, and touch/keyboard up/down reorder. Bounded ordered subdocuments preserve stable entry IDs and repeated songs; selecting a repeated occurrence starts that exact entry. Version-checked atomic updates return 409 on conflicts rather than overwriting another device's order. Limit playlists to 2,000 entries and each add request to 100 songs. Unavailable entries remain removable; playlist playback reports skipped entries.
- **Done locally:** Record music listening sessions only after actual `playing`, with independent playback UUIDs, start/skip/completion outcomes, title snapshots, bounded listening seconds and 180-day TTL retention. Exclude pause/buffering time and seek jumps. Deduplicate starts/outcomes, preserve session identity on media-link renewal, and separate repeats. Show Recently Played with real session outcomes and elapsed listening. Keep music records separate from episode APIs/data.
- **Done locally:** Keep owner authorization and current-credential sign-in intact. Validate IDs, references, pagination, bodies and metrics; hide storage locations and owner credentials in response DTOs. Abort stale UI reads/writes; offer refresh after errors/conflicts without automatically retrying playlist additions. Document API, data choices and rollout in `MUSIC_COLLECTIONS.md`.
- **Validation:** All 220 backend tests and 86 frontend tests pass. Production frontend build and targeted lint pass with no errors; existing PlayerContext fast-refresh/ref-cleanup warnings and the bundle-size advisory remain. Coverage includes owner/guest boundaries, reference validation, unavailable records, playlist version races/repeated entries, model indexes, listening identity/accounting/terminal precedence, failed writes and authenticated request boundaries. Controller database calls are mocked; hosted MongoDB/index concurrency and actual media events still require verification.
- **Remaining setup/verification:** Deploy both applications and verify additive collections/indexes, likes across re-login/devices, conflicting playlist edits, repeated-track selection, deleted-track placeholders, real playback/history, logout and phone controls. No new environment variables are required. No deployment or authenticated live browser/device session was verified in this batch. Final history delivery is best effort under browser/network termination; no durable retry queue is included. Aggregate statistics, pinned favorites, playlist artwork/dragging/undo/multi-selection, queue restoration and grouped search remain future work. Offline/download work stays deferred.
- **Next:** Grouped private track/artist/album/playlist search and everyday browsing, followed by lyrics and explainable recommendations. See `IMPLEMENTATION_PLAN.md`.

### 2026-11-05 — Change 16: Grouped music search and browsing actions

- **Done locally:** Add owner-only `/api/music/search` for grouped song titles, artist names, album titles and music-playlist names. Escape literal Unicode/punctuation queries; reject extra fields, query injection, empty/oversize terms and invalid groups/sorts/pages. Filter deleted records and owner-scope populated references; return explicit DTOs. Bound category results to 50, pages to 1,000 and each MongoDB find/count execution to two seconds; safe timeout errors never publish partial results.
- **Done locally:** Add `/music/search` with All/category views, result totals, category pagination, A–Z/recent sorting, loading/empty/retry states and URL-based navigation. Connect desktop/global/mobile search and the My Music link. Abort stale requests and suppress late successes/errors even if cancellation is ignored. Search is submitted deliberately; it does not fetch while typing or autoplay.
- **Done locally:** Expose song play/queue/like/playlist actions, album saves, artist follows and links to full album/artist/playlist contexts. Search plays one selected song rather than treating a partial results page as a complete collection. Add shortest-first song browsing/full-context playback and additive recent/duration/playlist-name ordering indexes. Existing credential/privacy and podcast separation rules remain intact; offline work stays deferred.
- **Validation:** All 261 backend tests and 91 frontend tests pass. Production frontend build, targeted lint with no warnings/errors and whitespace checks pass; the existing bundle-size advisory remains. Tests cover owner/guest boundaries, safe DTOs/population, literal/Unicode matching, bounds/pagination/stable ordering, timeout/failure handling, URL navigation, cancellation and stale responses. Database queries are mocked; hosted index plans/performance and real browser/media interaction remain unverified.
- **Remaining setup/verification:** Deploy both applications, verify new database indexes and test real names/Unicode/punctuation, paging, Back/Forward, result actions, full-context duration order, login/logout and phone/keyboard layout. No new environment variables or provider keys are required. Case-insensitive substring matching can scan owner records; execution limits and bounded responses do not establish large-library performance. Counts/results are not a transactional snapshot. Richer album/artist details, thumbnail generation, additional filters and device checks remain follow-ups. See `MUSIC_SEARCH.md`.
- **Next:** Owner-supplied lyrics and explainable recommendations from the private library; retain hosted acceptance checks and deferred offline scope.

### 2026-11-06 — Change 17: Owner lyrics and explainable library recommendations

- **Done locally:** Add owner/track-scoped, uniquely indexed TrackLyrics with plain text and basic timed LRC, repeat timestamps, Unicode, stable simultaneous-line handling and a ±60-second timing offset. Accept pasted text or bounded UTF-8 `.txt`/`.lrc` drafts; require explicit Save. Validate content/line/timestamp limits and render text safely. Keep source notes as text without fetching URLs. Version checks/unique first-save conflicts prevent overwrites; clearing keeps a new empty version.
- **Done locally:** Add Lyrics to expanded Now Playing. Highlight against the live position after seeking, seek from timed lines with the same offset, show plain/missing/instrumental-break states and make follow scrolling opt-in with reduced-motion support. Cancel stale requests/file drafts on track changes/closure; retain errors and reload controls for failed/conflicting saves.
- **Done locally:** Add Your library mix at `/music/mix` and owner-only recommendation APIs. Rank up to 30 ready owned songs using likes, meaningful listening time, shared artists/genres, novelty within sampled history, recency and quick skips; balance artist repetition deterministically and display reasons/rule scores. Empty/cold-start libraries use real available data without invented preferences. Support full mix playback and individual play/queue actions.
- **Done locally:** Add separately indexed MusicExclusion records with song/credited-artist controls, paginated restore (including unavailable references) and owner/reference validation. Exclusions override likes/history and never change manual library/playlist access. Exclusion management remains usable if mix generation fails. No external lyrics/catalog/model calls, new keys, auth persistence or offline subsystem are introduced.
- **Validation:** All 292 backend tests and 94 frontend tests pass. Production frontend build, targeted lint with no warnings/errors and whitespace checks pass; the existing bundle-size advisory remains. Coverage includes schema/input bounds, LRC/Unicode/offset/seek/file handling, owner/version/first-save conflicts, safe DTOs, bounded ready-audio candidates, deterministic ranking/diversity, evidence-based listening, exclusion precedence and guest/non-owner HTTP denial. Controller database operations are mocked; actual browser timing, hosted MongoDB/index concurrency and real-device behavior remain unverified.
- **Remaining setup/limits:** Deploy matching frontend/backend versions and verify unique lyrics/exclusion and pagination indexes. Test real lyrics saving/re-login/two-tab conflicts, track changes/offset seeking, phone/keyboard/reduced motion, actual history/mix playback, exclusions/restoration and logout. No new environment variables are required. Mixes support at most 2,000 active songs/5,000 exclusions and sample at most 1,000 sessions within 180 days; larger sets fail explicitly. Lyrics limits, scoring and detailed hosted acceptance are in `MUSIC_PERSONALIZATION.md`. Automatic lyrics/alignment, external AI, scoring preferences, aggregate statistics, larger-library support and hosted checks remain follow-ups. Offline work stays deferred.
- **Next:** Online mobile playback and Media Session controls, retaining hosted/device acceptance and the fresh-credential policy.

### 2026-11-06 — Change 18: Music device controls and retry safeguards

- **Done locally:** Add a feature-detected Media Session bridge for music title/artist/album, playback state and finite duration/rate/position. Register supported Play, Pause, Stop, next/previous and relative/absolute seek actions; use live owner/media/queue refs, clamp seeks and respect queue boundaries/paused intent. Unsupported APIs fail independently. Keep private audio/artwork URLs, credentials and account fields out of OS metadata; artwork remains inside the app.
- **Done locally:** Separate idempotent Play/Pause from the UI toggle, deduplicate pending play attempts and ignore stale play failures. Clear music metadata/handlers/position on close, podcast switch, lock/logout and disposal. Immediate page-lock/logout handling blocks commands, aborts pending resolution and detaches audio before a stale device action can restart it. Pending music requests remain cancellable by authorized Pause/Stop callbacks.
- **Done locally:** Request inline media playback and metadata preload. Add 15-second media-resolution cancellation, abort replaced selections and retain an owner/track/occurrence-scoped in-memory position after failed music refreshes for explicit authorized retry. Preserve normal new-song/repeated-occurrence starts and podcast resume behavior. Do not auto-resume on reconnection or use failed/denied URLs as fallback. Conservatively pause on reported device changes without claiming reliable headset detection or requesting microphone access.
- **Validation:** All 108 frontend tests pass. Production build, targeted lint with no errors and whitespace checks pass; existing PlayerContext fast-refresh/ref-cleanup warnings and the bundle-size advisory remain. Tests cover metadata privacy, command routing/bounds, pending cancellation, live state, unsupported APIs, buffering/paused states, cleanup/disposal, checkpoint isolation, duplicate play and stale/blocked attempts. Browser/media APIs are simulated. Backend source is unchanged; the previous 292 passing backend tests remain its latest verification.
- **Remaining setup/verification:** Deploy the frontend and test on real desktop/Android/iOS browsers: lock-screen/headset commands, seeking, backgrounding, interruption, Bluetooth/device changes, slow/failed/expired media lookup, retry position, logout and back-cache locking. No new environment variables or database setup are required. Browser support and background policy vary; no authenticated live/device playback or deployment was verified in this batch. Detailed acceptance and limits are in `MUSIC_DEVICE_CONTROLS.md`. Seamless link renewal, reliable device-specific interruption policies and physical-device acceptance remain open. Offline/download work stays deferred.
- **Next:** Media processing/artwork and browser audio-format quality, retaining outstanding hosted/device checks.

### 2026-11-06 — Change 19: Compatible audio and private artwork processing

- **Done locally:** Add owner/source/profile-unique durable MediaProcessingJob records, fixed MP3-192/320px-cover profiles, leases, interrupted-job recovery, safe errors, explicit retry and cancellation. Validate active owned sources, pending-job admission and source checksums. Run one processing job per worker process when explicitly enabled; preserve original audio/artwork and original track references.
- **Done locally:** Add bounded native FFmpeg conversion with fixed arguments, no shell/stdin, restricted input protocols/demuxers, disabled external MOV references, limited threads/allocations/stderr/runtime and a child environment without service credentials. Parse output technical metadata, reject size/duration mismatches and verify JPEG dimensions/end marker. Clean only verified temporary directories; retain unpublished uploaded assets for a later safe retention workflow.
- **Done locally:** Publish derivative readiness and thumbnail links transactionally with lease checks. Store new generated objects separately; checksum reuse never modifies existing originals. Owner-scope nested thumbnail population, serve signed thumbnail/full-art links and use full artwork in expanded music views. Original media delivery and podcast data remain intact.
- **Done locally:** Add the player's Audio preparation/status/retry/cancel panel and explicit Original/Compatible selector. Preserve seek position/paused intent, reject unavailable copies without fallback and display measured format/codec/bitrate/sample rate. Add an FFmpeg-enabled backend Dockerfile and setup/API/limits/retention guide in `MUSIC_PROCESSING.md`.
- **Validation:** All 315 backend tests and 109 frontend tests pass; frontend build, targeted lint with no errors and whitespace checks pass. Existing player-context warnings and bundle advisory remain. Three real FFmpeg 7.1 tests cover WAV-to-MP3 technical metadata and PNG/JPEG thumbnails; the test executable is isolated under ignored node_modules. Remaining tests cover ownership/guest boundaries, profiles, queue/cancel/retry, checksum integrity, lease/transaction contracts, temp cleanup, subprocess limits, safe playback selection and private artwork/technical labels. Database/storage operations are mocked; Docker, hosted jobs and physical devices are unverified.
- **Required hosted setup:** Provision maintained FFmpeg and enable `MUSIC_PROCESSING_ENABLED=true`, with `FFMPEG_PATH` when needed; retain Node 22+, private storage and transaction-capable MongoDB. The included Docker backend provides FFmpeg but is not deployed automatically. Deploy both apps, verify job indexes/transactions, test real input formats/worker restart/cancellation, original-vs-compatible playback and phone artwork. No local/hosted credentials or deployment settings were changed.
- **Remaining Phase 6 work:** Automatic permanent retained-object cleanup, seamless URL renewal/long-stream tests, more artwork sizes, normalization/loudness and gapless/crossfade evaluation, resource/cost and backup/restore verification. Cancellation prevents publication but does not immediately kill an active encoder. This batch completes conversion/thumbnail foundations, not all audio-quality polish. Offline/download work stays deferred.

### 2026-11-06 — Change 20: Reference-based mobile light/dark themes

- **Owner request applied:** Use the supplied Acoustic Silence / Aura Nocturne references for light/dark mobile appearance, with a toggle. Add shared neutral/light and deep-violet/lavender dark palettes, Plus Jakarta Sans typography, quieter cards/borders, compact recent-song shortcuts and safe-area-aware navigation/player spacing. Desktop follows the same appearance.
- **Done locally:** Replace competing navigation/Settings theme controllers with one provider. Keep the visible header toggle and add it inside full-screen Now Playing; Settings offers Light, Dark and Use device setting. Persist only the non-secret `theme` preference, preserve old light/dark choices, tolerate blocked storage, initialize before app rendering, update native control/browser chrome colors and synchronize same-origin tabs/device preference. Current-credential authorization remains unchanged.
- **Done locally:** Make `/library` show saved collections, retain all music at `/music`, add real-track playlist artwork collages and visible playlist playback, and tuck create/edit forms into keyboard-accessible native disclosures. Keep versioned playlist actions. Fix narrow mini-player title sizing and pagination overflow; keep advanced audio version selection in the Audio tab and stop/close in expanded Now Playing.
- **Validation:** All 114 frontend tests and the production build pass. Targeted lint has no errors; component/context fast-refresh warnings and the bundle advisory remain. New tests cover safe preference reads/writes, blocked storage, system/manual resolution, palette/chrome application, head initialization and 4.5:1 contrast for normal text/primary controls. Backend source is unchanged; its previous 315 passing tests remain the latest backend verification.
- **Browser verified:** Real signed-out login toggle/persistence; actual music components with isolated sample data at mobile/desktop sizes; dark/light Now Playing and toggle; Library/playlist/Settings; saved selection after reload, System matching, cross-tab synchronization and 320px layout without page overflow (314px content width). Preview fixtures stayed in ignored output and are not shipped or used to bypass app authorization. Screenshots show sample data, not the owner's private library.
- **Remaining:** Frontend deployment and physical iOS/Android checks, legacy screens and extreme-content accessibility testing. No new environment variables, backend/database changes or credentials are needed. No production deployment or authenticated library/media writes were performed. See `MOBILE_THEMES.md`. Offline work and remaining Phase 6 quality/retention work keep their prior status.

### 2026-11-06 — Change 21: Exact reference song covers and embedded-artwork recovery

- **Owner request applied:** Cover both the nine songs in the earlier “mood on” screenshot and imported songs. Retrieve official release artwork metadata, visually compare all nine covers against the screenshot, and pin their exact title/primary-artist/release references. Keep Hyper Pop, Afrobeat Mix, Tamil and film versions distinct. No stock/AI image, artist portrait or approximate search result is assigned as a song cover.
- **Done locally:** Add verified artwork fallback through the shared track DTO for library/search/playlists/mixes/playback. Preserve ready private track/album covers first, reject conflicting release/language metadata and leave unmatched/broken covers as music-note placeholders. Show the external release source in the Audio panel and omit referrers from cover requests. These are fixed remote image references, not downloaded songs, copied production records or a Spotify audio/API integration.
- **Done locally:** New imports prefer a single tagged front cover over back/artist/disc pictures and reject ambiguous/invalid/oversized artwork. Add an authenticated, rate-limited Find embedded front cover action for existing songs without their own cover. Verify the owned original checksum/size, preserve audio, store through private checksum-deduplicated storage, and publish with a no-overwrite owner/source compare-and-set. Keep existing covers and show clear missing-cover/success feedback; refresh/reselect after recovery.
- **Validation:** All 26 backend suites pass: 336 passing tests, three optional real-FFmpeg checks skipped. Focused matching tests pass again after tightening primary-credit matching. All 114 frontend tests, production build, targeted lint and whitespace checks pass; existing bundle advisory remains. New tests include all nine mappings and negative cases, signed private-cover precedence, front/back selection through a real parser-worker fixture, image bounds, ownership/checksum protection, races/concurrency and anonymous route denial. Storage/database recovery writes are mocked.
- **Browser verified:** All nine visually matched CDN images load at 300px through the actual artwork component, with no-referrer attributes, both themes and no horizontal overflow at 390px; actual recovery controls show simulated success and missing-cover feedback. Isolated preview fixtures are ignored and removed from delivery; no live sign-in or media/database write was performed.
- **Remaining/setup:** Deploy both apps; verify the real owner's metadata and private recovery end to end. No migration/new environment variable/FFmpeg setup is needed for this action. Unknown songs still need their own embedded cover or a separately verified match; wrong pre-existing covers are preserved pending reviewed replacement. The deployed catalog has not been inspected or bulk-modified. See `MUSIC_ARTWORK.md` for all nine source links, matching rules, external-image dependency and limits. Remaining Phase 6 work and offline deferral are unchanged.

### 2026-11-06 — Change 22: Read-only media retention review

- **Done locally:** Add `npm run --silent media:retention` for the configured active owner's media, with bounded `_id` cursor pages, a default 30-day retention window and page-only category/byte summaries. Preserve originals/unclassified assets and every observed track/album/artist/import/job/original/thumbnail reference, including soft-deleted catalog rows and failed/cancelled work. Pending source jobs protect older sibling derivatives that could be reused.
- **Done locally:** Classify older ready unreferenced derivative records as **review candidates**, retain incomplete/newer/malformed metadata and reject unsafe numeric totals. Restrict all queries to the configured owner, apply query/connect time bounds, abort on incomplete reference checks, omit sensitive storage/account fields and disconnect before JSON output. The CLI disables automatic collection/index creation, accepts no foreign owner/collection/object paths and has no apply/delete mode. No live media, database references or application authentication behavior are changed.
- **Validation:** The full backend suite passes with 351 tests and three optional real-FFmpeg checks skipped (27 suites). All 16 focused retention tests pass after adding malformed-parent coverage; CLI help and destructive-flag rejection are verified without database access, and whitespace checks pass. Tests cover original/deduplication/reference protection, age boundaries, invalid data/byte totals, paging/query bounds, safe failure paths and CLI connection/owner/disconnect behavior. Test database calls are mocked. Frontend source is unchanged; its previous 114 passing tests/build remain the latest frontend verification.
- **Real database check:** Run the CLI read-only against the configured backend database on 2026-11-06 at 17:28 IST. Find five registered assets (three audio files/two covers), all classified as originals and referenced by tracks/imports, with cover album references too. Zero review candidates, 17,439,191 bytes in record metadata and no next page. No database/storage writes or index/collection creation occurred. This verifies database reporting, not physical-object contents or a deployed HTTP flow; no private asset IDs/paths or report export are committed.
- **Remaining Phase 6 cleanup:** Assess physical objects/storage aliases and legacy/cross-owner references, add publication/reference fencing honored by all writers, and implement quarantine/recovery and crash-safe permanent deletion before introducing any purge. Repeat the report after new processing/imports. Reports are live observations, not deletion approvals or measured physical-storage totals. This batch delivers the retention review foundation; permanent cleanup and the rest of Phase 6 remain pending. No new environment variables, migration or automatic worker is added. See `MEDIA_RETENTION.md`. With no current review candidates, the next daily-use batch can address streaming-link renewal. Offline work stays deferred.

### 2026-11-06 — Change 23: Expiry-aware playback-link recovery

- **Done locally:** Retain authenticated music-link lifetime as an in-memory advisory deadline. Add automatic near-expiry network/source-error recovery and an eight-second, same-source/no-progress stall check; healthy streams are not periodically reloaded. Preserve current owner/song/queue occurrence, selected audio quality, last known position and playing/paused intent through the existing fresh-link selection path. Expired paused seeks/resumes resolve a new authorized link.
- **Done locally:** Bound automatic recovery to two attempts per occurrence/quality per ten minutes, with a one-minute cooldown. Keep existing request timeout/abort/selection checks and no-old-source fallback after denial. Cancel timers/work on pause, close, selection, device pause and session lock/logout. Show Reconnecting with an explicit cancel control and temporarily disable seeking. Fix Next/Previous/active-item removal/quality changes during reconnection to respect listener intent rather than the browser's error-paused state; retain position even if a media error resets currentTime to zero.
- **Validation:** All 132 frontend tests pass; production build, targeted lint without errors and whitespace checks pass. Existing PlayerContext warnings and the bundle advisory remain. New tests cover expiry/invalid lifetime, all recovery gates, stalled/progress checks, positions/paused seeking, retry budgets, current identity/quality, cancellation and stale promise completion. Backend source is unchanged.
- **Browser verified:** Actual PlayerProvider/MusicPlayer in an isolated simulated auth/API/media fixture: recover at 45 seconds onto a new source without changing the queue occurrence or duplicating the listening-start event; paused seek at 75 seconds; retained quality/pause; pending cancellation; denied source removal and explicit retry; Next while reconnecting and stale-response rejection; logout clearing and late-response denial. Final preview has no browser errors. The final build removes ignored fixture code. No production credentials, media/API requests or library writes are used for this simulation.
- **Remaining/setup:** Deploy the frontend and test real expired media/range requests, long streams and physical Android/iOS/background behavior. Source replacement may buffer; gapless/seamless playback is not claimed. No new environment variables, backend migration, storage or auth changes are required. Guarded permanent cleanup, loudness/normalization, advanced transitions and the remaining Phase 6 hosted checks are still pending. See `MUSIC_STREAMING.md`. Offline work stays deferred.

### 2026-11-07 — Change 27: Shared-object protection in retention review

- **Done locally:** Extend read-only retention reporting to version 2 with exact provider/bucket/object-key alias existence checks across all asset owners/statuses, excluding the current record. Shared derivatives stay protected; incomplete/malformed storage identities stay protected without unsafe lookups. Originals remain original. Hidden storage fields and other-owner IDs never enter report output.
- **Done locally:** Bound alias checks to the returned page, at most four active checks and five seconds per database query. Failed/timed-out queries abort the report. Preserve the CLI's disabled index/collection creation, configured-owner page scope, safe errors and no-delete behavior. No object requests, writes, migration, new dependency or environment setting were introduced.
- **Verified:** All 29 backend suites pass: 380 tests passed, six FFmpeg-dependent tests skipped without a configured encoder path. Six new tests cover alias protection, exact/local identity, malformed identity, failed queries, page/concurrency bounds and original preservation. A real read-only database run found five originals, zero aliases, zero unverified identities, zero review candidates and no next page (17,439,191 asset-metadata bytes). Syntax/whitespace checks pass. Frontend is unchanged; its latest verification remains 147 passing tests and a successful production build.
- **Remaining/setup:** No cleanup was performed. Physical object/legacy URL/filesystem alias checks, cross-owner catalog corruption checks, writer fencing, backup restoration and crash-safe deletion remain pending. Large libraries may need explicit index/query-plan work if bounded alias checks time out. Hosted/device playback and true gapless/crossfade remain open; offline stays deferred. See `MEDIA_RETENTION.md`.

### 2026-11-07 — Change 26: Private cloud transfer inactivity limits

- **Done locally:** Add a 30-second body-transfer inactivity watchdog to private cloud media delivery. Refresh it on non-empty chunks without imposing a total song-length limit. Preserve bounded streaming/backpressure, byte-range forwarding, private capability validation and no-store headers.
- **Done locally:** Abort storage and terminate partial responses on stalled transfer or disconnect; clear watchdogs on every completion/error path. Keep HEAD/416 handling and local-file delivery unchanged. A browser that stops reading can also hit this transfer-progress deadline; manual Play may be required after interruption.
- **Verified:** All 29 backend suites pass: 374 tests passed and six FFmpeg-dependent tests skipped in this run (no FFmpeg path supplied). Seven new stream tests cover four simulated minutes of healthy delivery, initial/midstream stalls, cancellation, upstream/downstream failures, backpressure and timer cleanup. Five new HTTP cases cover cloud HEAD, safe 404/403/500 handling and expired cloud capabilities. Existing local/cloud ranges remain passing. Syntax and whitespace checks pass. The initial restricted HTTP test run could not connect to loopback; the complete rerun with network permission passed.
- **Remaining/setup:** Deploy the backend; no dependency, environment or migration change is required. Tests use simulated time/in-process streams and mocked storage, so hosted long-stream/range, physical-device/background, backup restoration, guarded cleanup and true gapless/crossfade acceptance remain open. Frontend is unchanged; its latest verification remains 147 passing tests and a successful production build. See `PRIVATE_MEDIA_TRANSFERS.md`. Offline stays deferred.

### 2026-11-06 — Change 25: Bounded next-song preparation

- **Done locally:** Add an enabled-by-default Audio toggle to look up the natural next song during the final 15 seconds, without changing current playback or queue timing. Consume it once only for the same owner/session, quality, source request and exact queue occurrence.
- **Done locally:** Keep one response in memory with a 15-second deadline, under-30-second age and at least 60-second expiry headroom. Cancel on pause/seek/buffering/error; reset on logout/page exit/close/manual selection. Failures/mismatches use normal lookup. Persist only the on/off preference.
- **Verified:** All 147 frontend tests pass, including 12 preparation tests. Actual local player/browser testing with generated muted audio and simulated auth/API confirmed natural handoff without another lookup, disabled-setting behavior and logout cancellation despite a late response. Targeted lint and production build pass with existing context warnings/bundle advice.
- **Limits/setup:** Brief capability reuse does not recheck backend profile/catalog state at the exact handoff. No backend/environment change is needed. Hosted/physical-phone acceptance, true gapless/crossfade, guarded cleanup and remaining Phase 6 checks stay pending. Offline stays deferred. See `MUSIC_TRANSITIONS.md`.

### 2026-11-06 — Change 24: Measured optional volume normalization

- **Done locally:** Add the explicit `mp3-normalized-v1` job/profile and session-level Normalized MP3 audio choice. Original stays the default and is preserved. Measure the original stereo rendering, apply bounded fixed gain toward -14 LUFS with 2 dB pre-encode peak headroom and a 6 dB boost cap, then independently measure the encoded MP3. Publish only verified finite measurements and decoded true peak at/below -1 dBTP, with duration/size checks. Quiet/high-crest-factor files can stay quieter; no dynamics compression or invented target attainment is claimed.
- **Done locally:** Reuse owner/source/checksum/job leases, private checksum-deduplicated storage and transactional publication; store bounded measurements with the ready job. Limit encoder/filter threads, stderr and each of three passes to two minutes, with fixed local arguments, no shell/service credentials and verified temporary cleanup. Reject silence, invalid measurements, peak-unsafe encoded output and arbitrary profile/target input. Unavailable or unverified normalized playback returns 409 without fallback. Existing compatible/artwork preparation stays unchanged unless normalization is explicitly requested.
- **Done locally:** Add preparation/status/measured LUFS/peak/gain display in the Audio panel and Original/Compatible/Normalized selection. Preserve position, pause, queue and selected quality through existing playback/renewal safeguards. Source default and session cleanup remain unchanged; no automatic library conversion or offline feature is added.
- **Validation:** All 368 backend tests pass with the six real FFmpeg tests enabled, including generated loud/quiet samples and real silence rejection. All 135 frontend tests, production build, targeted lint without errors and whitespace checks pass; existing PlayerContext warnings/bundle advisory remain. Coverage includes gain/peak bounds, actual encoded measurement, silent/invalid data, subprocess/temp restrictions, schema/DTO safety, explicit profile validation, owner/source/ready-output selection and measured atomic publication. Test database/storage operations are mocked.
- **Browser verified:** Actual player/provider/processing components with simulated auth/API and actual muted generated WAV/MP3: real decoding/playback, paused position-preserving switching, normalized request submission, measured display, unavailable-copy error/source-attribute detachment without fallback and explicit successful retry. 390px layout has no horizontal overflow; final preview has no browser errors. A 60-second fixture measured -5.65 to -14.25 LUFS, decoded peak -13.53 dBTP and gain -8.35 dB. No owner songs were analyzed or converted; ignored fixtures are removed by the final build.
- **Remaining/setup:** Deploy matching backend/workers before the frontend and verify hosted FFmpeg filters, real jobs/cancellation/restart/private storage and phone playback. Use existing processing/FFmpeg configuration; no new environment variable, dependency or old-data rewrite is required. Album-level normalization, additional profiles, gapless/crossfade, guarded cleanup and other Phase 6 hosted acceptance remain pending. See `MUSIC_NORMALIZATION.md`. Offline work stays deferred.

## Priority definitions

- **P0 — Foundation:** Fix security, data durability, and playback correctness before extending the app.
- **P1 — Core product:** Implement the music catalog, imports, library, and everyday playback.
- **P2 — Daily-use quality:** Complete mobile streaming behavior, search, and accessibility. Offline/download work is deferred.
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
- [x] Refresh expired playback URLs without unnecessarily losing playback position.
  - Change 23 adds bounded music recovery on near-expiry errors/stalls and old-link seeks/resumes, with position/paused-intent preservation. Actual-provider simulation passes; real long-stream/range and phone acceptance remain pending.
- [x] Use an authorized server upload flow or narrowly scoped signed upload URLs; keep privileged storage credentials on the server.
- [x] Remove silent fallback to server-local files in production. Report storage failures instead of claiming a durable upload succeeded.
- [x] Centralize API/media configuration; remove conflicting localhost and deployed-backend fallbacks.
- [ ] Validate upload type using file contents and permitted formats, not just filename and declared MIME type.
  - Music imports now check signatures and parse audio; legacy podcast uploads still need equivalent validation.
- [ ] Set file-size, request, storage, and processing limits appropriate for a personal library.
  - Music imports have upload/request/pending-job/parser limits. Comprehensive storage quotas and retention remain pending.
- [ ] Clean up abandoned uploads, replaced artwork, failed imports, and deleted media safely.
  - Change 22 adds a read-only owner-scoped retention report with reference protection. The configured database currently has five original assets and zero review candidates; permanent cleanup remains pending.
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
  - Likes, saves, follows and listening sessions are implemented in Change 15; durable playback preferences remain pending.
- [x] Introduce playlist items with stable IDs and explicit positions so reordering and repeated tracks have defined behavior.
- [x] Keep music tracks distinct from podcast episodes; define whether mixed playlists are supported.
- [ ] Define deletion behavior for tracks referenced by playlists, likes, downloads, and history.
  - Track soft deletion, retained originals, removable unavailable playlist/saved entries and title snapshots in 180-day history are implemented. New music downloads remain deferred; restore/cleanup remains pending.
- [ ] Add indexes for ownership, artist/album relationships, search, playlist ordering, and listening history.
  - Catalog, playlist ordering, saved-reference uniqueness and listening-history/TTL indexes are defined. Hosted index verification and expanded search indexes remain pending.
- [ ] Move growing listening-history collections out of the user document; avoid unbounded embedded arrays.
- [x] Write a migration plan for existing podcast playlists, media URLs, history, and user records.
  - See `MUSIC_CATALOG.md`; use additive collections and preserve existing podcast IDs/records. No live conversion has been run.
- [ ] Back up existing data and make migration steps repeatable before applying them.

Existing models are podcast-centric: `backend/src/models/Episode.js`, `backend/src/models/Podcast.js`, `backend/src/models/Playlist.js`, and `backend/src/models/User.js`.

## 5. Music import and management — P1

- [x] Support single-file, multi-file, and album/folder imports.
- [x] Support an explicit initial format list, such as MP3, M4A/AAC, FLAC, OGG, and WAV, with conversion for unsupported playback formats where needed.
  - Six input formats and explicit compatible-MP3 processing are implemented. Hosted FFmpeg setup and real codec/browser acceptance remain pending.
- [x] Extract embedded track titles, artists, album names, track/disc numbers, artwork, and duration automatically.
- [x] Provide an editable preview before committing an import.
- [ ] Detect exact duplicates using checksums and offer review for likely metadata duplicates.
  - Exact-file checksums and idempotent confirmation are implemented; likely metadata duplicates remain pending.
- [x] Preserve original files; record any derived playback versions separately.
  - Originals are retained; generated copies use separate assets/source-profile jobs and original/compatible playback choices.
- [x] Run metadata extraction, artwork processing, and audio conversion in background jobs rather than long API requests.
  - Import analysis and optional FFmpeg conversion/thumbnail workers are implemented. Hosted worker/resource checks remain pending.
- [x] Show upload and processing progress, per-file failures, cancellation, and retry.
  - Per-file upload/processing states are shown; byte-percentage upload progress is not implemented.
- [ ] Support resumable/direct uploads where file sizes justify them.
- [ ] Allow metadata correction, album regrouping, artwork replacement, and bulk edits.
  - Metadata correction before confirmation is implemented; library management and bulk editing remain pending.
- [x] Generate appropriately sized artwork thumbnails and provide attractive missing-artwork placeholders.
  - On-demand 320px private thumbnails and existing artwork placeholders are implemented. Additional sizes and hosted/device checks remain follow-ups.
- [ ] Make import jobs retry-safe so retries do not create duplicate tracks or orphan files.
  - Checksum reuse, leases, transactionally confirmed tracks and cleanup of newly uploaded objects on failed asset registration are implemented. Retained/abandoned-file cleanup remains pending.

## 6. Playback correctness — P0/P1

- [x] Fix the progress-saving effect: changes to `currentTime` currently recreate the ten-second interval, which can prevent periodic saves during continuous playback.
- [x] Use stable timers and current refs for progress; save when pausing, switching media, closing the player, and when page lifecycle events permit.
- [x] Save the outgoing track's position before replacing it and avoid associating old progress with a newly selected track.
- [x] Cancel or ignore stale asynchronous requests when the user rapidly selects different tracks.
- [x] Handle authorization/detail request failures explicitly; playback should not accidentally proceed because authorization defaulted to allowed.
- Deferred: a new verified offline music playback path is outside the current plan.
- [ ] Initialize one stable media element and audio graph; clean up listeners and resources correctly.
- [ ] Model loading, buffering, playing, paused, ended, unavailable, and error states explicitly.
- [ ] Handle media errors, interrupted playback, autoplay restrictions, and retry with useful feedback.
- [x] Apply saved seek positions at an appropriate media lifecycle stage and clamp invalid positions.
- [x] Default songs to starting from the beginning; resume podcasts according to saved episode progress.
- [ ] Separate play-start events from meaningful listening events so retries and failed starts do not inflate history or counts.
- [ ] Persist volume, mute, equalizer, playback speed, and other relevant preferences.
- [ ] Test Bluetooth/headphone and audio-device changes; avoid pausing for unrelated device changes.
  - Reported device changes now cancel/pause through the current command path. Reliable identification of removed outputs versus unrelated hardware changes and real-device tests remain pending.

Primary source: `frontend/src/context/PlayerContext.jsx`.

## 7. Queue and music controls — P1

- [x] Add a visible queue with **Play Next**, **Add to Queue**, remove, reorder, and clear actions.
- [x] Distinguish the manually added queue from the remaining album/playlist playback context.
- [x] Support repeated occurrences of a track using queue-item identity rather than track ID alone.
- [x] Add shuffle with a stable order and usable previous-track history.
- [x] Add repeat off, repeat all, and repeat one.
- [x] Define previous-button behavior: restart the current song after a short playback threshold, otherwise go to the previous item.
- [ ] Restore the queue, current item, position, and preferences after reload without unexpected autoplay.
- [x] Make album playback follow disc/track order by default.
  - Complete contexts load across pages, up to 2,000 songs; oversize/changed results fail visibly instead of silently truncating.
- [ ] Provide seek, elapsed/remaining time, volume, mute, like, and playlist actions consistently.
- [ ] Add keyboard shortcuts that respect text fields and accessible focus behavior.
- [ ] Keep podcast speed and sleep-timer controls available without crowding the primary music controls.

## 8. Listening-first interface — P1

- [ ] Open the listening home after login; keep any public landing page separate from the private app.
- [ ] Build a desktop sidebar for Home, Search, Your Library, and playlists.
  - Listen/library/import, global search, music playlists/likes/recently played and secondary podcast tools are implemented. Remaining Home/Search polish is pending.
- [x] Use a persistent bottom player and optional queue/Now Playing side panel on desktop.
  - Compact player plus expanded Now Playing/current-queue dialog, queue editing and shuffle/repeat are implemented.
- [ ] Build mobile Home/Search/Library navigation, a mini-player, and a full-screen Now Playing view.
- [x] Add album, artist, track, liked-songs, playlist, import, and queue views.
  - Songs, albums, artists, imports, queue management, music playlists and liked songs are implemented; hosted device verification remains pending.
- [x] Turn `/library`, currently used for history, into a unified library; give history its own view or filter.
  - Music songs/albums/artists are available at `/library`; episode history moved to `/history`. Music history and saved collections are at `/music/collections`.
- [ ] Use compact track rows with title, artist, album, duration, liked state, download state, and contextual actions.
- [ ] Add Home sections such as Recently Played, Recently Added, Favorite Albums, and Your Playlists.
- [ ] Keep search available throughout the app.
- [x] Replace the custom cursor with standard pointer behavior.
- [ ] Reduce decorative effects that make browsing and playback slower or harder to read.
- [ ] Standardize spacing, typography, colors, artwork proportions, menus, dialogs, and loading states.
- [ ] Unify AetherCast/VOX names, page titles, manifest metadata, icons, and theme colors.
- [ ] Add clear loading, empty, offline, permission, processing, and failure states with relevant actions.
- [ ] Confirm the player never obscures the last list item or mobile navigation.

## 9. Library and playlists — P1

- [ ] Provide views for songs, albums, artists, playlists, downloads, and optional podcasts.
  - Music songs/albums/artists/playlists and optional podcasts are available. Existing downloads remain episode-specific; new music downloads are deferred.
- [ ] Add track likes, album saves, artist follows, and pinned favorites.
  - Likes/saves/follows are implemented; pinned favorites remain pending.
- [ ] Support sorting by title, artist, album, date added, duration, and play count where appropriate.
- [ ] Support playlist creation, renaming, deletion, descriptions, cover artwork, and drag-to-reorder.
  - Creation, renaming, soft deletion, descriptions and button-based reorder are implemented. Playlist artwork and drag gestures remain pending.
- [ ] Support adding tracks from search, albums, the player, and multi-selection.
  - Catalog search/album rows and the player support adding songs; multi-selection remains pending.
- [ ] Define duplicate-track behavior and offer undo for common destructive actions.
  - Repeated tracks have independent entries/positions. Undo remains pending.
- [ ] Add playlist-local search and display track count and total duration.
- [ ] Add playlist import/export in documented formats, with a clear report for unmatched tracks.
- [x] Keep playlists private by default; do not introduce public sharing as a requirement.
- [x] Handle deleted/unavailable tracks gracefully without breaking the entire playlist.

## 10. Search — P1/P2

- [ ] Search tracks, artists, albums, playlists, and optional podcasts with grouped results.
  - Private tracks/artists/albums/music playlists are grouped in Change 16. Optional podcasts retain separate search.
- [x] Search relevant metadata rather than only podcast titles/descriptions.
  - Song/album titles and artist/playlist names are supported; lyrics, relational song matching and richer metadata matching remain follow-ups.
- [ ] Add recent searches, suggestions, useful filters, and a clear-search action.
  - Categories, A–Z/recent sorting, clear and refresh actions are implemented; recent-search storage, suggestions and more filters remain pending.
- [x] Preserve search/filter state in the URL where useful.
- [x] Cancel or ignore stale responses so earlier queries cannot replace newer results.
- [x] Add pagination or incremental loading for large libraries.
- [x] Start with indexed database search; add a dedicated search service only if library size or matching requirements justify it.
  - Owner/name/title/recent ordering indexes and execution bounds are defined. Substring matching may scan owner records; hosted index/query-plan/scale verification remains pending.

## 11. Offline downloads — deferred by owner

Offline/download development is excluded from the active plan and current acceptance criteria as of 2026-11-05. The list below is an archived backlog, not an implementation commitment. Existing episode downloads and private-cache safeguards remain in place. Installed-app/device polish can be considered separately from offline features.

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

- [x] Add Media Session metadata and supported play, pause, seek, previous, and next actions.
  - Music labels/actions/position and immediate cleanup are implemented with API feature detection. OS artwork omits private signed URLs; real-device availability remains unverified.
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
  - Session-level Original/Compatible MP3 playback choice and measured metadata are implemented; more profiles and persistent preferences remain future work. New music downloads remain deferred.
- [x] Add loudness analysis and optional volume normalization with appropriate headroom.
  - Change 24 adds an opt-in measured Normalized MP3 copy with encoded true-peak verification, boost limits and original preservation. Hosted/device acceptance and album-level normalization remain pending.
- [ ] Add gapless playback and configurable crossfade; preserve album transitions and disable crossfade where inappropriate.
  - Change 25 adds bounded next-song response preparation and an Audio toggle. This reduces API lookup latency; true gapless/crossfade remains unimplemented.
- [ ] Improve equalizer preference persistence and provide a clear reset action.
- [x] Add synchronized lyrics from user-supplied or otherwise authorized sources, with a plain-text fallback.
  - Owner-supplied basic LRC/plain text, offset seeking and versioned editing are implemented; external lookup and hosted/device acceptance remain pending.
- [x] Generate simple mixes from local genres, artists, favorites, recency, completion, and skips.
  - Rules use actual sampled listening time rather than completion alone; candidate/sampling bounds and scoring are documented in `MUSIC_PERSONALIZATION.md`.
- [x] Add a setting to exclude unwanted tracks/artists from recommendations.
  - Song and credited-artist exclusions with paginated restore are implemented for local mixes; manual playback is unchanged.
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
- Deferred: new offline-music reload/seeking/quota tests. Continue checking existing session and cache protections when those modules change.
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

Deliver the listening-first desktop/mobile interface, fresh-credential sign-in, online lock-screen controls where supported, and appropriate device testing. Keep podcasts optional. Offline/download development is deferred.

### Milestone 4 — Premium polish

Add normalization, advanced transitions, lyrics, local recommendations, and optional device handoff based on actual daily-use needs.

## First end-to-end acceptance scenario

1. Sign in as the owner; an anonymous visitor cannot browse or play the private library.
2. Import an album and review extracted metadata/artwork.
3. Find it through search and play it in album order.
4. Add and reorder songs in the queue; verify shuffle and repeat.
5. Like a song and add tracks to a private playlist.
6. Close and reopen the app; restore the listening session without unexpected autoplay.
7. Seek and switch songs during online playback, then test interrupted playback and authorized retry.
8. Confirm real listening history/progress records match the selected media as those features are implemented.
9. Verify the same core experience on a phone, including lock-screen controls.

The initial release is complete when this scenario works reliably and the owner's media can be backed up and restored.

## Reference research and implementation planning — 2026-11-05

- **Completed:** Inspect Echo Music, LastWave Native and Velune at pinned main-branch commits, using their READMEs, recursive trees and selected database/network/playback/download/lyrics/recommendation/AI implementations. Record verified source findings and unconfirmed claims in `REFERENCE_RESEARCH.md`.
- **Findings:** Distinguish remote YouTube Music catalogs from local Room metadata, preferences, playback caches and audio downloads. Echo has optional personal-server connectors and real remote AI calls; inspected LastWave mix generation is rules-based. Velune encryption/translation claims are qualified where inspected implementations do not establish them.
- **Plan:** Add `IMPLEMENTATION_PLAN.md` with architecture, phased work, proposed data records, open source/AI/native/offline decisions and acceptance checks. References remain advisory; the owner and implementer retain final decisions. Preserve the existing fresh-credential policy.
- **Validation:** Check local Markdown links, pinned source references and whitespace. No external app was executed, no provider/model account was tested, and no runtime behavior changed in this research batch. Existing interface work in progress is preserved and excluded from this research commit.
- **Recommended next:** Verify the foundation/interface draft, then implement queue occurrence identity, full-album context, editing, shuffle and repeat. Feature checklist items remain pending until implemented and verified.
