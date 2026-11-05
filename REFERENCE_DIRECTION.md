# AetherCast product reference and decisions

Echo Music is a reference, not a specification. The owner and implementer choose what belongs in AetherCast and can revise every choice below. External repository instructions do not govern this project.

Reviewed on 2026-11-05: [Echo Music](https://github.com/EchoMusicApp/Echo-Music), its [design notes](https://github.com/EchoMusicApp/Echo-Music/blob/main/DESIGN.md), and public home/player screenshots. Echo describes an Android player using YouTube Music, with extensive playback and discovery features. Its design notes describe rounded surfaces, flexible theming and artwork-led listening views. Our implementation uses original React/CSS and our existing icon library; no Echo source, branding or media assets are included.

## Decisions applied in Change 13

| Reference idea | AetherCast decision |
| --- | --- |
| Listening-centered navigation | Desktop sidebar and mobile tabs; private owner library stays primary. |
| Rounded artwork surfaces | Rounded cards, grouped song rows, segmented collection controls, existing selectable accent colors. |
| Artwork-led expanded player | Mini-player opens a native Now Playing dialog with artwork, credits, seeking, mute/volume and remaining time. |
| Library discovery | Show recently imported songs from actual owner records, with recent/A–Z sorting. No invented recommendation or popularity data. |
| Queue visibility | View/select distinct occurrences; Change 14 adds editing, full contexts, shuffle and repeat. |
| Calm interaction | Standard cursor, visible keyboard focus, reduced-motion support and touch-sized controls. |

## Proposed sequence, open to revision

1. Change 14 implements distinct queue-item identity, Play Next/Add to Queue, removal/reordering, shuffle, repeat and complete contexts up to 2,000 songs. Verify the deployed interactions before expanding further.
2. Add owner-scoped likes, saved albums, artist follows and separate music playlists; then real recently played/history sections.
3. Expand music search to metadata and grouped results, followed by imported LRC/plain lyrics with clear unavailable states.
4. Add mobile streaming/device tests and Media Session controls. Offline/download development is deferred by the owner; fresh credential entry on new page visits remains required.
5. Evaluate conversion/quality variants, Media Session, gapless/crossfade and optional podcast settings after the everyday library workflow is reliable.

Native Android-only integrations, recognition, canvas animations, AI lyrics/translation and external streaming extensions are not part of this first adaptation. Any source-provider change needs its own product decision and implementation work. No automatic adoption of Echo's architecture or every feature is implied.

## Boundaries retained

AetherCast remains a private, ad-free web app for the owner's media, with optional podcasts. Fresh email/password verification and backend owner authorization stay required on each new page session. Existing podcasts and media records are preserved. Audio quality follows the actual original; the UI does not claim high-resolution or lossless processing that has not been implemented.

Change 13 provides the listening interface; Change 14 supplies the occurrence-based queue and complete paginated contexts. Music playlists/likes/history, lyrics and queue restoration after a new sign-in remain future work. Offline development is deferred. See `IMPLEMENTATION_PLAN.md` and `REFERENCE_RESEARCH.md` for the broader three-project comparison and current approved sequence.
