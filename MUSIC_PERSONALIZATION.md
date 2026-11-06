# Owner lyrics and library mixes

Change 17 adds lyrics supplied by the owner and recommendations computed from the private music library. No external lyrics/catalog/AI provider, model key, new environment variable or offline/download feature is introduced. Podcast transcripts, AI endpoints and progress remain separate.

## Lyrics

Open the expanded music player and select **Lyrics**. Paste plain text or import a UTF-8 `.txt`/`.lrc` file, choose the format, optionally add a source/note and timing offset, then Save. Selecting a file changes the draft only. Reload saved lyrics discards the draft. Clear saved lyrics requires confirmation and keeps a new empty revision.

Timed LRC supports `[mm:ss]`, `[mm:ss.x]`, `[mm:ss.xx]` and `[mm:ss.xxx]`, including multiple leading timestamps for a repeated line. Lines are sorted stably by time; simultaneous lines highlight together. Empty timed lines display a musical break. Common whole-line metadata tags are ignored. Untimed lyric lines, invalid seconds and embedded `[offset:…]` tags are rejected rather than silently discarded; use the separate offset field. This implements basic line timing, not word-by-word enhanced LRC or automatic alignment.

The active line follows the live player position, including backward/forward seeking. Positive offsets delay lyrics; negative offsets advance them. Clicking a timed line seeks with the same offset, clamped to the song duration. Follow active line is off by default; automatic scrolling also respects reduced-motion preferences. Plain text remains readable without timestamps. Text/source notes are rendered as text, never HTML, and source URLs are not fetched.

Bounds: files up to 100,000 bytes, content up to 50,000 characters/100,000 UTF-8 bytes, 2,000 source lines, 4,000 expanded timed lines, 2,000 characters per timed line, timestamps up to 24 hours, source/note up to 300 characters, offset from −60,000 to +60,000 integer milliseconds.

`TrackLyrics` stores one document per immutable owner/track reference, with a unique owner/track index. All operations first require an active owned track. Track deletion makes its retained lyrics inaccessible through the ordinary API; no automatic media/lyrics destruction is performed.

| API | Contract |
| --- | --- |
| `GET /api/music/tracks/:id/lyrics` | Explicit lyrics DTO: version, content, format, offsetMs, source, parsed lines. No saved record returns empty version 0. |
| `PUT /api/music/tracks/:id/lyrics` | Body: version, content, format (`plain`/`lrc`), offsetMs, source. First save creates version 1; later writes atomically match/increment the supplied version. |
| `DELETE /api/music/tracks/:id/lyrics` | Body: version. Clear content and increment version rather than resetting it. |

Concurrent first saves use the unique index; other conflicts return 409. Reload before saving again; the client does not automatically retry or overwrite the other edit. Track changes/player closure abort pending reads/writes and file-draft updates. A request already accepted by the server can still finish for its original track.

## Explainable recommendations

Open **Your library mix** from the music navigation or `/music/mix`. It returns up to 30 distinct available songs, with Play mix, individual play/queue and exclusion controls. Refresh rebuilds from current server data. Nothing autoplays or saves a new playlist automatically.

The deterministic rule score uses:

- +8 for a liked song; up to +8 for sessions with meaningful listening (at least the smaller of 30 seconds or half the song).
- +3 for artists, +2 for genres shared with likes or meaningful listening. Excluded songs/artists do not seed these preferences.
- +2 when absent from sampled recent history; +1 for songs added within 30 days.
- −3 when played within the last day; quick stopped/skipped sessions subtract up to 6. A reached-end event alone cannot establish meaningful listening.

ID order breaks equal scores. A greedy penalty of 3 per previously selected artist credit encourages variety in the final order; this does not change the displayed underlying rule score. Reasons state the observed positive signals, not confidence, inferred mood or an AI claim. New libraries fall back to honest availability/recency-based results; empty libraries show an empty state.

The server requires active owner tracks with ready owned audio, reads up to 1,000 sessions within 180 days, and uses current likes and exclusions. This version explicitly rejects more than 2,000 active songs or 5,000 exclusions instead of silently sampling part of the catalog. Candidate/signal queries have two-second MongoDB execution bounds. Signal reads are not a transactional snapshot and results are not a guarantee of musical preference. History remains the existing best-effort client-reported data; no extra tracking is introduced.

Exclude a song or any displayed credited artist. Exclusions override likes/history and affect only this mix; normal library, playlist and manual playback remain available. Restore exclusions in the paginated section, including entries whose original reference is now unavailable. Exclusion management can still load if mix generation fails.

| API under `/api/music/library` | Contract |
| --- | --- |
| `GET /recommendations` | No query fields; safe track DTOs with rule scores/reasons and sampling counts/method. |
| `GET /recommendations/exclusions?page=1&limit=25` | Owned paginated labels/entry IDs; maximum 100 per page. |
| `PUT /recommendations/exclusions/:resource/:id` | Empty body; resource `tracks` or `artists`; active owned reference required; idempotent insertion. |
| `DELETE /recommendations/exclusions/:id` | Empty body; remove by owned exclusion entry ID, including unavailable references. |

`MusicExclusion` is a separate collection with immutable owner/kind/reference and a unique compound index. This avoids growing preference arrays inside User. Private API authorization, DTO privacy and current-credential sign-in continue unchanged. No library/history/lyrics are sent to a model or other new provider.

## Verification and rollout

Local checks: 292 backend tests, 94 frontend tests, production build and targeted lint pass. Tests cover lyrics schemas/parsing/limits, ownership/version conflicts/clear behavior, timing offsets/seeks, file validation, deterministic ranking, cold starts, meaningful listening, diversity, exclusions, safe DTOs and guest/non-owner HTTP denial. Controller database operations are mocked. Browser media timing, visual layout, hosted concurrency and actual MongoDB indexes remain unverified.

Deploy matching frontend/backend versions and verify unique owner/track lyrics and owner/kind/reference exclusion indexes plus exclusion pagination ordering. No data migration or new service configuration is required. Hosted acceptance: save plain/Unicode/LRC lyrics, reload/sign in again, seek with positive/negative offsets, change tracks while loading, edit in two tabs, clear/re-add, test phone/keyboard/reduced-motion behavior, and play a real mix before/after likes/history/exclusions. Verify ready/deleted media, restore exclusions, guest denial and logout. Backups should include these new collections.

Automatic lyrics retrieval/alignment, external AI, user-adjustable scoring, aggregate statistics, larger-library recommendations and real-device checks remain follow-ups. Offline development remains deferred. Next planned phase is online mobile playback/Media Session controls.
