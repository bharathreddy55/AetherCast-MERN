# Next-song preparation

Change 25 adds **Now Playing → Audio → Song transitions → Prepare next song**. It defaults on; the browser stores only this on/off preference. It can reduce playback API latency between songs. It does not provide true gapless playback, crossfade, speculative audio downloads or offline listening.

For healthy playing music at least 30 seconds long, the player looks up the natural next queue occurrence during the last 15 seconds. Current audio and queue remain untouched. At natural completion, the same owner/session, quality, source request and exact next occurrence must still match before consuming the response once. Shuffle, repeat and manual queue priority use existing queue rules. Manual selection uses the ordinary lookup path.

One response lives only in memory. Preparation has a 15-second deadline, is usable for less than 30 seconds from request start and must retain at least 60 seconds of reported link lifetime. Missing lifetime, stale/malformed responses, incorrect quality and speculative failures fall back to an ordinary lookup. Pause, seek, buffering and errors cancel preparation; logout, page exit, player close and manual selection reset it. Repeated updates do not retry the same cancelled attempt; ordinary playback remains available. Turning the setting off discards pending work.

This briefly reuses an authenticated, already-issued media capability; it does **not** recheck the backend profile/catalog at the exact handoff. Revocation or catalog changes after preparation may be observed on a later lookup. Signed media delivery still enforces server-side capability checks. Credentials and prepared URLs are not persisted, no new page is authorized, and the fresh-credential login policy remains unchanged.

## Validation and limits

- All 147 frontend tests pass, including 12 preparation tests for identity/quality/occurrence fences, cancellation, expiry, bounded ignored aborts, failures and final media-boundary handling.
- Local actual PlayerProvider/MusicPlayer browser verification used generated muted PCM samples with simulated auth/API. Uninterrupted natural completion reused preparation: lookup count stayed at five as the second sample started and completion/start events advanced. Disabling preparation prevented speculative lookup. Locking with a pending response cleared selection/source; releasing it later did not restart playback. No browser console errors were observed.
- Jumping to the final instant caused buffering and a fresh-lookup fallback as designed. Reduced latency is best effort.
- Targeted lint and production build pass with existing context warnings and bundle-size advice. No backend, dependency, environment or migration change is required.

Hosted storage/range/expiry behavior, long streams and physical phone/background acceptance remain pending. The single media element changes source after completion, so network and decoding gaps remain possible. True gapless playback and configurable crossfade remain open Phase 6 work requiring further audio-engine evaluation. Offline work stays deferred.
