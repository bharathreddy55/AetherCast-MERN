# Matching song covers

Change 21 implements the owner's request to use the actual song/release covers for both the nine-song “mood on” screenshot and imported music. No generated illustration, genre stock picture, video screenshot or artist portrait is substituted for a song cover.

## The nine reference covers

On 2026-11-06 the official Spotify oEmbed responses supplied the release titles and 300px cover URLs below. All nine images were downloaded **only to a temporary review directory**, inspected visually against the owner's screenshot, and loaded successfully in a local mobile component preview in both themes. The app ships the pinned metadata/URL references, not copied audio or a Spotify playback integration.

| Song/version | Credited artist used for matching | Verified cover source |
| --- | --- | --- |
| Veezha Veera — Tamil | Sai Abhyankkar | [Tamil single](https://open.spotify.com/album/7hb3ZpMxjygpt1PQDXsqZK) |
| Illuminati — Aavesham | Sushin Shyam | [Track/release](https://open.spotify.com/track/1a1xLj9W8libnO9PvJf6ao) |
| Kiliye Kiliye — Afrobeat Mix | The Independeners | [Afrobeat Mix](https://open.spotify.com/track/6Or4iU4UNhDftBYfRXh7xr) |
| Pathikichu — Vidaamuyarchi | Yogi Sekar or Anirudh Ravichander | [Single](https://open.spotify.com/track/28rtWBDUGP8JLEuJ57cwdv) |
| God Mode — Hyper Pop | Sai Abhyankkar | [Karuppu Side B original score](https://open.spotify.com/album/31X5UjAhTDsTJW141eYLhd) |
| Raga of Revenge — DC | Anirudh Ravichander | [Single](https://open.spotify.com/track/4cVgfaHzVDu3srYfJEP0AN) |
| Aura 10/10 — Meesaya Murukku 2 | Hiphop Tamizha | [Single](https://open.spotify.com/album/10G1oV4Z4LxJ6mewXm46HM) |
| Hukum Reloaded — Tamil, Jailer 2 | Anirudh Ravichander | [Tamil single](https://open.spotify.com/track/57IV0hLaFBsJItvjSLu601) |
| Basinga Balaalu | Swamy Naresh | [Track/release](https://open.spotify.com/track/5aAm4h5bLg4hV5wQAi5MGx) |

The manifest is `backend/src/data/verifiedSongArtwork.json`. Matching requires an explicitly listed title and primary credited artist. Populated album metadata must match a listed release; supplied language cannot conflict with Tamil-only entries. Only case, spacing, curly quotes and dash typography are normalized. Remixes, similar titles, different films and languages are not fuzzy-matched. A plain “Veezha Veera” without its Tamil version label is intentionally left unmatched. Correct its import metadata before expecting this reference cover.

The catalog DTO uses the ready private track cover first, then the ready private linked-album cover, then a verified reference. This also covers search, saved tracks, playlist songs, mixes and playback because they use the same DTO. Album/artist cards do not borrow a random song cover. Unknown songs and failed image loads retain the existing music-note placeholder. A reference entry does not create a song or playable audio.

Pinned remote images are loaded from Spotify's public artwork CDN, without an owner bearer token or page referrer. The source link appears in **Now Playing → Audio → Song cover**. There is no runtime search request, API key, Spotify SDK, audio preview, scraping job or new offline cache. These remote references depend on CDN availability; imported private images still use the existing signed media delivery. Remote source URLs are fixed in code and cannot be supplied through the artwork recovery API.

## Embedded covers for imported songs

New imports select a single explicitly tagged front cover, even when a back cover appears first in the file. A sole untyped image is accepted. Artist portraits, back covers, booklet/disc pictures, multiple untyped pictures and multiple front-cover candidates are skipped instead of guessed. JPEG/PNG signatures/dimensions and a 5 MB limit are checked before storage. Existing 8192px/16-million-pixel bounds apply. Original audio bytes and metadata are preserved. File tags can themselves be wrong; this is a source-based rule, not visual recognition of the recording.

For an existing song without its own cover, open **Now Playing → Audio → Find embedded front cover**. The owner-only `POST /api/music/tracks/:id/artwork/recover` accepts an empty body and no query parameters. It reads the owned ready original under the configured import size limit, checks length/SHA-256 against its stored fingerprint, runs the bounded metadata worker, and saves the selected embedded picture into existing private media storage. It needs no FFmpeg encoder or new configuration.

Publication uses an owner/source/active-track/no-existing-cover compare-and-set. An existing track cover, concurrent cover edit or deleted track is never overwritten. Missing/ambiguous covers return 422 with an honest message; backend failures return a generic 503. Only one scan per owner runs in a process, with six requests/minute per rate-limit key. Existing deployment-wide worker/resource limits still apply across replicas. New assets use checksum deduplication. A lost publication race may retain an unreferenced asset for the already-pending safe cleanup phase; it never deletes an existing object.

After a successful scan, refresh the library and reselect the song. The player does not restart audio automatically or alter the queue while recovering artwork. This action does not replace an existing wrong cover; owner-reviewed replacement is a follow-up. There is no automatic internet search for other unidentified library songs.

## Verification and rollout

- Backend: 336 tests pass, three optional real-FFmpeg tests skipped; all 26 suites pass. Focused matching tests also pass after tightening primary-artist matching.
- Coverage includes all nine mappings, wrong artists/releases/languages/remixes, private-cover precedence, front-vs-back selection, ambiguous/invalid images, a **real metadata-worker tagged WAV** containing both back/front pictures, owned original/checksum rules, no-overwrite races, concurrent-scan admission, safe errors and anonymous route denial. Database/storage recovery calls are mocked.
- Frontend: all 114 existing tests, production build and targeted component lint pass. Existing bundle-size advisory remains.
- Browser: actual artwork/recovery components in an isolated fixture, all nine real images loaded at 300px, no-referrer image attributes, light/dark presentation, 390px width (385px page content) and simulated recovery success/missing-cover states. Fixture code remains in ignored build output and is removed before delivery. No authentication bypass is shipped.
- Deploy both backend and frontend to activate the DTO fallback and recovery UI. No database migration or environment variable is added. The live owner's catalog, authenticated recovery/storage write, physical phones and deployed behavior remain unverified; no claim is made that private production records were changed.
- Remaining Phase 6 retention/cleanup, long-stream renewal and audio-quality work retain their prior status. Offline/download work remains deferred.
