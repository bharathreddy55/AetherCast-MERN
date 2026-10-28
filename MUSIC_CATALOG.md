# Personal music catalog foundation

## Current scope

The backend has separate Artist, Album, Track, and MediaAsset collections and an owner-protected API under `/api/music`. Existing podcasts, episodes, playlists, history, downloads, and progress records keep their current schemas and IDs.

Music importing and metadata review are implemented at `/music/import`; see [MUSIC_IMPORTS.md](MUSIC_IMPORTS.md). Music-library screens, track playback through the current React player, music playlists, and music listening history are subsequent work. The website does not yet provide a complete upload-to-listen workflow.

## Data model

| Entity | Stored information |
| --- | --- |
| Artist | Owner, name, biography, image asset, timestamps, soft-deletion date |
| Album | Owner, title, album artists, compilation flag, artwork asset, release date, genres, language, description, timestamps, soft-deletion date |
| Track | Owner, title, primary/featured artist credits, optional album, audio/artwork assets, duration, disc/track number, release date, genres, language, explicit flag, timestamps, soft-deletion date |
| MediaAsset | Owner, audio/image kind, private storage provider/bucket/object key, original filename, MIME type, format, codec, bytes, duration, bitrate, sample rate, image dimensions, SHA-256 checksum, processing state, optional original-asset link |

Owner IDs are immutable and refer to the existing MongoDB user profile linked to the Supabase owner identity. Every music query includes that owner; list/detail population also scopes related records to the same owner.

Tracks need at least one primary artist. Featured artists and multiple primary artists are supported. Ordinary albums need album artists; compilations can omit album artists while their tracks retain individual credits. Album detail orders tracks by disc number, track number, then record ID.

Media processing states are `pending`, `processing`, `ready`, and `failed`. A ready audio asset needs a checksum and a positive finite duration. New tracks require an owned ready audio asset; their duration comes from that asset. Asset creation/status changes are managed by the server import workflow. The browser cannot register arbitrary storage URLs or mark a file ready through this catalog API.

## API

All routes require a verified owner Supabase bearer token. Music metadata does not require a legacy creator role.

| Method | Route | Behavior |
| --- | --- | --- |
| GET / POST | `/api/music/artists` | List or create artists |
| GET / PATCH / DELETE | `/api/music/artists/:id` | Read, edit, or soft-delete an artist |
| GET / POST | `/api/music/albums` | List or create albums |
| GET / PATCH / DELETE | `/api/music/albums/:id` | Read an album with ordered tracks, edit metadata, or soft-delete it |
| GET / POST | `/api/music/tracks` | List or create tracks referring to imported ready media |
| GET / PATCH / DELETE | `/api/music/tracks/:id` | Read, edit metadata, or soft-delete a track |
| GET | `/api/music/tracks/:id/playback` | Return a track DTO and a private 15-minute audio URL |
| GET | `/api/music/assets/:id` | Read owned processing/file metadata, excluding storage location and credentials |

List parameters: `search`, `page` (1–10000), `limit` (1–100, default 25), and `sort` (`title` or `recent`). Track lists also accept `artistId`, `albumId`, and `sort=album`. Searches treat typed regular-expression characters literally. Unsupported filters and invalid IDs/types return 400.

Album detail includes up to 500 ordered tracks and a `tracksLimited` flag. Large albums can use the paginated track-list endpoint with `albumId` and `sort=album`.

Example artist request:

```json
{ "name": "An artist", "biography": "Optional notes" }
```

Example album request (substitute an owned artist's actual ID):

```json
{
  "title": "An album",
  "artistIds": ["507f191e810c19729de860ea"],
  "releaseDate": "2026-10-28",
  "genres": ["Alternative"]
}
```

Example track request (the referenced ready media asset must have been created by the server import workflow):

```json
{
  "title": "A song",
  "artistCredits": [{ "artistId": "507f191e810c19729de860ea", "role": "primary" }],
  "audioAssetId": "507f191e810c19729de860eb",
  "discNumber": 1,
  "trackNumber": 1,
  "explicit": false
}
```

Owner IDs, durations, processing status, and direct media URLs cannot be assigned in these requests. Track audio asset replacement is reserved for an import/replacement workflow; PATCH edits metadata only. Release dates use valid `YYYY-MM-DD` calendar dates. Artist/artwork/album references must belong to the authenticated owner and be active/ready as appropriate.

## Media privacy

Catalog responses use explicit DTOs and do not expose raw media locations or credentials. Artwork is resolved to temporary private links for ready owned image assets. Playback separately checks the track and its ready audio asset before issuing a temporary link through the existing signed media handler. Storage setup in `PRIVATE_SETUP.md` remains required.

MediaAsset stores object references, not permanent public URLs. Existing podcast media references are unchanged by the new catalog. External music catalog providers and Spotify integration are outside this private-library foundation.

## Deletion and duplicates

- Deleting a track sets `deletedAt`, hides it from catalog/playback queries, and retains original media for recovery. Physical file/object cleanup is not performed.
- Deleting an artist is blocked with 409 while active tracks or albums reference it. Deleting an album is blocked while active tracks reference it.
- A unique owner/audio-asset index prevents duplicate active track records for the same asset. An owner/checksum index supports file-level deduplication during importing. Deleting a track permits a later catalog record to reuse its retained asset.
- Restore, orphan-file cleanup, music-playlist unavailable-item handling, and music-history retention will be implemented with those features. Existing episode playlists cannot refer to new tracks. Initial music playlists will remain separate; mixed music/podcast playlists are outside the first release.

## Migration and rollout

1. Back up the current database and media before production imports or migration work.
2. Deploy the additive catalog models/routes. MongoDB creates the new collections/indexes through the configured Mongoose connection; verify the indexes in the target database before importing real music.
3. Keep existing Podcast/Episode/Playlist/User records and IDs intact. No podcast-to-track conversion or live database migration has been performed from this workspace.
4. Enable the implemented server import workflow using the runtime, private storage, persistent worker and MongoDB replica-set requirements in `MUSIC_IMPORTS.md`. Imports register tracks only after processing and metadata confirmation succeed.
5. Add music-library views and connect the player to the track playback API. Define track-specific history/progress and separate music playlists before enabling music queue features.
6. Test real MongoDB CRUD/index behavior, private storage playback, large albums, duplicate imports, deletion, and backup restoration in the hosted environment.

Current verification uses schema validation and owner/query/API tests with mocked database operations; a live MongoDB/storage/browser music session has not been run. Import jobs and any eventual migration must remain retry-safe and preserve existing podcast data.
