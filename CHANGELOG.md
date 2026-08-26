# Changelog

## 2.33.0 - Unreleased

### Added

- Telegram API Layer 229 from immutable Telegram Desktop schema commit
  `11d18d829b25d583f2e3058663b522a528fde51a`.
- Protocol coverage for Layer 229 constructor changes and typed keyboard and
  inline button wrappers.

### Fixed

- Public button helpers, reply markup construction, message button accessors,
  and button clicks use the Layer 229 button model.
- Community entities resolve through public peer, dialog, notification, and
  cache helpers.
- Custom messages retain Layer 228 Rich Message payloads.
- Compatible dependency updates remove all reported audit findings and the
  temporary development exception.

### Changed

- Package and runtime versions are aligned at `2.33.0`.
- Inline and keyboard rows now use their distinct Layer 229 constructors.

## 2.32.0 - 2026-07-27

### Added

- Telegram API Layer 228 from immutable Telegram Desktop schema commit
  `138b937f01a275000fb2e06b3d5b864f5b78cc81`.
- Schema hash lock, generated-artifact manifest, deterministic Git package
  build, root package smoke test, and future-layer freshness check.
- Offline semantic-diff verification for every Layer 224→228 transition,
  including explicit rejection of unapproved removals.
- Protocol regression coverage for changed constructors, global search,
  message serialization across source/root/tarball/Git consumers, polls, and
  Layer 228 community unions.
- Node.js 20 and 24 CI matrix with pinned GitHub Actions.
- Installed-tarball and exact temporary-Git-commit consumer smoke coverage,
  plus enforced release-tag/version matching.

### Fixed

- Clean installation with TypeScript 5.9-compatible documentation tooling.
- Quiz media conversion now emits zero-based correct-answer indices.
- Poll clicks narrow the `PollAnswer` union before accessing option bytes.
- Custom messages preserve real media and discard `MessageMediaEmpty`.
- Dialog and participant iterators handle `DialogCommunity` and
  `CommunityFull`.
- Browser inspection uses a symbol instead of an empty-string property and the
  browser build no longer mutates repository configuration.
- Production dependency advisories in `socks` and `store2`.
- Development-only audit exceptions are machine-checked and time-bounded.

### Changed

- Package and runtime versions are aligned at `2.32.0`.
- Repository metadata now points to `TONresistor/gramjs`.
- `messages.ImportChatInvite` and `channels.JoinChannel` now return
  `messages.ChatInviteJoinResult`. Consumers must unwrap
  `ChatInviteJoinResultOk.updates`; the web-view variant has no `updates`.
