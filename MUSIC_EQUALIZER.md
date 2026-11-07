# Browser equalizer preferences

Change 28 exposes the existing three-band Web Audio equalizer in **Now Playing → Audio → Equalizer**. Choose Flat, Music, Bass boost, Voice clarity or Classic podcast, or adjust Bass/Mid/Treble independently between -10 and +10 dB. Editing a band selects Custom. **Reset equalizer** restores Flat and all three bands to 0 dB.

The existing 150 Hz low shelf, 1 kHz mid peak and 8 kHz high shelf remain unchanged. Restored values initialize newly created filters; subsequent edits update attached filters immediately without changing source, queue, position, playback intent or encoded files. A live settings ref preserves rapid consecutive changes and ensures audio initialization sees the latest preference. State updates no longer perform filter writes or nested state changes inside a React updater callback.

Music and the existing podcast controls share this preference. `audio.equalizer.v1` in browser localStorage contains only a preset name and three gains. It contains no account information, credentials, media links, queue or listening history. This is a per-browser audio preference shared across sign-ins on that browser, not cross-device synchronization. It never restores a session, bypasses credentials or starts playback.

Only known presets or Custom with finite in-range gains are accepted. Named presets must match their stored gains. Malformed/oversized JSON, extra fields and unavailable storage fall back to Flat; failed writes leave current in-memory EQ usable. Unknown presets/bands and invalid gains are ignored. Reset persists Flat so a later reload does not restore old custom bands.

## Verification

- All 153 frontend tests pass, including six EQ tests covering preset/custom round trips, invalid/corrupt/blocked storage, gain bounds, rapid band edits and reset isolation.
- Targeted lint has no errors; existing PlayerContext fast-refresh/ref-cleanup warnings remain. The production build passes with its existing bundle-size advisory.
- Audio-filter initialization and live updates were reviewed in the actual PlayerProvider. Browser verification could not start because the computer-use tool failed to initialize, including after reset. No visual, native-decoder, audible EQ, physical-phone or production acceptance is claimed for this batch. Temporary local fixture output was removed by the final production build.

## Acceptance still needed

After frontend deployment, open the music Audio panel, select a preset, change bands, reload and sign in afresh. Confirm the values return before first playback, then test actual audible processing, pause/seek continuity, reset and a second reload on desktop/Android/iOS. Check light/dark themes and keyboard/touch controls. Verify playback remains usable when localStorage is blocked or Web Audio is unavailable; audible EQ requires a functioning browser audio graph. Boosted bands can change headroom; this is the existing tone equalizer, not a limiter or file normalization.

No dependency, backend, environment or database changes are required. Offline work, backup restoration, guarded cleanup and true gapless/crossfade remain open separately.
