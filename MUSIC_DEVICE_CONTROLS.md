# Online music device controls

Change 18 adds a feature-detected Media Session bridge to the existing music player. Supported browser/device media surfaces can show song, artist and album labels and send play, pause, stop, next, previous and seek commands. Actual availability varies; [action handlers](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler) and [position reporting](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setPositionState) require independent support checks. No native-app parity or tested Android/iOS background-playback guarantee is claimed.

## Behavior and privacy

- Device actions use the current attached owner/music identity and live queue. Next/previous follow the existing shuffle/repeat rules and boundaries. Previous restarts after three seconds; manual next does not force autoplay on a paused queue.
- Play and Pause are separate, idempotent commands. Repeated play commands share a pending attempt instead of toggling playback. Stop closes the player/queue. Absolute/relative seeking validates finite inputs, defaults relative jumps to ten seconds and clamps to the loaded duration without starting playback.
- Metadata contains title, credited artist names and album title only. No account identifiers, tokens, raw audio locations or private signed audio/artwork URLs are sent to Media Session. OS artwork is intentionally empty; album artwork remains inside the app. Labels can be visible on the device's media surfaces while signed in. Clearing app metadata does not promise erasure of browser/OS caches.
- Publish finite duration/rate/position after metadata loads, seek/rate/duration changes and normal player updates. Unknown durations clear position state. Paused, ended, buffering and errored media do not advertise ongoing playback. Unsupported actions/setters fail independently without stopping app playback.
- Loading a new authorized media link clears obsolete OS metadata and resume/seek controls. Authorized Pause/Stop callbacks can still cancel a pending music selection; retained Play callbacks cannot start an unresolved or locked session. Switching to podcasts clears the custom music session; podcast behavior keeps its existing player/progress path.
- Logout/page hide immediately blocks commands, cancels pending source/play attempts, pauses and detaches the media source and clears OS metadata/handlers/position. Provider cleanup also disposes the bridge. Saved callbacks check current eligibility again before acting. Existing fresh-credential login remains required on a new page/tab or back-cache restore.

## Interruption and retry

The existing detached video media element now requests inline playback and metadata preloading. This is a browser hint, not a background service. Visibility changes save existing progress without automatically stopping a running authorized session; a true `pagehide` locks it under the existing security policy. OS/browser suspension, navigation, memory pressure or authentication expiry can still stop playback.

Media-link resolution has a 15-second cancellation timeout. A newer selection, explicit pause/stop or page lock aborts the old request and invalidates its result. No denied or failed source falls back to an old URL, and reconnection does not trigger automatic playback or a retry loop.

For a failed music refresh, preserve the intended position in an owner/track/occurrence-scoped memory checkpoint so an explicit Play retry can resolve a fresh authorized link and seek back after metadata loads. Repeated queue entries and different songs restart normally. Closing, logout/page locking and a new selection discard the old retry checkpoint. It contains IDs/position only and is never persisted as authentication, a queue restore or offline state. Browser autoplay rejection remains an explicit Play-to-retry error.

Where `devicechange` events are available, conservatively pause/cancel playback on a reported device change. This event does not reliably identify a removed headset and can represent other hardware changes. The app does not request microphone permissions or resume when a device reconnects. Device-specific interruption policies still require real hardware testing.

## Verification and rollout

Local verification: 108 frontend tests pass, including Media Session metadata/privacy, command routing, pending cancellation, queue boundaries, seek validation, unsupported APIs, paused/buffered state, logout/podcast cleanup, disposal, recovery checkpoints, duplicate play attempts and stale rejection handling. Production build and targeted lint pass with no errors; existing PlayerContext fast-refresh/ref-cleanup warnings and the bundle-size advisory remain. Backend source is unchanged; its previous 292 passing tests remain the latest backend verification.

Tests use simulated browser/media APIs. They do not establish lock-screen UI availability, Bluetooth behavior, native interruptions, background longevity, media decoding or network recovery on phones. No authenticated live browser/device or production deployment was verified in this batch. Deploy the frontend; no new environment variables, backend routes, database indexes or provider keys are required.

Record actual browser/OS versions and outcomes when running these acceptance checks on desktop and Android/iOS:

1. Sign in with current credentials and play an imported song. Inspect title/artist/album and available device buttons. Confirm labels update on a repeated occurrence, queue change and album transition.
2. Exercise device Play/Pause repeatedly, Stop, next/previous, each repeat mode and supported absolute/relative seeks. Confirm queue boundaries and paused intent match the app.
3. Lock/unlock the screen, switch apps and return; test a wired/Bluetooth device change, reconnect and a real interruption. Record what the browser actually supports rather than marking unsupported buttons as broken app features.
4. Interrupt connectivity/expire a media link, retry after reconnecting and confirm position recovery without stale-URL fallback. Pause/stop/logout during a slow lookup and verify no late autoplay. Check blocked autoplay recovery.
5. Switch to podcasts, close the player and log out. Old music metadata/actions must be cleared; retained device commands must not restart audio. A reload/new tab requires credentials again.

Offline launch/downloads, queue restoration after a new sign-in, automatic reconnect playback, seamless mid-stream URL renewal, wake locks and native background services remain outside this batch. Next planned phase is media processing/artwork/audio-format quality, while hosted/device acceptance remains open.

## Change 23 — Expiry-aware recovery

Music now requests a fresh authorized source automatically for eligible near-expiry errors/stalls and on old-link seeking/resume, preserving the occurrence, position, quality and paused intent. Pending recovery can be cancelled, and logout/lock clears it. See [MUSIC_STREAMING.md](MUSIC_STREAMING.md) for bounded retries, actual-provider simulation evidence and remaining physical-device/hosted tests. This does not establish seamless or uninterrupted background playback on phones.
