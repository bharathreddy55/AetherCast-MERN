# Media retention review

Change 22 adds the first retention/cleanup step of Phase 6: a **read-only, owner-scoped database report**. It identifies older derivative records worth reviewing while keeping originals and referenced media protected. It does not implement permanent deletion, quarantine, a background cleanup worker or an app-facing cleanup button.

## Run the report

Use a trusted backend terminal with Node 22+, the existing `MONGO_URI` and the configured `OWNER_SUPABASE_USER_ID`. The command requires an existing, unsuspended owner profile. It uses backend database credentials; it does not sign a browser in or change the fresh-credential policy.

```powershell
cd backend
npm run --silent media:retention -- --help
npm run --silent media:retention -- --limit=50 --retention-days=30
```

The report prints JSON to stdout. For another page, copy `nextCursor` into the next invocation:

```powershell
npm run --silent media:retention -- --limit=50 --after=<nextCursor>
```

Replace `<nextCursor>` with the returned 24-character asset ID; omit the option on the first page. Limits are 1–100 assets per page and 30–3650 retention days. Longer retention windows are supported; shorter windows, duplicate/unknown arguments and `--apply`/delete flags are rejected. Each invocation is independent; use the same retention window throughout a review.

A read-only run against the configured backend database on 2026-11-06 at 17:28 IST succeeded: five registered assets (three audio files and two covers), all originals, zero review candidates, 17,439,191 bytes in asset-record metadata and no next page. All five had observed track/import references; the covers also had album references. This checks actual database reads and CLI execution, not hosted API deployment or physical storage contents. No records, objects, collections or indexes were changed by the CLI. Repeat the review after new processing/import activity. Keep any exported reports private; asset IDs are identifiers even though the report excludes filenames, owner IDs, storage keys/buckets, checksums, media links, lease tokens and credentials. Generated reports are not project source files.

## Categories and totals

| Category | Meaning |
| --- | --- |
| `original` | No `originalAssetId`: original audio/artwork or older unclassified media. Always retained, including an original reused through checksum deduplication. |
| `protected` | At least one observed owner reference, or queued/processing work for the same source that could reuse a derivative. Retained regardless of age. |
| `retained` | Derivative inside the retention window, not ready, or with invalid/incomplete size, dates, kind or source identity. |
| `review` | Ready derivative with valid metadata, old enough, and no observed owner reference. This is an investigation candidate, **not an assertion that its object is safe to delete**. |

Age uses the newer of `createdAt` and `updatedAt`, with whole days measured against the report's `asOf` time. Missing, inconsistent or future timestamps are retained. `summary` applies only to the returned page. `knownBytes`/`reviewBytes` sum asset-record byte sizes; they are not billing/physical-storage totals because duplicate/aliased records can refer to the same object. Unknown sizes are counted separately; unsafe numeric totals fail the report rather than silently losing precision. `nextCursor: null` marks the end of the current owner query, not an atomic library snapshot.

Reference checks cover track audio/covers, album covers, artist images, import audio/covers, processing job sources/outputs and asset original/thumbnail links. **Every status is included**, preserving soft-deleted catalog references and completed/failed/cancelled import/job references needed for retries or restoration. Pending processing on the same original source protects older sibling derivatives as well. The report never removes those records to manufacture an apparent orphan.

## Read-only and query behavior

- `media:retention` is a backend CLI, not an HTTP API. The active app/server is not modified and no new environment variable or schema migration is introduced.
- Resolve only the configured owner and restrict every asset/reference query to that MongoDB owner ID. Foreign data cannot be selected through an argument. No arbitrary collection, owner or object URL arguments exist.
- Connect with automatic index/collection creation disabled and command buffering disabled. The CLI uses only find/distinct queries, makes no storage requests, and disconnects before printing a successful report.
- Seek pages by `_id` instead of increasing offsets. Fetch at most `limit + 1` asset records with a fixed projection. Each reference distinct result is restricted to the bounded page IDs/source IDs. Each query has a five-second database execution limit; connections/socket operations have ten-second limits and a two-connection pool. Failed/timed-out checks abort the report; missing results are never assumed to mean unreferenced media.
- The existing owner-prefixed indexes support filtering. Review query plans and add targeted reference indexes through the normal deployment process if a large library times out; this CLI intentionally does not create indexes. Queries are bounded in returned data/execution time, not guaranteed constant-time indexed lookups for every reference field.
- Errors and exit status are safe: help exits 0 without connecting; invalid configuration/options, absent owner, failed queries or disconnection fail with exit 1 and no partial JSON/driver credentials.

## What still gates permanent cleanup

The report observes a live, owner-scoped database; its reference queries are not one atomic snapshot. Imports, recovery actions and processing publication can change references while it runs. It does not check object existence/content, multiple records pointing to the same storage key, cross-owner corruption, old podcast/avatar URL references, physical object listings or objects with no MediaAsset record. It therefore cannot authorize deletion by age or by a saved report.

A subsequent cleanup batch must implement durable reference/publication fencing respected by all writers, object-identity/alias and legacy-reference checks, a retention/quarantine/recovery policy, final reference rechecks and crash-safe object/database deletion sequencing. Verify a backup/restore procedure and the real inventory before running any future purge. Original/soft-deleted-media retention remains separate from orphan derivative cleanup. Nothing in Change 22 deletes or changes live objects.

## Validation

Focused tests cover original/deduplicated protection, all reference sources and statuses, pending source work, retention boundaries/future/missing dates, malformed metadata/source IDs, page cursors and size bounds, empty pages, query failure, sensitive-field omission and numeric overflow. CLI checks cover arguments/help, owner resolution, disabled automatic writes, disconnect ordering and safe failure paths. Full-suite results and the real read-only database scan are recorded in `NEEDED_CAHNGES.MD`; physical storage inventory and cleanup remain pending.
