# Private library setup

## Owner access

1. Use the existing owner account in Supabase, or create the owner through the Supabase dashboard.
2. Copy that account's **User UID** from Authentication → Users.
3. The supplied owner UID is `22ee4604-30c6-4efa-9bc6-b522de3770e9`. It is now set in the local `backend/.env` as `OWNER_SUPABASE_USER_ID`. Set the same environment variable in the deployed backend hosting settings, alongside the required Supabase/database configuration. The local file is ignored by Git and does not configure Render automatically. Never set the owner from browser input or user metadata.
4. In Supabase Authentication settings, disable **Allow new users to sign up**. Review enabled providers and disable automatic account creation where applicable. The application closes its own registration routes, but cannot change hosted Supabase settings by changing source code.
5. Restart/redeploy the backend after configuration. With no owner configured, authenticated app requests return a configuration error rather than granting access.

The owner continues to sign in through Supabase. Legacy application registration, password login, Google-token exchange, OTP, and refresh endpoints are closed; the frontend already uses Supabase for sign-in and session refresh.

Existing MongoDB profiles keep their current roles. New profiles receive `listener`; administrator roles must be assigned through a trusted operation. User metadata cannot grant administrator privileges.

On owner sign-in, an existing unlinked MongoDB profile is linked by matching its email to the verified owner token, preserving its database ID and library relationships. Future requests use `supabaseUserId` so an email change does not create a new library. A profile already linked to a different identity is rejected. The live database has not been modified by this code change; linking happens on a subsequent authenticated request after deployment.

## Current rollout boundary

Owner enforcement now applies to all application API routes outside the authentication router, including catalog/search, episode details, playlists, comments, play events, and AI chat. Explore and podcast detail screens require sign-in. The root opens the private listening home. The frontend uses a shared API client that attaches the current session token only to the configured backend API.

Application media now uses scoped links valid for 15 minutes. The `/uploads` directory is closed to direct requests; the signed media handler streams local development files or proxies private Supabase objects. API responses rewrite owned audio/artwork references to temporary links. New uploads store `supabase://bucket/object-key` references instead of public URLs. Existing URLs belonging to the configured Supabase project/bucket are interpreted as object references when delivered, without rewriting the database.

Hosted storage policies, existing externally public files, complete offline launch, and device verification still need the work tracked in `NEEDED_CAHNGES.MD`. Listening-room connections now enforce owner authentication in the application. Do not consider the deployed library fully private until required hosted setup and verification are complete.

API and media URL configuration now share `frontend/src/lib/config.js`. `VITE_API_URL` should be the backend base URL, without `/api`; it is used for both API calls and local-upload media links. The shared fallback is localhost in development and the existing Render backend on deployed hosts.

Changes are local until deployed. Apart from the local owner and media-signing environment settings, no Supabase settings, database records, or hosting configuration have been changed automatically.

## Required private media deployment setup

1. Back up the existing media and database before changing the storage configuration.
2. In Supabase Storage, make the app's bucket (default: `vox`) **private**. Review policies on that bucket and remove broad anonymous/public read or write permissions. The application reads/writes objects on the server; browser storage access is not required for the new delivery flow. Do not alter unrelated buckets or their policies.
3. Set `SUPABASE_SERVICE_ROLE_KEY` in the backend's private environment settings. This is a privileged server credential; never use a `VITE_` prefix, put it in frontend code, commit it, or paste it into chat. New cloud uploads and playback check that the bucket is private before proceeding.
4. Set `SUPABASE_STORAGE_BUCKET` if your existing bucket is not `vox`. Keep `SUPABASE_URL` pointed at the same project as the media records.
5. Set a random `MEDIA_SIGNING_SECRET` of at least 32 characters in the backend environment. A random secret has been generated locally in the ignored `backend/.env` without printing it. Configure a separate secure value in hosting settings or securely transfer the existing local setting. Production will not start with a missing or short value. Rotating it invalidates existing temporary media links.
6. Deploy backend and frontend together. Refresh/reopen the app so its service worker updates. Verify sign-in, catalog, artwork, playback, seeking, HEAD requests, and downloading against real storage.
7. Verify an old `/uploads/...` URL returns 404 and an old Supabase public-object URL is no longer readable without authorization. If previously public URLs remain accessible through an external cache, migrate affected objects to new private keys and retire old copies after confirming backups. Making application routes private cannot recall a file someone has already downloaded.
8. Test a copied temporary media link before and after its 15-minute expiry. Links are bearer capabilities: possession grants access to that single asset until expiry, including briefly after logout. They do not contain the account access token or the storage service credential. Avoid logging full `/media/...` paths at hosting/proxy layers; application request logs redact them.

Cloud upload failures are reported; production never silently writes media to ephemeral server disk. Local files are available only for development. Production file imports need the private storage credentials above.

## Downloads and remaining limitations

- Downloads use a cache scoped to the MongoDB owner ID and stable episode IDs, so refreshed links do not orphan a saved file. The player checks that cached audio exists before using it.
- Both download buttons share the same implementation, which fetches fresh authorization and accepts only a complete successful media response.
- Logout aborts pending downloads, clears that account's download cache/index, and stops the player. Clearing site data remains the recovery action if browser storage cleanup fails.
- The upgraded service worker removes the old shared `vox-*` caches. Previously downloaded files will need to be downloaded again; server originals are not deleted. New scoped download caches are preserved across service-worker upgrades.
- A signed-in running app can play cached audio without contacting the catalog API for that media. A complete offline launch/authentication flow, offline artwork, progress synchronization, quota management, and phone testing remain pending.
- Expired or interrupted streaming shows an error. Pressing play resolves a fresh URL and attempts to restore the current position. Seamless renewal during long continuous streams and refreshing stale artwork remain follow-up work.
- Third-party public demo audio and external profile images are not made private by this change. Import owned music into private storage for private media delivery.

## Progress saving behavior

Progress is sampled from the actual attached media every ten seconds while playing. Pause, seek, completion, switching, closing, hiding the page, and explicit logout also request a save. The outgoing episode identity is captured before the player replaces its source. Saves are sent in order within one running player and invalid numeric progress is rejected by the backend.

Natural completion records the full duration; positions at or above 95% are considered completed. The player keeps recent checkpoints in memory for quick returns and resumes after metadata is available. Finished episodes restart at zero. Existing content remains podcast-oriented; music-track resume rules will be added with the music catalog.

Page-hide/unmount saves use browser `keepalive` as a best effort. Progress changes made offline are not yet persisted in a retry queue, and a browser/process termination can lose the latest unsent position. Cross-device write conflicts are not resolved in this phase. These changes need deployment and actual device verification.

## Signing keys and allowed website origins

- Set `CLIENT_URL=https://aether-cast-mern.vercel.app` on the backend host. Production requires an explicit HTTPS origin with no path, query, credentials, or wildcard.
- If preview builds or a custom domain need access, list those exact origins in `ADDITIONAL_CLIENT_ORIGINS`, separated by commas. Other Vercel subdomains are denied. Local development allows `http://localhost:5173` and `http://127.0.0.1:5173`; other local ports need explicit configuration.
- HTTP requests, Socket.io polling, and WebSocket upgrades use the same origin list. Listening-room owner authentication and room permissions are also enforced by the application.
- ES256 verification uses the configured Supabase project's public key endpoint. The server refreshes on an unfamiliar key ID, shares in-flight fetches, and limits forced refreshes to once per 30 seconds. Normal key caching lasts ten minutes. Keys are not shared between projects, and an expired cache is not used when refresh fails.
- `SUPABASE_JWT_SECRET` is optional for an ES256-only project. If the project still issues legacy HS256 tokens, configure the exact legacy secret string; the app does not guess an encoding from its length. Placeholder values and short production secrets are rejected.
- Backend ES256 verification no longer needs `SUPABASE_ANON_KEY`. The frontend still requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Supabase sign-in; the server still needs its private storage credential for media.
- Legacy application JWT/OTP login code has been removed. No user records or historical password hashes were deleted. Public registration remains closed in the application; hosted Supabase signup settings must also remain disabled.

## Private listening rooms

Rooms are for devices signed in to the configured owner's account. Guests and other accounts cannot connect. The server revalidates sessions before each room action, disconnects sockets when their handshake token expires, and rejects suspended/invalidated owner profiles. The client reconnects with current credentials when Supabase refreshes the session.

The first joined device becomes host. Other owner devices can follow playback or choose **Take playback control**. Only the current host can broadcast playback changes. Room IDs must identify existing episodes, and events for unjoined rooms are rejected. Names and artwork come from the server profile rather than client messages.

Per-owner limits across connected devices reset each minute: 10 join/leave actions, 120 playback/host actions, and 30 chat messages. Messages are limited to 1000 characters; transport packets are capped at 16 KiB. Room state, host election, and counters currently reside in one server process and reset on restart.

Deploy the persistent Node backend through `backend/src/server.js` for Socket.io support. The serverless REST entrypoint alone does not provide this feature. Before relying on rooms, test two owner devices, guest rejection, joining/rejoining, host transfer, token refresh/expiry, disconnect counts, invalid events, and rate-limit recovery against the hosted backend. Multi-instance deployments need shared room/limit coordination before enabling rooms across instances.

## Music catalog rollout

The new `/api/music` routes use the same owner authentication and private media delivery. They add separate Artist, Album, Track and MediaAsset collections, preserving existing podcast collections and IDs. See `MUSIC_CATALOG.md` for the API, index/deletion rules and additive rollout plan.

No extra environment variables are introduced by the catalog. Existing private storage setup still applies. Verify the new MongoDB indexes and back up the library before real imports. The current website/player remains podcast-oriented until the import and music-library integration steps are completed; catalog APIs alone do not add a visible upload/listening workflow.
