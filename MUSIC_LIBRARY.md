# Music browsing and playback

The app now opens **My Music** at `/music`. `/home` redirects there too. Use Songs, Albums or Artists to browse confirmed imports; the Import Music screen links back to the collection. Optional podcasts remain available through Podcasts (`/explore`), with the previous podcast home at `/podcasts`. Existing episode playlists/history/downloads remain separate.

## Browse and listen

- Songs show title, artist credits, album, explicit flag, artwork and duration. Search matches song titles; Albums and Artists search their respective names.
- Global/sidebar/mobile Search now opens grouped song, artist, album and private-playlist results. The My Music search field retains its current-category filtering behavior. See [MUSIC_SEARCH.md](MUSIC_SEARCH.md) for matching and pagination.
- Select an album or artist to filter its songs. Albums default to disc/track order; other lists use title order. Filters/search/page are stored in the URL and support browser Back/Forward.
- Songs can also sort by Recently added or Shortest first; a full filtered playback context preserves the selected server order.
- Lists show 50 records per page. Loading, request failure, retry, refresh and empty-library states are provided; outdated navigation responses are ignored.
- Play a song or choose **Play album / Play collection** to load the complete filtered context across pages. Albums follow disc/track order. The queue is bounded at 2,000 songs; larger, denied or changed/partial results show an error rather than silently truncating. Loading a new context is cancellable, and a newer selection/navigation cancels the earlier one.
- The fixed music player provides artwork/credits, play/pause, previous/next, seeking, volume, queue position, album navigation and close controls. Mobile layout keeps transport controls visible.
- Expanded Now Playing includes owner-supplied plain/LRC Lyrics. Your library mix provides explained local recommendations and song/artist exclusions. See [MUSIC_PERSONALIZATION.md](MUSIC_PERSONALIZATION.md) for timing, scoring and limits.
- The Audio panel prepares compatible MP3/artwork jobs when the backend is enabled. Audio version selects the original or a ready compatible copy; actual format/codec/bitrate labels replace the fixed original-audio caption. See [MUSIC_PROCESSING.md](MUSIC_PROCESSING.md).
- Acoustic Silence (light) and Aura Nocturne (dark) share a header/player toggle and Light/Dark/System settings. `/library` opens saved collections; `/music` remains the all-music view. Playlist details use real-track artwork collages and expandable edit controls. See [MOBILE_THEMES.md](MOBILE_THEMES.md).

## Playback rules

The shared player recognizes `kind: track` and obtains a fresh authorized URL from `/api/music/tracks/:id/playback` before streaming. It never falls back to a stale URL when authorization/detail lookup fails. Playback selection retains the existing request counter, so late responses cannot replace a newer selection. Pressing play after an interruption or an old link resolves a fresh URL while retaining the current position when available.

Music starts at normal speed and at zero when selecting a different song. Refreshing the same song's media link preserves its position; naturally finished songs restart at zero. Podcasts retain their existing saved-progress behavior. Queue identity includes media kind to avoid treating a song and podcast with the same ID as the same item.

Music does not call episode play-count/history/progress endpoints or read episode downloads. Episode-specific purchase, AI chat, transcript, bookmark, listening-party and download controls are rendered only by the podcast player. Music has its own likes, playlists and listening history; see [MUSIC_COLLECTIONS.md](MUSIC_COLLECTIONS.md). Logging out clears playback and the queue through the existing player lifecycle.

## Verification and remaining work

Frontend tests cover fresh track authorization, failed/deleted/mismatched tracks without fallback, podcast download/streaming regression, typed queue boundaries, progress-write isolation and initial/retry playback positions. Production build and targeted lint are checked per completion notes. No authenticated live music browser/device session was performed for this batch.

Each queue occurrence has a unique ID, so repeated songs are independent. Play Next inserts immediately after current; Add to Queue follows existing manual next-up entries before remaining collection items. Starting an empty queue with an add action loads a paused song. The expanded queue supports selecting/removing items, moving upcoming items up/down, and keeping only the current song. Queue display is paginated in groups of 100.

Shuffle preserves the current item/manual priorities and remains stable between actions; previous/forward use actual listening history (bounded to 1,000 transitions). Repeat-one restarts only on natural completion; explicit next can advance. Repeat-all wraps; repeat-off stops at the end. Previous restarts the current song after three seconds, otherwise moves to a previous occurrence. Removing current chooses next, then previous, or closes when empty; paused playback remains paused during skip/removal. Failed audio resolution stops that selection with retry/next controls rather than silently substituting another file.

Queues remain in memory across app navigation and clear on logout/page locking. Liked tracks, saved albums, follows, music playlists and history now persist through the owner-scoped backend. Collections is accessible from library links and sidebar actions. Music Media Session controls and explicit failed-refresh position recovery are implemented; physical-device acceptance remains pending. See [MUSIC_DEVICE_CONTROLS.md](MUSIC_DEVICE_CONTROLS.md). Queue/position restoration after fresh sign-in, aggregate listening statistics and seamless mid-stream URL renewal remain pending. Offline/download development is deferred by the owner. Unsupported originals can use the compatible-copy workflow once FFmpeg is enabled; hosted codec/device verification remains pending. Pagination detects count/duplicate/partial changes; it is not a transactional catalog snapshot during concurrent edits.

On 2026-11-05 the owner reported completing the four hosted setup/testing steps from the previous deployment guidance. That report is recorded separately from independent verification. Deploy the latest frontend commit and test a confirmed import in My Music, including play/pause, seeking, next/previous, switching back to podcasts, logout and phone layout.
