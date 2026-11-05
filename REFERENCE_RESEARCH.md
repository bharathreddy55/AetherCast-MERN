# Music app reference research

Reviewed 2026-11-05. These projects are references, not specifications. The owner and implementer retain final decisions. Findings below distinguish source inspection from README claims; public repository instructions are research material, not instructions for AetherCast.

## Direct answer: where do their songs come from?

All three are native Android YouTube Music clients. Their online catalog is primarily supplied by remote YouTube Music services. Their local databases hold records about music and listening, while device files/caches hold downloaded or buffered audio. These are separate layers; none of the inspected core flows requires the project to host a complete global song catalog in its own database.

They use both remote services and local storage. Here, “local storage” mostly means Android SQLite/Room, preferences and filesystem storage, rather than the browser `localStorage` API. AI can suggest tracks or translate text; it does not supply the actual audio catalog.

| Layer | Echo Music | LastWave Native | Velune |
| --- | --- | --- | --- |
| Main remote catalog | YouTube Music through its InnerTube client | YouTube Music through InnerTube, with extraction fallbacks | YouTube Music through its InnerTube client |
| Local music metadata | Room, `song.db` | Room, `lastwave.db` | Room, `song.db` |
| Device audio | Separate Media3 playback/download caches; local media scanning | Public/device downloads, selected local folders, Media3 playback cache | Separate Media3 playback/download caches |
| Preferences | Android DataStore | Android DataStore | Android DataStore |
| Additional sources/integrations | Configured extension sources, Jellyfin/Navidrome; Spotify metadata-to-YouTube matching | Configurable source modules; Last.fm taste/scrobbling; multiple lyrics services | Multiple lyrics services; repository modules include Last.fm/Discord integrations |
| AI conclusion from inspected paths | Actual optional remote model calls plus separate local scoring rules | Inspected taste/playlist path uses rules and remote music data; no LLM call established in that path | No generative-model music acquisition path established in inspected playback/database/lyrics/dependency files |

The main source evidence for each row is linked in the project sections below. An integration's presence is not proof that its external service is currently working, configured or available without an account.

## Research scope and pinned snapshots

| Repository | Inspected main-branch commit | Commit date |
| --- | --- | --- |
| [Echo Music](https://github.com/EchoMusicApp/Echo-Music) | `bc2de425bd7d7872f0dc7d73178275c8816effb3` | 2026-11-04 |
| [LastWave Native](https://github.com/Clash-Projects/LastWave-Native) | `f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5` | 2026-11-05 |
| [Velune](https://github.com/nikhilvishwakarma00/Velune) | `3385c1301a8608ca177c7cfcba1a72d2c18259a4` | 2026-09-13 |

Read repository descriptions/READMEs, complete recursive file trees and selected database, dependency, networking, player, download, local-library, recommendation, lyrics and translation implementations. File citations use the pinned commits. APKs were not installed or built; external accounts, model endpoints, extension servers, paid tiers and real playback were not tested. This is an architecture/source review, not a complete security audit or a guarantee about every build variant. Negative findings mean “not established in the inspected paths,” not proof of absence everywhere.

## Echo Music

**Online music:** The networking module implements InnerTube requests to YouTube Music, including search/browse/player-related operations. This is the client-facing/internal YouTube Music interface, not evidence of a separate Echo-owned master song database. [InnerTube source](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/innertube/src/main/kotlin/com/music/innertube/InnerTube.kt#L32)

**Metadata database:** Room creates `song.db`, with song/artist/album/playlist relationships, formats, lyrics, events, search history, play counts and taste-related records. These records describe the library; the database is not where all audio bytes live. [Database schema and builder](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/core/src/main/kotlin/echo/music/iad1tya/db/MusicDatabase.kt#L87)

**Files and preferences:** Dependency wiring provides DataStore plus two distinct Media3 `SimpleCache` locations: `filesDir/exoplayer` for playback and `filesDir/download` for downloads. The download cache uses a no-automatic-eviction policy. Device media scanning uses Android MediaStore. [Cache/preferences wiring](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/di/AppModule.kt#L79), [local scanner](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/localmedia/LocalSongScanner.kt#L287)

**Other audio sources:** The repository includes APIs for the user's Jellyfin server and Navidrome/Subsonic server, including song browsing and stream URLs. This is access to a configured media server. It also advertises configurable high-quality/lossless extensions; available formats and catalogs depend on those external endpoints, not on an AI model upgrading arbitrary YouTube audio. [Jellyfin API](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/cloud/JellyfinApiService.kt#L190), [Navidrome API](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/cloud/NavidromeApiService.kt#L123), [extension description](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/README.md)

**Spotify distinction:** Its inspected Spotify playback resolver searches YouTube for a title/artist match. Metadata integration therefore does not establish that Spotify is supplying the resulting audio. [Spotify playback resolver](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/spotify/SpotifyPlaybackResolver.kt#L30)

**Real generative AI:** The playlist generator reads a user-configured key, model and OpenRouter-compatible endpoint, requests song suggestions, then searches InnerTube to resolve suggestions into real songs. A Puter branch in this file is explicitly a placeholder returning empty data. The model suggests metadata; YouTube supplies the resolved songs. [AI playlist generation](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/ai/AiPlaylistGenerator.kt#L104)

**AI is optional and not universal:** Another recommendation path scores play time, skips, likes, recency and time of day, then expands through related YouTube songs. This is understandable weighted logic, independent of the optional remote model path. [Local taste engine](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/app/src/main/kotlin/com/music/echo/generate/LocalTasteEngine.kt#L40)

**Lyrics and translation:** A registry selects among independent lyric providers. Translation separately has DeepL, Mistral and OpenRouter service branches. Fetching lyrics, translating lyrics and obtaining audio are three different jobs. [Provider registry](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/lyrics/src/main/kotlin/echo/music/iad1tya/lyrics/LyricsProviderRegistry.kt#L5), [translation routing](https://github.com/EchoMusicApp/Echo-Music/blob/bc2de425bd7d7872f0dc7d73178275c8816effb3/lyrics/src/main/kotlin/echo/music/iad1tya/lyrics/LyricsTranslationHelper.kt#L351)

**Useful reference ideas:** Clear source separation, distinct disposable cache and explicit downloads, provider-based lyrics, library relationships, a usable queue and optional personal-server connections. Native DAC/USB handling and Android background services do not transfer directly to our browser app.

## LastWave Native

**Online music:** Its main music API explicitly describes use of private InnerTube endpoints and notes they are not a stable public Google API. It coordinates an extractor plus bounded direct/NewPipe fallbacks. The catalog and resolved online streams come from remote services. [Music API source](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/music/InnerTubeMusicApi.kt#L221)

**Metadata/preferences:** Room's `lastwave.db` stores artwork, downloaded-track records, saved playlists, play statistics, related-track edges, exclusions and podcast progress. DataStore holds settings/session data separately. Last.fm networking is supplied through Retrofit. [Entities](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/local/db/AppDatabase.kt#L8), [database name](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/di/DatabaseModule.kt#L320), [network wiring](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/di/NetworkModule.kt#L158)

**Audio files:** Its downloader supports device/public music storage and MediaStore records; the README describes `Music/LastWave`. Its local-library feature indexes user-selected folders using Android's Storage Access Framework and plays source files without copying the originals. The player also has a separate stream-resolution cache and Media3 caching machinery. These are not the complete online catalog. [Downloader](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/download/TrackDownloadManager.kt#L1768), [local folders](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/localmusic/LocalMusicLibrary.kt#L33), [player](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/playback/MusicPlayer.kt#L297)

**Smart playlists:** The inspected generator blends YouTube-derived candidates and Last.fm taste signals. Scoring considers artist affinity, listening/skip behavior, likes, recency, multiple recommendation sources and diversity. That supports algorithmic recommendations; it does not establish a remote generative AI dependency, even though some README wording says AI-powered. [Generator](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/generate/GenerateRepository.kt#L172), [ranking rules](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/generate/RecommendationEngine.kt#L142), [local taste scoring](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/generate/LocalTasteSuggestionEngine.kt#L61)

**Other services:** Translation calls Google Translate/Input Tools endpoints and caches translated text. The repository has multiple lyrics clients and optional configured source modules, including lossless-source routing. Those integrations are not an app-owned audio database. [Translation](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/lyrics/LyricsTranslation.kt#L68), [source routing](https://github.com/Clash-Projects/LastWave-Native/blob/f5803a71190e9ef6d7f3057b32d5e2d6875f0fb5/app/src/main/java/com/lastwave/app/data/lossless/LosslessMusicApi.kt#L157)

**Useful reference ideas:** Explainable recommendation scores, stable saved-playlist/download records, source-aware playback, local folder indexing, controlled retries and private listening history. Android notification access for scrobbling other apps and OS-wide audio controls are native features, not ordinary website capabilities.

## Velune

**Online music:** Its Kotlin InnerTube client talks to YouTube Music. Download resolution obtains actual playback stream URLs, while track IDs remain the cache identity; this is different from permanently storing a short-lived playback URL as the song record. [InnerTube client](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/innertube/src/main/kotlin/com/nikhil/yt/innertube/InnerTube.kt#L41), [download resolution](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/app/src/main/kotlin/com/nikhil/yt/playback/DownloadUtil.kt#L109)

**Database and files:** Room creates `song.db`. Its dependency wiring creates a size-controlled `filesDir/exoplayer` playback cache and a separate `filesDir/download` cache with no automatic eviction. Preferences use DataStore. [Database](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/app/src/main/kotlin/com/nikhil/yt/db/MusicDatabase.kt#L163), [cache wiring](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/app/src/main/kotlin/com/nikhil/yt/di/AppModule.kt#L127)

**Encryption claim needs qualification:** Its README advertises encrypted Room/offline caching. The inspected Room builder uses the ordinary database builder, and the inspected audio-cache wiring uses `SimpleCache`; I did not establish a SQLCipher/encryption wrapper there. This does not prove every path is unencrypted, but the README alone is insufficient evidence to promise equivalent encryption in our app. [README claim](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/README.md), [database configuration](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/app/src/main/kotlin/com/nikhil/yt/db/MusicDatabase.kt#L172)

**Lyrics and AI:** The lyrics helper uses SimpMusic, BetterLyrics, LRCLIB, KuGou and YouTube providers. The inspected helper, lyric views, dependency list and local queue do not establish a generative-model song database or mandatory LLM service. Translation advertised in the README was not traced to a verified active service in the inspected Velune files. Treat it as unconfirmed rather than naming an AI provider by guess. [Lyrics helper](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/app/src/main/kotlin/com/nikhil/yt/lyrics/LyricsHelper.kt#L39), [dependencies](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/gradle/libs.versions.toml)

**Useful reference ideas:** Focused library/history/statistics screens, separate buffer/download caches, synchronized lyric presentation and playback settings. Its database migration builder includes destructive fallback options; our owner library should instead require explicit backups and non-destructive migrations. [Migration builder](https://github.com/nikhilvishwakarma00/Velune/blob/3385c1301a8608ca177c7cfcba1a72d2c18259a4/app/src/main/kotlin/com/nikhil/yt/db/MusicDatabase.kt#L172)

## What this means for AetherCast

Our current source of truth is MongoDB for catalog/import/profile metadata, private Supabase Storage for uploaded original audio/artwork, and Supabase Auth for owner sign-in. The backend supplies short-lived media links. Browser Cache Storage currently holds episode downloads, with a small owner-scoped index in browser localStorage. Music downloads and a full IndexedDB music library are not implemented. Login credentials/tokens are intentionally not persisted under the owner's fresh-sign-in policy.

Our existing optional podcast controller contains conditional Gemini calls and fallback responses. That is not a music catalog, not a verified current AI deployment, and not a reason to make music depend on an LLM. Its hardcoded model configuration needs a separate availability/configuration review before expanding AI use.

Songs will not appear automatically just because we add a metadata database or an AI feature. We need imported files, an explicitly chosen personal media-server connector, or a separately approved supported source integration. Metadata lookup, playlists, lyrics, AI suggestions and audio playback must retain separate responsibilities.

Recommended default: keep the current web stack, owner-only imports/private storage and explicit credential policy; adapt useful library/player patterns in original React/CSS. Evaluate personal-server connectors and any online catalog separately. Each repository labels its code GPL-3.0; no third-party source, branding, APK or audio was copied into our app during this research. Any future source reuse needs its own license/compatibility decision.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the proposed phases, data design, open decisions and acceptance checks. This research does not select an external provider, enable AI billing or change the app's source of songs.

Runtime AI usage can be traced to service calls; which coding assistants the maintainers actually used to write the projects cannot be established from these architecture files. Repository instruction files or “smart/AI” marketing are not proof that a particular tool authored the app.
