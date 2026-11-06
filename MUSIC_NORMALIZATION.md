# Optional measured volume normalization

Change 24 adds an opt-in **Normalized MP3** audio version. Original remains the default and stays intact. This creates a separate 192 kbps, 44.1 kHz stereo copy; it does not improve source fidelity, replace imported audio or require a remote music/AI API.

## Listening workflow

1. Open a song in **Now Playing → Audio**.
2. Choose **Prepare / retry normalized MP3** and wait for the job to become ready. The existing media-preparation button continues to queue only ordinary compatible audio/artwork.
3. Review measured input/output LUFS, decoded output true peak and applied gain, then select **Normalized MP3** under Audio version. Choose **Original** to turn normalization off.

Version switching preserves position and paused intent through the existing player selection path. The session choice also applies to subsequent songs; an unprepared version reports unavailable and requires preparing that song or choosing Original. There is no silent fallback to another version. The choice resets with logout/new page; no account tokens, media URLs or normalization setting are persisted for automatic sign-in.

Jobs support the existing status refresh, explicit failed/cancelled retry and pending cancellation behavior. Cancellation prevents publication but does not immediately terminate an active FFmpeg pass. Silent, unmeasurable, malformed, oversized or peak-unsafe files fail safely and keep their originals. No full-library conversion starts automatically.

## Measurement and gain policy

The fixed profile `mp3-normalized-v1` performs three bounded passes:

1. Decode the original to the profile's stereo/44.1 kHz rendering and use FFmpeg `loudnorm` JSON **input** measurements to determine integrated loudness/true peak. The filter's output is discarded to the null muxer; it is not used as the encoded audio.
2. Apply a constant gain to that same stereo rendering and encode a separate MP3. The gain is the minimum of `6 dB`, `-14 LUFS - measured LUFS`, and `-2 dBTP - measured true peak`. No compressor/limiter, EQ, per-moment gain riding or live Web Audio volume adjustment is added. The 2 dB pre-encode ceiling reserves headroom for lossy encoding.
3. Decode the **encoded MP3** and measure it again. Publish only finite, supported measurements whose decoded true peak is at or below **-1 dBTP**, with parsed duration matching the original within the existing 0.25-second/0.2% tolerance.

The target is a policy choice, not a claim that every file reaches exactly -14 LUFS. Quiet/high-crest-factor files can stay quieter because boosts are capped and peaks take priority. The UI reports actual measured output instead of substituting the target. Measurements describe this rendered audio version; downstream player EQ, user volume and device processing can change playback levels. Album-wide gain and other normalization targets/profiles are not implemented.

FFmpeg measurements are parsed from one bounded JSON block. Reject missing/nonfinite/silence (`-inf`), invalid numeric strings and unsupported ranges. Only numeric, validated values enter the fixed gain filter. The worker independently validates the resulting measurement DTO before storing anything. Ready status, output ID and measurements are published together under the existing job lease/transaction. The original Track.audioAssetId is unchanged. Checksum-deduplicated output assets and retention reporting follow the existing media pipeline.

Reference for the measurement filter and JSON fields: [official FFmpeg loudnorm documentation](https://ffmpeg.org/ffmpeg-filters.html#loudnorm). This profile uses the measured input values and a separate fixed-gain encode; it does not use loudnorm's dynamic/linear normalization output as the deliverable.

## API and storage

| Request | Behavior |
| --- | --- |
| `POST /api/music/tracks/:id/processing` with an empty body | Existing compatible MP3/artwork behavior. |
| Same endpoint with `{"profile":"normalized"}` | Queue/reuse/retry only the owned original audio's normalized profile. Other fields/targets/profiles are rejected. |
| `GET /api/music/tracks/:id/processing` | Include normalized job status and whitelisted ready measurements alongside existing jobs. |
| `GET /api/music/tracks/:id/playback?quality=normalized` | Require matching original checksum, a ready owner/source/profile job, valid measurements and a ready owned MP3 output; otherwise return 409 without falling back. |

Playback returns measured technical metadata and a safe `playback.loudness` object. Measurements are stored on the processing job, which is the authoritative original/profile/output association, rather than modifying a shared original asset. The job model adds the fixed profile and a bounded measurement subdocument. Existing owner/source/profile uniqueness and indexes apply; no old records need rewriting. Expiry-aware renewal uses the same selected version.

## Runtime and deployment

Use the existing Node 22+, private storage, transaction-capable MongoDB and FFmpeg setup. `MUSIC_PROCESSING_ENABLED=true` and `FFMPEG_PATH` retain their current meanings; no new environment variable or package dependency is introduced. FFmpeg needs `loudnorm`, resampling, `volume` and `libmp3lame` support. The existing Docker-based backend remains an option; it is not deployed by this change.

Each pass has a two-minute timeout, fixed local-only input/output/filter arguments, one codec/filter thread, no shell/stdin, bounded stderr and a child environment without service credentials. Existing input limits apply; encoded output is capped at 64 MiB and separately parsed. Up to six minutes of encoder work plus existing I/O/metadata parsing fits within the ten-minute lease budget under configured timeouts. These are per-operation resource bounds, not an OS memory sandbox. Long inputs can time out. Verify capacity on the persistent backend.

Temporary files live in an application-created normalization directory, which is verified and removed on success/failure. Raw stderr, paths and storage credentials are not returned to the app. Uploaded unpublished outputs after a cancellation/publication race retain the existing retention/cleanup policy.

Deploy the updated backend/workers first, then the matching frontend before submitting normalized jobs. Old workers do not recognize the new profile. Hosted job execution, worker restart/cancel, original/normalized comparisons and phone playback still require acceptance testing; no production jobs or media writes were performed during this batch.

## Verification

- **368 backend tests pass**, with all six real FFmpeg tests enabled using the existing ignored local FFmpeg 7.1 binary. New real tests cover loud/quiet generated tones and silence rejection. Other coverage includes parser/range validation, gain/headroom bounds, decoded-output peak rejection, duration/temp cleanup, bounded stderr/no credential environment, schema/DTO validation, explicit profile input, owner/source/output checks and atomic measured publication. Database/storage calls are mocked in unit/integration tests.
- **135 frontend tests pass**, with production build and targeted lint without errors. Existing PlayerContext warnings and the bundle advisory remain. New tests cover honest measured labels, missing/unsafe data and normalized-version renewal identity.
- Browser verification uses the actual PlayerProvider/MusicPlayer/MusicProcessing with a simulated auth/API and **real generated WAV/MP3 files**. Both formats decoded and played muted. Switching retained pause/position; the normalized version was selectable; the preparation action submitted `profile: normalized`; measured values displayed; an unavailable copy showed an error, detached the source attribute and stopped playback without fallback. Original `currentSrc` can temporarily retain the previous resource label after detachment; it is not an active-source fallback. An explicit retry after restored availability played the MP3. The 390px mobile panel had no horizontal overflow and the final preview logged no browser errors.
- A 60-second generated sine measured -5.65 LUFS/-4.93 dBTP before gain and -14.25 LUFS/-13.53 dBTP after MP3 decoding, with -8.35 dB applied. These are fixture results, not analysis of the owner's songs or listening quality on actual phones. All preview audio/code remains in ignored build output and is removed before delivery. No credentials, audio fixtures, encoder binaries, dependency/build directories or live library exports are committed.

Hosted/device acceptance, album normalization, other formats/profiles, gapless/crossfade and guarded permanent cleanup remain pending. Offline/download work remains deferred.
