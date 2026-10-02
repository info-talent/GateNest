# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.9.0] - 2026-10-03

### Added

- Native Feature Center with module filtering, typed operation forms, configuration loading, record actions, and explicit confirmation for mutations.
- Password and remembered-account login support for TOTP two-factor authentication.
- Account and group options for Kimi, Zhipu, DeepSeek, MiniMax, OpenCode GO, and TypeSafe / Jev.
- Complete account and system-settings field forms, plus official-site entry points for payment and browser authentication.

### Fixed

- OpenAI Base URL now uses the login server's public `api_base_url` setting, preserving separate API hosts and deployment paths.
- User API key creation and editing now include available-group selection.
- Multipart and raw requests reuse session refresh, while stale responses cannot refresh a different selected account.

### Changed

- Pin the Sub2API API and request-schema inventory to `b8dece9000c68815a5b867ca5a1e6f236e173905`, including payment and channel-monitor V2 routes.
- Distinguish handwritten integrations from generated API wrappers in coverage reporting.
- Keep Android APKs and the unsigned iOS IPA in one version-verified release.

## [1.8.3] - 2026-09-06

### Fixed

- Both iOS sidebar drawers now use window safe-area insets across modal presentations, preventing their headers from overlapping the status bar and keeping bottom actions above the home indicator.
- IPA downloads use a foreground session and fall back to direct data streaming when iOS cannot create its download temporary file. Download errors are concise and Safari download is also available.

### Changed

- Android and iOS are built from the same commit and published in one Release only after all three APK architectures and the IPA pass the version and artifact checks.
- iOS packages use `gatenest-vX.Y.Z-unsigned.ipa`, retaining the signing status without a system-version suffix.

## [1.8.2] - 2026-09-06

### Fixed

- iOS workspace switching waits for the sidebar and confirmation dialogs to finish dismissing before presenting another dialog or navigating.
- Confirmation actions run once after dismissal, including when alerts are queued.

### Added

- Open Sub2API release notes for the reported version from the sidebar's server-version dialog and System Maintenance.
- Download iOS IPA updates from GitHub Releases with progress, retry failed downloads, and open the system share sheet to choose an installed signing app or save the file.

### Changed

- iOS packages and their Actions artifacts use `gatenest-vX.Y.Z` without platform or signing suffixes. IPA files still require signing before installation.

## [1.8.1] - 2026-08-24

### Fixed

- CLIProxy quota auto-refresh now persists an absolute next-refresh timestamp, so switching GateNest menus or remounting the page no longer resets the countdown.
- CLIProxy plugin enable/disable loading indicators are now scoped to the plugin being changed instead of spinning every plugin button.
- Simplified plugin and Vertex credential action labels to `编辑`, `保存配置`, and `导入账号`.
- CLIProxy account-pool quota bars now use fixed horizontal heights, clamp invalid percentages, collapse long model-window lists by default, and provide additional bottom scroll space.
- Simplified CLIProxy key actions to `复制密钥` and `测试模型`.
- CLIProxy plugin editing now renders native controls from declared `config_fields`: switches, enum choices, numeric and string inputs, plus validated array/object editors; JSON is only used as a fallback when a plugin declares no fields.

## [1.8.0] - 2026-08-24

### Changed

- Renamed the public application brand from Sub2API Mate to GateNest across the app UI, documentation, build workflows, and future release artifact conventions while preserving existing native package identifiers and repository URLs for upgrade compatibility.
- Switching between Sub2API and CLIProxyAPI workspaces now requires explicit confirmation.
- Installed CLIProxy plugins now expose visible configuration editing, enable/disable, repository, and plugin-provided resource-menu actions.
- CLIProxy grouping now offers the official-store CPA Key Policy path when GateNest Group Router is unavailable, while keeping explicit manual installation instructions for auth-ID routing.
- Added native GateNest management for CPA Key Policy keys, rotation, RPM counters, usage, aliases, pricing, credential classification rules, real-account previews, and model catalog targets.

### Fixed

- CLIProxy quota auto-refresh now shows a live foreground countdown and persists the last refresh time and result for both automatic and manual refreshes.

## [1.7.1] - 2026-08-24

### Added

- CLIProxy workspace navigation now mirrors the official management-center sections with dedicated Quick Start, AI Providers, OAuth Login, Quota Management, Plugin Management, Plugin Store, and Hub Information pages.

### Fixed

- CLIProxy live quota values now normalize both fractional and percentage upstream formats and use visible red/orange/yellow/green thresholds instead of treating most non-exhausted quotas as green.

## [1.7.0] - 2026-08-24

### Added

- Top-level Sub2API / CLIProxyAPI workspace switcher with independent connection forms, navigation, route guards, and persisted active workspace.
- CLIProxy credential-file management: multi-file JSON import, sensitive export/share, metadata editing, per-credential model inspection, and guarded deletion.
- CLIProxy system management for runtime flags, retries, proxy, logging, quota failover, global routing, complete validated `config.yaml`, update checks, and trusted plugin-store installs.
- CLIProxy observability page with filtered/auto-refreshed logs, error-log export, log clearing, and non-destructive per-provider API-key usage statistics.

## [1.6.0] - 2026-08-24

### Added

- Open-source baseline documentation:
  - `README.md` expanded for setup, architecture, release, and security notes
  - `LICENSE` (MIT)
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`
  - `CHANGELOG.md`
- New admin creation flows:
  - `app/users/create-user.tsx` for creating users via `/api/v1/admin/users`
  - `app/accounts/create.tsx` for creating accounts via `/api/v1/admin/accounts`
- New users tab quick action to open the create-user screen.
- Independent CLIProxyAPI management with secure connection settings, OAuth account-pool controls, live quota refresh, and a native single-instance Group Router plugin enforcing client-key-to-credential-pool isolation without coupling to Sub2API groups.

### Changed

- Repository naming aligned to `sub2api-mobile` in public docs.
- Request URL composition in `src/lib/admin-fetch.ts` now handles duplicated `/api`/`/api/v1` prefixes safely.
- Better admin request error handling for invalid server responses.
- Server settings screen removed the "current compatible sub2api version" display block.
