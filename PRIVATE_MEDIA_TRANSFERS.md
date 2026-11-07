# Private media transfer reliability

Change 26 bounds inactivity while proxying private cloud media. Previously the 30-second object-request timeout ended when headers arrived, leaving a body that stopped producing bytes without an application-level deadline.

The proxy now uses a 30-second inactivity watchdog during body delivery, refreshed by non-empty chunks passing through a bounded Node stream pipeline. There is no total song-length limit: a progressing transfer can last minutes or hours. Backpressure is preserved; files are not loaded into memory in full. A blocked downstream transfer can also reach this deadline, including a browser that stops reading for long enough. This is a transfer-progress limit, not a measurement of the listener's playback position.

On inactivity, the shared fetch controller aborts, the pipeline cancels the storage reader and destroys the response. Already-started audio responses are terminated rather than followed with JSON or a false successful completion. The player may recover through its existing bounded near-expiry logic; other interruptions can require explicit Play. No unlimited automatic retry was added.

Existing signed-link validation, private-bucket verification, 30-second object-header deadline, disconnect cancellation, no-store headers and credential isolation remain in place. HEAD and 416 responses bypass body transfer. Local-file delivery still uses Express sendFile. Successful byte-range metadata/content is unchanged. Timer cleanup runs after success, cancellation and stream failure. The implementation uses Node's [abortable stream pipeline](https://nodejs.org/api/stream.html#streampipelinesource-transforms-destination-options).

## Verification scope

Deterministic stream tests advance a healthy transfer across four simulated minutes, check exact bytes, and exercise missing first bytes, mid-transfer stalls, client cancellation, upstream errors, downstream errors, blocked writes and watchdog cleanup. HTTP tests exercise local ranges, cloud range forwarding/416, cloud HEAD metadata, safe provider failures and expired cloud capabilities rejected before storage access.

These checks use in-process streams, fake time and mocked cloud responses. They do not establish actual Supabase/proxy behavior, real long-duration delivery, production deployment or physical phone/background acceptance. Those remain open Phase 6 checks, together with backup restoration, guarded cleanup and true gapless/crossfade. Offline work stays deferred.

## Deployment

Deploy the updated backend. No new dependency, environment setting or database migration is required. In staging, verify a large original and compatible file, full and suffix ranges, long playback, seek after capability expiry, network loss and cancellation. Inspect storage/backend transfer behavior when a browser suspends reading, especially on mobile; the watchdog deliberately releases an inactive connection after 30 seconds.
