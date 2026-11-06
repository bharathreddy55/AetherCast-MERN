# Mobile listening themes

Change 20 uses the supplied Acoustic Silence and Aura Nocturne boards as visual references for the existing responsive web/PWA app. It does not create a separate native mobile binary or add sample music to the real library.

## Appearance

- **Acoustic Silence / Light:** near-white background, white cards, charcoal controls and readable neutral text.
- **Aura Nocturne / Dark:** deep violet background, raised purple surfaces, lavender controls and restrained cyan focus accents.
- Shared Plus Jakarta Sans typography, quieter borders/shadows, rounded cards, pill filters, compact recent-song shortcuts and safe-area-aware mobile navigation/player spacing. Existing font loading retains a system fallback.

The header's Sun/Moon toggle switches immediately between explicit light and dark choices. Full-screen Now Playing has the same toggle. Settings → Appearance offers Light, Dark or Use device setting. The preference uses only the existing non-secret `theme` localStorage key; it never restores login, stores credentials or changes authorization. Blocked storage falls back safely to an in-memory choice/system default.

The active ThemeProvider is the single source of truth. It updates root palette/native control color scheme, the compatibility body class and browser theme-color. Existing light/dark values migrate directly; missing/invalid values follow the device. A small head initializer applies the saved/device choice before the main React app. Same-origin tabs receive preference changes, and device-theme changes are listened to in System mode. The old competing accent/glass controls are replaced by the reference-based appearance choices; their old stored values are ignored.

## Screen changes

- Mobile header keeps an accessible 44px theme toggle; bottom navigation uses a flatter surface and clearer active state. Desktop uses the same palettes.
- Library opens saved music collections at `/library`, with separate Playlists, Liked songs, Recently played, Saved albums and Followed artists filters. All music remains at `/music`.
- Playlist pages show artwork collages derived only from their available tracks, real descriptions/counts and a prominent Play button. Creation/edit forms use native expandable sections, retaining keyboard access, version checks and existing actions.
- The mini-player reserves space for the title/artist at narrow widths. Stop/close remains available in expanded Now Playing. Full-screen artwork/transport spacing is more compact; advanced version selection remains in the Audio tab with processing controls.
- Focus indicators, reduced-motion behavior and native form controls adapt to both palettes. Primary/secondary/muted text against main/card surfaces and primary button labels pass automated 4.5:1 token contrast checks; this is not a complete accessibility audit of every legacy screen.

## Verification and rollout

114 frontend tests pass, including preference validation, blocked storage, mode resolution, DOM/chrome application, before-paint initialization and palette contrast. The production build passes; targeted lint has no errors and retains the existing component/context fast-refresh warnings. Backend code is unchanged; the previous 315 passing backend tests remain its latest verification.

Browser verification included the real signed-out login theme toggle/reload and an isolated sample-data preview of the actual music components: mobile Home/Library/playlist/Now Playing/Settings, both palettes, full-screen toggle, saved selection after reload, System mode matching the device, cross-tab synchronization, desktop Settings and a 320px narrow layout. The corrected narrow Home measured page width 314px at a 320px viewport, with visible mini-player title space. Before the fix, the transport consumed the title space and pagination overflowed; both were corrected during review.

Preview data and API/context stubs lived only in ignored build output, were not used to authorize the real app and are not shipped. Saved screenshots use sample data. No owner password, real library changes, authenticated API writes, native-device test or production deployment was performed. Physical iOS/Android behavior, all legacy podcast/admin screens and real data with extreme text lengths remain follow-up checks.

Deploy the frontend to publish the changes. No new environment variables, backend deployment, database migration or provider configuration is required. Offline work stays deferred; Phase 6 processing/retention/audio-quality follow-ups remain on the implementation plan.
