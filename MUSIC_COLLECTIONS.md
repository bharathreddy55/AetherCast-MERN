# Personal music collections

Music collections live at `/music/collections`: Playlists, Liked songs, Recently played, Saved albums and Followed artists. They use MongoDB and the existing owner-authorized API. They survive a new sign-in; each new page visit still requires current credentials. Podcast collections remain separate. No new offline/download feature is included.

## Everyday actions

Like a song or add it to a playlist from All Music or the player. Save albums and follow artists from their catalog cards. Create a playlist in Collections, then add songs through their playlist buttons. Playlist details support names, descriptions, deletion, removal and move-up/down controls suitable for touch and keyboard use. Repeated songs have separate entry IDs, and selecting the second copy starts that occurrence.

Playlists hold at most 2,000 entries. Playing a playlist loads its available entries in order and reports skipped unavailable entries. Deleted tracks remain as removable placeholders; likes, saves and follows can also be removed when their underlying record is unavailable. Original media is retained by the existing soft-deletion policy. Playlist deletion is soft deletion and keeps the songs.

Playlist changes require the displayed `version`. A conflicting change returns HTTP 409; refresh before editing again. Additions are never automatically retried. Refresh or revisit collections to see changes from another device; no real-time cross-device subscription is implemented. Saved-state controls also refresh on window focus.

## Data and API

All paths below start with `/api/music/library` and require the existing verified owner token. The server derives owner identity, validates references and uses explicit response DTOs without storage locations or credentials.

| Path | Methods / purpose |
| --- | --- |
| `/state?trackIds=…&albumIds=…&artistIds=…` | GET saved IDs for up to 100 visible references of each kind |
| `/likes`, `/saved/albums`, `/followed/artists` | GET paginated entries; default 25, maximum 100 per page |
| The above paths plus `/:id` | PUT idempotent save; DELETE remove by reference |
| The above paths plus `/entries/:id` | DELETE owned saved row, including an unavailable reference |
| `/playlists` | GET paginated summaries; POST name/description |
| `/playlists/:id` | GET details; PATCH versioned rename/add/remove/reorder; DELETE with version |
| `/events/:playbackId` | PUT trackId, type, position and playedSeconds for one playback UUID |
| `/history` | GET paginated listening sessions |

`TrackLike`, `SavedAlbum` and `FollowedArtist` each have a unique owner/reference index. `MusicPlaylist` stores bounded ordered item subdocuments with stable IDs. Unlike the initial separate-item collection proposal, a version-checked update changes the entire order atomically in one document, avoiding a transaction across playlist rows. Positions are derived from array order. Add operations accept at most 100 tracks; reorder must provide the complete exact permutation of entry IDs. No existing podcast records are migrated.

`ListeningEvent` stores one session per owner/playback UUID with a title snapshot, server timestamps, outcome and elapsed listening seconds. A unique owner/playback index prevents duplicate sessions; a TTL index expires sessions after 180 days (MongoDB cleanup is asynchronous). History sorting has an owner/start-time index.

## Listening semantics and limits

The browser creates a start only after the media element emits `playing`. Loading a song, queuing it or a failed start does not count. Wall-clock time accumulates only during actual playing intervals; pauses and reported buffering are excluded, and seeking forward does not add the skipped audio time. Switching/closing records stopped/skipped; natural end records completion. Repeats and repeated queue occurrences get distinct UUIDs; media-link refresh retains the current session.

Starts and terminal updates are idempotent, serialized by the player and bounded by song duration. A late start cannot reopen a completed session, and a late skip cannot downgrade completion. “Reached the end” does not claim that every second was heard. These are private client-reported listening records, not independently verified playback statistics. Aggregate statistics, periodic music checkpoints and recommendation scoring remain future work.

History writes are best effort. Failures do not block playback; page-hide/logout use captured owner credentials and `keepalive` for the final event. Browser termination, network failure or an expired token can prevent delivery. No durable retry queue is added; a session can remain “Started” if its final update is lost. No music events are sent to episode progress/history APIs.

## Rollout and verification

Deploy the backend and frontend together. No new environment variables or external provider keys are required. Verify the new collections/indexes in the hosted database, particularly unique owner/reference and playback indexes and the history TTL index. Existing Node 22+, private storage and persistent backend requirements continue to apply.

Local verification: 220 backend tests, 86 frontend tests and the production frontend build pass. Coverage includes ownership/guest denial, strict input bounds, stale versions, repeated entries, missing references, retention schema, listening identity, pause/buffering accounting, failed writes and credential-safe requests. Database operations are mocked in controller tests; schema tests do not establish hosted index creation or concurrent database behavior.

Hosted acceptance remains pending: like/save/follow and re-login on another device; create a repeated-track playlist and select/reorder each occurrence; make conflicting edits in two tabs; soft-delete a track and remove its placeholder; play/pause/seek/skip/end a real file and inspect history; verify guest denial, logout and phone layout. No live deployment, authenticated browser or real-device playback was verified in this batch.
