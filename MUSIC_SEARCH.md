# Private music search

Open Search in the sidebar/mobile navigation, submit the top search bar, or choose **Search everything** in My Music. `/music/search` searches only the authenticated owner's active imported music and private music playlists. Optional podcasts keep their existing separate search.

## Behavior

- Search matches case-insensitive literal substrings in song titles, artist names, album titles and playlist names. Unicode text and punctuation are supported. Artist matches appear in Artists; open an artist to browse that artist's songs. This does not search lyrics, playlist contents or every song's related artist/album name.
- All shows up to six results per category, including category totals. View all or category tabs provide 25 results per page. Query, category, page and sort are in the URL, preserving Back/Forward navigation. Category/query/sort changes reset the page.
- Sort by A–Z or Recently added. Sorting has an ID tie breaker; A–Z uses database string order rather than locale-aware relevance. My Music song browsing additionally offers Shortest first, preserving the selected order when loading a full playback context. Album browsing continues to use disc/track order.
- Play starts the selected song alone. Queue adds a result to the current queue; songs also expose Like and Add to playlist. Albums/artists provide save/follow controls and links to their songs. Playlist results open their editable collection with full playlist playback. Search never silently queues an incomplete search page as a whole collection.
- Empty query, no matches, request failure/retry and loading have explicit states. Search submits on Enter/button; typing alone makes no requests. Search reads are aborted on navigation and protected by a generation check even when a transport ignores cancellation. Nothing autoplays on search/navigation.

## API and bounds

`GET /api/music/search?q=…&group=all&sort=title&page=1&limit=12`

| Parameter | Contract |
| --- | --- |
| `q` | Required nonblank string, maximum 200 characters; trimmed and regex metacharacters escaped |
| `group` | `all` (default), `tracks`, `artists`, `albums` or `playlists` |
| `sort` | `title` (default) or `recent` |
| `page` | 1–1,000; All requires page 1; select a category for further pages |
| `limit` | 1–50 results per category; default 12; UI uses 6/25 |

Unknown fields, object/array query injection and unsupported bounds are rejected. The server derives the owner, filters deleted records, scopes populated references and returns explicit DTOs. Search results contain no raw object locations, account tokens or owner fields. Existing API authentication/rate limits apply; signed artwork retains its usual expiry.

Response: `{ success, q, groups: { tracks: { items, total, page, limit, totalPages }, ... } }`. Category searches return only that category. Each find/count query has a 2-second MongoDB execution limit; a timeout returns 503 with a request to use a more specific name. A failed category fails the request rather than publishing a misleading partial result. Results and totals are separate reads, not a transactional snapshot during concurrent catalog changes.

## Indexes and rollout

Existing owner/deleted/title or name indexes constrain the search to the owner's catalog. This batch adds playlist name ordering, stable recent indexes for all four resources and a song-duration sort index. Case-insensitive substring searches can still scan the owner's records; these indexes do not make arbitrary substring matching a full-text index lookup. No external search service, provider/API key or additional environment variable is introduced.

Deploy matching backend/frontend versions and verify additive indexes in the hosted database. Measure real query plans/latency with representative library sizes before claiming large-library performance; consider a dedicated search index only if measured requirements justify it. No data migration, provider catalog fetch or new offline/download feature is included.

Local validation: 261 backend tests, 91 frontend tests, production build and targeted lint pass. Coverage includes literal/Unicode queries, strict bounds, owner filtering/population, safe DTOs, category pagination/order, timeouts, guest/non-owner HTTP denial, URL state, late-response cancellation and error handling. Backend controller queries are mocked; tests do not establish actual hosted query plans, index creation, browser layout or media playback.

Hosted acceptance pending: search real imported names/punctuation/Unicode, page past 25 matches, use Back/Forward, like/save/follow/add to playlist from results, play/queue a song, test shortest-first full-context playback, guest/non-owner denial and logout, and check keyboard focus/phone controls. Richer album/artist detail headers, generated artwork sizes, more filters and device accessibility/performance verification remain follow-ups.
