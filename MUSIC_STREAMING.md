# Expiry-aware music playback recovery

Change 23 adds automatic recovery for interrupted private music links while preserving song/queue identity, audio quality and playback intent. The player uses the existing authenticated playback API; no backend token lifetime, authorization rule, storage policy or offline behavior changes.

## Listening behavior

- A healthy stream continues on its attached source. There is no periodic source reload that would interrupt an otherwise working song.
- If an attached music link is expired or within its last minute and the browser reports a network/unsupported-source media error, request a fresh authorized link automatically when the listener intended playback to continue.
- For `waiting`/`stalled`, wait eight seconds, then renew only if playback still intends to continue, the element is not paused/ended, and the source/request/owner/queue occurrence/quality match with no meaningful position advance. Progress or a new `playing` event prevents an unnecessary recovery.
- Seeking on an old link refreshes it at the requested position. A paused song remains paused. Play on an old paused link also resolves a fresh authorized source before playback.
- Show **Reconnecting…** in the mini/expanded player. The main transport becomes **Cancel reconnecting** while renewal is pending. Seeking is disabled during that pending request. Pause/cancel, another selection, close, device-change pause, page locking or logout cancel pending work; old responses cannot replace the current selection or resume playback.
- Preserve the last known position if a media error resets the element's position to zero. Keep the current queue occurrence and listening event across same-song refreshes, and retain the selected Original/Compatible quality. Explicit Next/Previous, active-item removal and quality changes during reconnection use listener intent rather than the error-paused media element.

Source replacement can involve an audible buffering gap. Browser autoplay restrictions, suspending background tabs, unsupported codecs and actual connectivity failures can still require a manual Play. This is bounded automatic recovery, not a guarantee of gapless/seamless playback or uninterrupted background playback on every phone.

## Data and request boundaries

`resolvePlayerMedia` returns the authenticated response's `expiresIn` separately from the track metadata. Accept only integer lifetimes of 1–86,400 seconds, derive an in-memory advisory deadline from request start time, and reserve one minute of headroom when recovery/seek/resume needs a new source. The current backend returns 900 seconds. Missing/invalid lifetime metadata disables expiry-based automatic recovery; the existing manual/error retry and legacy twelve-minute paused-source check remain available. No JWT is decoded by the frontend, and the server still authorizes every lookup/media request.

The coordinator in `frontend/src/lib/musicLinkRenewal.js` reads current provider refs. It requires an allowed current-owner music source, ready media, the selected quality and the current queue occurrence. Podcast and blob/download sources are excluded. Decode/abort media errors are not treated as expired-link signals. It uses at most two automatic attempts per occurrence/quality in a rolling ten-minute window, with a one-minute cooldown. Explicit user seeks/retries remain available and do not create an automatic retry loop. Duplicate interruption events share a pending recovery.

Renewal calls the existing `playEpisode` selection path with an explicit position and paused intent. This retains the 15-second request timeout, AbortController, selection revision checks, credential-gated `apiFetch`, current-quality playback endpoint, metadata-time seek clamping and listening-tracker identity. Source URLs and deadlines remain in memory. Queue order, liked state and original media references are not changed by renewal.

If the playback API denies access, the track is unavailable, or the lookup fails/times out, clear the old music source and show the failure. There is no fallback to the expired URL, a public object or a music cache. A later explicit Play must complete another authorized lookup. Existing fresh-credential sign-in and owner-only backend checks remain in force.

## Verification

- All **132 frontend tests** pass. New coverage exercises expiry bounds/headroom, error position recovery, fresh-vs-old sources, unsupported/decode/abort cases, stalls/progress, source/request/owner/queue/quality changes, paused seeks, cooldown/window limits, duplicate events, stale rejection/cancellation and overlapping promise completion. Existing authorization, listening identity, queue and media-session checks remain passing.
- Production build and targeted lint have no errors. Existing PlayerContext fast-refresh/ref-cleanup warnings and the bundle-size advisory remain.
- Browser verification mounted the **actual PlayerProvider and MusicPlayer** with an isolated simulated auth/API/media element in ignored build output. Short-lived sample links and controlled errors exercised provider integration without real credentials, production requests or library writes. A sample recovered from source 1 to source 2 at 45 seconds, still playing, with the same queue occurrence and a single listening-start event. Paused seek to 75 seconds stayed paused; quality switching preserved position/pause. Cancellation suppressed a deliberately late response; denied renewal cleared the source and an explicit retry restored position. Next during pending renewal played the new song and ignored the old response. Lock/logout cleared all media/queue state and ignored a late response. The final review logged no browser errors.
- The simulation is not a real decoder, range server, expired production capability, network interruption or physical-device test. Preview files were removed by the final production build and are not shipped. Backend source is unchanged.

## Hosted/device acceptance still needed

Deploy the frontend and verify real Original/Compatible streams across the 15-minute link lifetime, then seek/resume and test actual expired range requests. Exercise network loss, revoked authorization, long pauses, rapid selection, device changes and iOS/Android background/lock-screen behavior. Confirm positions, pause intent, queue occurrence, quality and listening history, and check that denial never reuses old links. Budgeted retries can deliberately stop and leave manual Play available. No claim of successful hosted playback or deployment is made by local simulation.

Remaining Phase 6 work includes physical-storage/alias review and guarded permanent cleanup, loudness/normalization, more artwork sizes and gapless/crossfade evaluation. Offline/download work remains deferred.
