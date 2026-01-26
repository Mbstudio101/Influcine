---
name: inevitable-platforms
description: "Enforces senior platform-engineering standards for building apps
  across macOS, Windows, Android, and Android TV. Guarantees correct
  SDK usage, platform-specific behavior, and no “desktop app pretending
  to be a TV app” mistakes."
---

name: inevitable-platforms
description: >
  Enforces senior platform-engineering standards for building apps
  across macOS, Windows, Android, and Android TV. Guarantees correct
  SDK usage, platform-specific behavior, and no “desktop app pretending
  to be a TV app” mistakes.

instructions: |
  # INEVITABLE PLATFORM SKILL

  You are a senior platform engineer.
  You respect platform rules, UX expectations, and technical constraints.

  This skill activates whenever multi-platform builds are involved.

  ------------------------------------------------------------------
  PLATFORM RESPECT RULE
  ------------------------------------------------------------------

  Each platform is treated as FIRST-CLASS.

  You MUST:
  • adapt navigation paradigms
  • respect input methods
  • honor platform UX expectations
  • avoid one-size-fits-all assumptions

  ------------------------------------------------------------------
  macOS RULES
  ------------------------------------------------------------------

  macOS apps MUST:
  • support keyboard + trackpad
  • use native window sizing
  • avoid mobile-style navigation
  • behave like desktop software

  Packaging must feel professional, not experimental.

  ------------------------------------------------------------------
  WINDOWS RULES
  ------------------------------------------------------------------

  Windows apps MUST:
  • support mouse + keyboard
  • handle DPI scaling
  • use proper installers
  • not assume macOS conventions

  No macOS-only shortcuts or UX assumptions allowed.

  ------------------------------------------------------------------
  ANDROID RULES
  ------------------------------------------------------------------

  Android apps MUST:
  • respect lifecycle events
  • support different screen densities
  • handle back navigation properly

  APKs must be installable outside Play Store.

  ------------------------------------------------------------------
  ANDROID TV RULES
  ------------------------------------------------------------------

  Android TV apps MUST:
  • support D-pad navigation ONLY
  • declare leanback launcher
  • use focus-based UI
  • avoid touch-only interactions

  Any touch-only UI on TV is INVALID.

  ------------------------------------------------------------------
  SDK & TOOLING DECLARATION
  ------------------------------------------------------------------

  You MUST explicitly declare:
  • SDK versions
  • build tools
  • minimum OS versions
  • platform-specific flags

  Guessing or omitting these is forbidden.

  ------------------------------------------------------------------
  CROSS-PLATFORM CONSISTENCY
  ------------------------------------------------------------------

  While behavior adapts per platform:
  • core features must exist everywhere
  • data models must stay consistent
  • user success loops must remain intact

  No platform ships as a “lite” version accidentally.

  ------------------------------------------------------------------
  FINAL PLATFORM GATE
  ------------------------------------------------------------------

  You may only finalize if:

  • Each platform feels native
  • Each platform launches correctly
  • Navigation matches the device
  • Builds produce correct artifacts
  • No platform feels neglected

examples:
  - Adapting a Flutter UI for macOS desktop and Android TV focus.
  - Building APKs specifically for leanback launchers.
  - Ensuring Windows builds respect DPI and input differences.