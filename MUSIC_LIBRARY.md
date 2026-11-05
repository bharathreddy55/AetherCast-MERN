# Music browsing and playback

The app now opens **My Music** at `/music`. `/home` redirects there too. Use Songs, Albums or Artists to browse confirmed imports; the Import Music screen links back to the collection. Optional podcasts remain available through Podcasts (`/explore`), with the previous podcast home at `/podcasts`. Existing episode playlists/history/downloads remain separate.

## Browse and listen

- Songs show title, artist credits, album, explicit flag, artwork and duration. Search matches song titles; Albums and Artists search their respective names.
- Select an album or artist to filter its songs. Albums default to disc/track order; other lists use title order. Filters/search/page are stored in the URL and support browser Back/Forward.
- Lists show 50 records per page. Loading, request failure, retry, refresh and empty-library states are provided; outdated navigation responses are ignored.
- Play a song or choose **Play these N songs** to create an ordered queue from the current page. The queue remains while navigating. Previous/next and natural completion move within this queue; playback stops at the last song. Albums larger than 50 tracks currently require selecting the next page manually.
- The fixed music player provides artwork/credits, play/pause, previous/next, seeking, volume, queue position, album navigation and close controls. Mobile layout keeps transport controls visible.

## Playback rules

The shared player recognizes `kind: track` and obtains a fresh authorized URL from `/api/music/tracks/:id/playback` before streaming. It never falls back to a stale URL when authorization/detail lookup fails. Playback selection retains the existing request counter, so late responses cannot replace a newer selection. Pressing play after an interruption or an old link resolves a fresh URL while retaining the current position when available.

Music starts at normal speed and at zero when selecting a different song. Refreshing the same song's media link preserves its position; naturally finished songs restart at zero. Podcasts retain their existing saved-progress behavior. Queue identity includes media kind to avoid treating a song and podcast with the same ID as the same item.

Music does not call episode play-count/history/progress endpoints or read episode downloads. Episode-specific purchase, AI chat, transcript, bookmark, listening-party, like and download controls are rendered only by the podcast player. Music likes/history/downloads and playlists remain future work. Logging out clears playback and the queue through the existing player lifecycle.

## Verification and remaining work

Frontend tests cover fresh track authorization, failed/deleted/mismatched tracks without fallback, podcast download/streaming regression, typed queue boundaries, progress-write isolation and initial/retry playback positions. Production build and targeted lint are checked per completion notes. No authenticated live music browser/device session was performed for this batch.

Full-library queues, duplicate queue-item identity, reorder/add/remove, shuffle/repeat, liked tracks, saved albums, follows, music playlists, offline music, Media Session controls and seamless mid-stream URL renewal remain pending. Unsupported browser codecs still need the planned transcoding workflow.

On 2026-11-05 the owner reported completing the four hosted setup/testing steps from the previous deployment guidance. That report is recorded separately from independent verification. Deploy the latest frontend commit and test a confirmed import in My Music, including play/pause, seeking, next/previous, switching back to podcasts, logout and phone layout.
