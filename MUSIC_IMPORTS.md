# Private music imports

Open **Import Music** in the signed-in navigation, or visit `/music/import`. Choose individual files, multiple files, or a folder. Uploads run sequentially and each file shows its own status. After background analysis, edit the extracted metadata and choose the form's confirmation action to add the track, artists and album to the catalog.

The original is stored privately before review. Confirmation creates catalog records; it does not upload the file again. Music browsing and integration with the global player are the next implementation step, so importing does not yet provide a complete listening workflow.

## Deployment requirements

- Backend Node.js **22 or newer**, with dependencies installed from `backend/package-lock.json`.
- MongoDB Atlas or another **replica set**, because confirmation uses a transaction. A standalone MongoDB server cannot perform this confirmation transaction.
- Private storage and owner configuration from [PRIVATE_SETUP.md](PRIVATE_SETUP.md). Production does not fall back to server disk.
- Run the persistent backend through `backend/src/server.js` (`npm start` from `backend`). It starts the import worker automatically. Deploying only the serverless REST entrypoint will accept jobs but does not run this worker.
- Verify new MongoDB indexes and back up database/media before real imports. No hosted configuration, live migration, or storage upload was performed during implementation.

## Formats and limits

Initial inputs: MP3, M4A, AAC, FLAC, OGG and WAV. File extension and content signature must agree; background parsing then requires readable audio with a finite positive duration and channel count, and rejects identified video tracks. This is metadata validation, not complete decoding of every audio frame. Browser playback compatibility and transcoding remain future work.

The default limit is 50 MiB per file. Optional backend `MUSIC_MAX_UPLOAD_MB` accepts an integer from 1 through 200. At most 20 queued/processing/review jobs are permitted by the upload/retry checks. Uploads have a 60-request/15-minute limit in addition to the existing global API limit. These queue checks are not a transactional storage quota. Higher upload limits require adequate server memory and hosting request limits: uploads currently pass through server memory, without direct or resumable transfer.

The parser runs in a worker thread with a 20-second timeout and 128 MiB heap limit; it receives no inherited environment variables. Jobs persist in MongoDB, have five-minute processing leases, and recover interrupted work. Three interrupted attempts require a manual retry. A running persistent backend is required for recovery. The import screen polls active jobs and backs off after rate limits/errors.

## Metadata, duplicates and recovery

- Extract title, artists, album/album artists, disc/track numbers, release date/year, genres, language and duration. Missing tags receive editable fallbacks. Explicit and compilation flags can be reviewed manually.
- Extract an optional embedded JPEG/PNG cover up to 5 MiB. Artwork failure does not discard valid audio. Thumbnail generation, image resizing and artwork replacement remain pending.
- Compute SHA-256 on the server, verify source integrity before analysis, and reuse exact-file imports/assets for the owner. Different encodings with similar tags are not detected as likely duplicates yet.
- Confirm track creation and job completion in one MongoDB transaction. Repeating confirmation reuses the completed track. Existing tracks are not overwritten. Artist/album identity indexes protect concurrent creation; a conflict can require retrying confirmation.
- Cancelling a job stops its catalog confirmation and invalidates its worker lease. Originals/assets are retained, including failed and cancelled imports. Stopping a browser upload can still leave an already accepted job; check recent imports before trying again.
- Storage cleanup on failed asset registration targets only the new upload. Comprehensive orphan cleanup, retention periods, storage quotas, and physical deletion remain pending. Preserve originals; future playback derivatives have a separate original-asset reference.

## Protected API

All routes below require the configured owner's verified bearer token. Responses omit storage object keys, credentials and internal lease tokens.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/music/imports/config` | Supported formats and configured limits |
| GET | `/api/music/imports` | Active jobs followed by recent terminal jobs, up to 50 |
| POST | `/api/music/imports` | Upload multipart field `audio`; returns queued job or exact duplicate |
| GET | `/api/music/imports/:id` | Read an owned job |
| POST | `/api/music/imports/:id/confirm` | Submit reviewed metadata and create/reuse catalog records |
| POST | `/api/music/imports/:id/retry` | Requeue a failed/cancelled job |
| DELETE | `/api/music/imports/:id` | Cancel an unconfirmed job while retaining its original |

Confirmation accepts only `title`, `artistNames`, `albumTitle`, `albumArtistNames`, `isCompilation`, `discNumber`, `trackNumber`, `releaseDate`, `genres`, `language`, and `explicit`. Artist lists use semicolons in the form; genres use commas. The server validates bounded strings/arrays, valid calendar dates and positive integer track/disc numbers. Ownership, storage, processing status and duration cannot be supplied by the client.

## Verification and remaining work

Backend tests include real WAV parsing, invalid/truncated audio, owner denial, multipart validation, storage bounds/cleanup, lease cancellation, metadata validation, duplicate handling and transaction/session contracts. Database/storage operations are mocked: live MongoDB rollback/index behavior and hosted storage still need testing. Frontend helper tests cover folder selection, sequential failures, cancellation and reviewed payloads; a real browser/device import session remains pending.

The backend dependency audit currently reports 14 advisories, including one critical advisory in existing framework dependencies. The added metadata parser is not listed in that report. Dependency upgrades and regression verification remain a separate maintenance task; no forced bulk upgrades were applied.

Next: music-library screens and global track playback, then music playlists/queue, thumbnails, conversion, direct/resumable transfer, bulk editing and safe retained-file cleanup. See [NEEDED_CAHNGES.MD](NEEDED_CAHNGES.MD) for the complete checklist.
