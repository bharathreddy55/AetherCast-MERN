# Private media processing

Change 19 implements the conversion/thumbnail core of Phase 6. Originals remain intact. Change 23 adds bounded expiry-aware music-link recovery; see [MUSIC_STREAMING.md](MUSIC_STREAMING.md). Real long-stream/seamless behavior, normalization, gapless/crossfade, permanent retained-object cleanup and hosted/device acceptance remain unfinished.

## Player workflow

Open an imported song's expanded player and select **Audio**, then **Prepare / retry media**. This queues a compatible MP3 and, when song/album artwork exists, a 320px thumbnail. Jobs are explicit; existing imports are not automatically re-encoded. The panel refreshes every ten seconds while work is queued/processing. Closing/changing track/logout stops polling. Cancel prevents publication but does not immediately terminate an encoder already running. Failed/cancelled jobs can be retried.

Once ready, choose **Compatible MP3** under Now Playing's Audio version selector. Original is the default. Selecting a missing compatible copy returns a visible 409 instead of silently falling back. Switching preserves position and paused/playing intent through existing playback safeguards. The session's choice applies to subsequent songs until changed and resets on logout. Refresh the catalog after thumbnails finish; cards/rows use thumbnails and expanded artwork can use the separately signed original.

The caption shows the selected asset's measured format, codec, bitrate and sample rate where known. The compatible profile targets MP3 at 192 kbps, 44.1 kHz stereo. Re-encoding can reduce quality and does not improve a lossy source. This adds no offline/download feature.

## Backend setup

The persistent backend needs Node 22+, private storage, MongoDB replica-set transactions and an FFmpeg build supporting `libmp3lame`, JPEG/PNG and scaling. Existing import/database/storage requirements still apply.

| Backend environment variable | Meaning |
| --- | --- |
| `MUSIC_PROCESSING_ENABLED=true` | Enable new submissions and the worker. Disabled by default; only exact `true` enables it. |
| `FFMPEG_PATH` | Executable path; defaults to `ffmpeg` on PATH. The Docker image uses `/usr/bin/ffmpeg`. |

The enabled flag reflects configuration, not a successful binary/readiness probe. Missing FFmpeg or storage failures produce failed jobs with a retry action. Original playback and imports continue when processing is disabled. Keep the native encoder updated independently of Node packages.

`backend/Dockerfile` installs FFmpeg on Node 22 Debian, runs `npm ci --omit=dev`, excludes secrets/dependencies/uploads from its context and runs as the Node user. On Render, configure a Docker backend with root directory `backend` and Dockerfile `Dockerfile`, retaining existing backend environment values and the intended frontend API URL. This change does not switch or deploy your Render service automatically. A native service can instead provision a maintained executable and set its path; setting the flag alone does not install FFmpeg.

Deploy matching frontend/backend versions. Verify MediaProcessingJob's unique owner/source/profile and queue/lease indexes and the new MediaAsset thumbnail reference. Transaction-capable MongoDB is required for atomic readiness/thumbnail publication. No podcast migration is needed. Include jobs, generated assets and private objects in backups.

## API and data

| Endpoint | Contract |
| --- | --- |
| `GET /api/music/tracks/:id/processing` | Active owned track, configuration flag and bounded safe job summaries; no object locations or lease tokens. |
| `POST /api/music/tracks/:id/processing` | Empty body/no query fields. Validate owned ready sources; queue/reuse profiles or retry failed/cancelled jobs. Audio/artwork submissions are independent; refresh after partial failure. |
| `DELETE /api/music/processing/:id` | Empty body; cancel only owned queued/processing jobs. Finished jobs remain finished. |
| `GET /api/music/tracks/:id/playback?quality=original` | Original by default; `compatible` requires a ready job for the current source checksum and a ready owned MP3 output. No arbitrary quality/encoder options. |

Tracks retain their original audio reference. Playback returns fresh authorized links plus explicit metadata for the selected asset. New generated objects use `music-derived-audio`/`music-thumbnails`; original uploads retain their existing folders. Checksum deduplication may reuse owned byte-identical media without modifying it. New derivative assets retain `originalAssetId`; the processing job is the authoritative source/profile/output association. Catalog artwork population scopes both originals and thumbnail references to ready owned images. Full artwork remains separately signed; private media delivery and URL expiry remain unchanged.

## Jobs, bounds and retention

- Fixed profiles `mp3-192-v1` and `cover-320-v1`, unique per owner/source/profile. The worker claims one job at a time per process for the configured unsuspended owner, using a random lease, ten-minute expiry and three automatic attempts after interruption. Exhausted jobs fail; manual retry resets attempts. Queue admission checks 20 pending jobs; concurrent requests may briefly exceed this threshold.
- Private input reads obey the existing import size setting (default 50 MiB); images are limited to 5 MiB. Verify length/SHA-256. JPEG/PNG dimensions must fit 8,192 per edge/16 million pixels before decoding.
- FFmpeg gets fixed temp paths, forced input demuxers, file/pipe protocol whitelist, disabled external MOV references, no shell/stdin, one codec thread, a 64 MiB per-allocation limit, bounded stderr and a three-minute timeout. Its environment excludes service credentials. These controls are not a complete OS memory sandbox; budget host resources for configured limits. Existing metadata parsing retains its worker/time limits.
- Cap audio output at 64 MiB and JPEG output at 2 MiB. Parse generated audio and reject duration differences exceeding the larger of 0.25 seconds/0.2%; truncated output is not published. Verify thumbnail dimensions and JPEG end marker.
- Recheck the lease before conversion, before storing and at publication. A transaction publishes readiness/thumbnail linkage together. Cancellation or lease replacement cannot attach a stale output. A newly stored asset may remain retained if cancellation wins immediately before publication.
- Remove only the verified temporary directory after the child closes, on success/failure. Existing storage rollback removes only newly uploaded objects whose asset registration failed. Originals, soft-deleted media and unpublished generated assets are retained. Permanent garbage collection needs a separate reference/retention workflow and is not implemented here.

Worker shutdown stops new polling; bounded active work can finish, with leases recovering interruptions after restart. Errors returned to the UI omit raw stderr, server paths, storage keys and credentials.

## Verification and remaining work

Local verification: 315 backend tests and 109 frontend tests pass; production frontend build and targeted lint have no errors. Existing PlayerContext warnings and bundle-size advisory remain. Coverage includes ownership/guest denial, schemas, queue/retry/cancel, source integrity, lease recovery, atomic publication contracts, temp cleanup, subprocess timeouts/environment, missing compatible output without fallback, technical labels and private thumbnail/full-art links. Controller/worker database/storage operations are mocked.

Real local FFmpeg 7.1 converted a generated one-second WAV into MP3 with parsed duration/bitrate/sample rate, and PNG/JPEG fixtures into bounded JPEG thumbnails. The isolated test binary lives under ignored `backend/node_modules`; it is not committed or deployed. Without `FFMPEG_PATH`, the three real-encoder tests skip. The Docker image has not been built/run here. Short fixtures do not establish hosted codecs, long-stream quality or phone compatibility.

Hosted acceptance: provision FFmpeg, verify indexes/transactions/private generated objects, prepare examples of all six import formats, compare original/compatible playback and seeking, restart/cancel/retry work, test thumbnails on phone/desktop, verify deleted/foreign/missing media denial, confirm originals/checksums survive failures, and inspect CPU/RAM/temp disk/storage/bandwidth and backup restoration.

Change 22 adds a bounded read-only database retention inventory with original/reference protection and review-only candidates. See [MEDIA_RETENTION.md](MEDIA_RETENTION.md) for the CLI and its limits. Physical-object inventory/aliases, writer fencing, quarantine/recovery and permanent cleanup remain unfinished. Change 23 adds automatic expiry-aware recovery with simulated-provider verification; real long-stream/range/device checks remain pending. Phase 6 also needs more artwork sizes, loudness/normalization and gapless/crossfade evaluation. Optional integrations remain Phase 7; offline work stays deferred.

Reference: [FFmpeg protocol restrictions](https://www.ffmpeg.org/ffmpeg-protocols.html). Actual flags/output were checked with the local encoder; hosted support still needs verification.
