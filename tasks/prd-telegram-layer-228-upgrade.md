# PRD: Upgrade TONresistor/gramjs to Telegram API Layer 228

## Status

- Planning date: 2026-07-27
- Target repository: `TONresistor/gramjs`
- Local checkout: `/Users/macbookpro/repo/gramjs`
- Current fork commit: `fab33c216ef035f9bab24682eecac1ebb33c36d0`
- Current runtime layer: 224
- Target layer: 228
- Current Teleton dependency: exact pin to `fab33c216ef035f9bab24682eecac1ebb33c36d0`
- Recommended delivery: update the fork, validate it as a local package in Teleton, test a reversible production snapshot, then commit/push and update Teleton's immutable pin
- Review status: source provenance and upgrade sequence double-checked against
  the complete Layer 224 to 228 history on 2026-07-27

This document is an implementation plan. It does not authorize a production
deployment, npm publication, package migration, or Telegram write operation.

## 1. Introduction

Upgrade the maintained `TONresistor/gramjs` fork from Telegram API Layer 224 to
Layer 228 while preserving the npm package name `telegram` and existing GramJS
imports.

The update must cover more than copying `api.tl`. The fork is consumed directly
from GitHub, so compiled JavaScript and declarations stored at the repository
root are part of the production artifact. Source TL files, generated types,
compiled output, version constants, documentation, and CI must remain in lockstep.

The old `gram-js/gramjs` project is archived. `teleproto` is useful as a reference
for Layer 228 compatibility fixes, but migrating Teleton to `teleproto` is not part
of this upgrade.

## 2. Evidence and Current Baseline

### 2.1 Schema source

Use the immutable Telegram Desktop schema revision as the source of truth:

- Repository: `telegramdesktop/tdesktop`
- Commit: `138b937f01a275000fb2e06b3d5b864f5b78cc81`
- Commit date: 2026-07-10
- Commit subject: `Update API scheme on layer 228.`
- API path: `Telegram/SourceFiles/mtproto/scheme/api.tl`
- API SHA-256:
  `bbddd9c4c3f5ff16fd4abbf39f2a864fdac7553e9f05b6bf9ead2aeb9c8eb566`
- MTProto path: `Telegram/SourceFiles/mtproto/scheme/mtproto.tl`
- MTProto SHA-256:
  `40c10255afb6cfcbcfc190a457a53b66ec9e410f6418cd97cc4c276709a739a9`

The fork's `schema.tl` already matches the current MTProto definitions; it only
lacks the final newline present in the canonical file.

Source precedence for this upgrade:

1. immutable Telegram Desktop `api.tl` and `mtproto.tl` commits for exact schema
   bytes and constructor IDs;
2. `core.telegram.org` method, constructor, and layer pages for protocol
   semantics when the relevant layer is documented;
3. `teleproto` only as an independent implementation reference for compatibility
   guards;
4. Context7 only as secondary library documentation.

`core.telegram.org/schema` currently displays Layer 223 and
`core.telegram.org/api/layers` currently documents Layer 225. They must not be
used as the byte source for Layer 228. Telegram Desktop is first-party Telegram
schema history, while `teleproto` is not a source of truth.

### 2.2 Layer-by-layer trace

The final Layer 228 schema is cumulative and must be imported directly. However,
the semantic review must preserve the intermediate trace:

| Transition | Immutable Telegram Desktop commit | Added | Removed | Modified | Changed IDs | Teleton-used APIs changed |
|---|---|---:|---:|---:|---:|---:|
| 224 to 225 | `bff17504bc96df235559211d97ea616506f22889` | 26 | 0 | 6 | 3 | 4 |
| 225 to 226 | `5c5bacaf419ecf16c57d20517bd2231d17f8f8af` | 21 | 0 | 11 | 9 | 4 |
| 226 to 227 | `8165c7c6c065c8abc94ec5076f75bee0a29b82e1` | 34 | 0 | 18 | 14 | 4 |
| 227 to 228 | `138b937f01a275000fb2e06b3d5b864f5b78cc81` | 39 | 0 | 8 | 5 | 5 |

Transition counts intentionally do not sum to every cumulative distinct count:
some definitions, IDs, and Teleton-used APIs changed in more than one layer.

The cumulative Layer 224 to Layer 228 audit found:

- 2,329 definitions at Layer 224
- 2,449 definitions at Layer 228
- 120 added definitions
  - 83 constructors/types
  - 37 functions
- 0 removed definitions
- 35 modified definitions
- 26 changed constructor IDs

Notable attribution:

- `messages.ImportChatInvite` and `channels.JoinChannel` acquire
  `messages.ChatInviteJoinResult` at Layer 226.
- `messages.SendMessage`, `messages.EditMessage`, and
  `messages.EditInlineBotMessage` change at Layer 227.
- `messages.SearchGlobal` gains `community` and changes ID at Layer 228.

The existing generator successfully parses the raw Layer 228 schema and emits
the new declarations. This proves basic generator compatibility, but the
generated union types expose source-level compatibility work.

### 2.3 Teleton impact surface

Static analysis found 13 changed Layer 228 API definitions referenced directly
by Teleton:

| API | Relevant change |
|---|---|
| `Api.User` | New guest-chat, guard, and linked-community fields; constructor ID changed |
| `Api.Channel` | New linked-community field; constructor ID changed |
| `Api.ChannelFull` | New guard bot field; constructor ID changed |
| `Api.Message` | New guest-chat and rich-message fields; constructor ID changed |
| `Api.Poll` | New subscriber/country fields; constructor ID changed |
| `Api.ChatBannedRights` | New reaction and linked-peer rights |
| `Api.messages.SendMessage` | Optional rich message; constructor ID changed |
| `Api.messages.ImportChatInvite` | Return type changed to `messages.ChatInviteJoinResult` |
| `Api.messages.SearchGlobal` | Optional `community`; ID `4bc6589a` to `6126a43c` |
| `Api.messages.EditMessage` | Optional rich message; constructor ID changed |
| `Api.messages.EditInlineBotMessage` | Optional rich message; constructor ID changed |
| `Api.channels.JoinChannel` | Return type changed to `messages.ChatInviteJoinResult` |
| `Api.channels.GetAdminedPublicChannels` | Optional community flag |

No API referenced by Teleton was removed.

The highest-risk downstream behavior is private invite joining:
`telegram_join_channel` currently extracts joined chat data only from
`Api.Updates` or `Api.UpdatesCombined`. Layer 228 can return a
`messages.ChatInviteJoinResult`, so the tool must support every result variant
without falsely reporting a successful join with missing chat metadata.

### 2.4 Existing fork health gaps

A clean dependency install currently fails:

```text
npm ci
ERESOLVE: TypeScript 5.9.3 conflicts with TypeDoc 0.22.18
```

`npm ci --legacy-peer-deps` installs, but the baseline is not green:

- `npx tsc --noEmit`: 2 errors
  - poll answer union mismatch in `tl/custom/message.ts`
  - Layer 224 quiz `correctAnswers` changed to numeric indices, while
    `Utils.ts` still forwards byte options
- `npm test`: all 7 suites fail during TypeScript compilation
  - the two errors above
  - a DOM/Node `setTimeout().unref()` typing conflict
- `npm audit`: 17 total findings
- `npm audit --omit=dev`: 3 moderate production findings
  - `socks` via `ip-address`
  - `store2`
  - fixes are available

After generating Layer 228 types in an isolated spike, TypeScript additionally
reports:

- `Api.CommunityFull` broadens the full-chat union
- `Api.DialogCommunity` broadens dialog unions
- existing dialog pagination assumes every dialog has `peer` and `topMessage`

The exact Layer 228 guards needed for these unions are already proven in
`teleproto` commit `ce0f2005cf0fa37a5fee8ff96c3e23abc3fd8b96`.
Only the small compatibility idea should be adapted; unrelated `teleproto`
refactors must not be imported.

### 2.5 Generated-artifact drift

The repository currently reports three different layers:

- `FORK.md`: 222
- root `tl/AllTLObjects.d.ts`: 223
- source and runtime JavaScript: 224

Other drift:

- package version: `2.27.0`
- runtime `Version.ts`: `2.31.0`
- `UPDATING.md` points to an obsolete Telegram Desktop path
- `package.json` repository, issue, and homepage metadata still point to the
  archived upstream
- the documented build relies on manual copies
- CI runs only `npm ci` and `npm test`
- GitHub currently records no workflow runs for this fork
- `master` has no branch protection

The fork history proves this drift is recurrent:

- Layer 222 updated only source artifacts.
- A later commit added precompiled JavaScript for Git dependency consumers.
- Layer 223 updated source and root compiled artifacts.
- Layer 224 omitted the root `tl/AllTLObjects.d.ts`, leaving the current
  Layer 223/224 mismatch.

This makes a clean staged build and generated-artifact drift gate mandatory.

### 2.6 Supported consumer runtime

- Fork audit runtime: Node 20
- Teleton declared runtime: Node 22, 24, or 26+
- Current `gton` production runtime: Node 24.18.0

The fork CI must therefore validate Node 20 and Node 24 at minimum.

## 3. Goals

- Ship a correct Layer 228 schema and runtime registry.
- Preserve package name `telegram` and current GramJS import paths.
- Preserve existing Teleton search, messaging, bot, gift, poll, and session
  behavior.
- Make a clean checkout install without `--legacy-peer-deps`.
- Make source generation and root compiled artifacts deterministic.
- Make CI detect layer, schema, declaration, and compiled-output drift.
- Validate the built package as a real Teleton dependency before changing the
  immutable Git pin.
- Provide a reversible pre-commit production validation path.
- Leave the known Layer 224 commit usable as an immediate rollback.

## 4. Non-Goals

- No migration from `telegram` to `teleproto`.
- No broad import rewrite in Teleton.
- No automatic adoption of every new Layer 228 feature.
- No new Telegram community, guest-chat, ephemeral-message, rich-message, or AI
  compose product tools in this upgrade.
- No npm publication unless explicitly selected.
- No direct push to `master` before local and Teleton integration checks pass.
- No Telegram channel join, message send, inline edit, or other external write
  during automated tests.
- No production mutation without a separate explicit go.
- No unrelated GramJS modernization or mass reformatting.

## 5. Architecture and Invariants

### 5.1 Source of truth

`gramjs/tl/static/api.tl` and `gramjs/tl/static/schema.tl` are canonical inputs.
All generated TypeScript declarations, embedded TL JavaScript, runtime layer
constants, and root compiled artifacts derive from them.

Add a machine-readable schema lock, for example:

```json
{
  "layer": 228,
  "repository": "telegramdesktop/tdesktop",
  "commit": "138b937f01a275000fb2e06b3d5b864f5b78cc81",
  "apiPath": "Telegram/SourceFiles/mtproto/scheme/api.tl",
  "apiSha256": "bbddd9c4c3f5ff16fd4abbf39f2a864fdac7553e9f05b6bf9ead2aeb9c8eb566",
  "mtprotoPath": "Telegram/SourceFiles/mtproto/scheme/mtproto.tl",
  "mtprotoSha256": "40c10255afb6cfcbcfc190a457a53b66ec9e410f6418cd97cc4c276709a739a9"
}
```

### 5.2 Generated-output rule

Generated files are never edited manually. A single command must:

1. validate the schema lock and hashes;
2. extract `// LAYER 228`;
3. generate source declarations and embedded TL definitions;
4. generate the runtime layer constant;
5. compile the git-consumable root package in a staging directory;
6. validate the staged package;
7. synchronize compiled artifacts only after all prior steps succeed.

Running this command twice must produce no diff.

The drift check must regenerate in a clean temporary copy and compare an explicit
manifest of tracked generated artifacts. Identical hashes, not only a visually
clean workspace, are required; ignored or stale files must not influence the
result.

### 5.3 Git dependency rule

Teleton consumes the repository root through a Git dependency. The following
root artifacts are therefore release-critical:

- `index.js` and `index.d.ts`
- compiled module directories such as `client/`, `events/`, `network/`, and
  `tl/`
- root `tl/apiTl.js`, `tl/schemaTl.js`, and `tl/api.d.ts`
- root `tl/AllTLObjects.js` and `tl/AllTLObjects.d.ts`
- package metadata

CI must test the root package, not only `gramjs/**/*.ts`.

Two consumer paths must be validated:

1. an `npm pack` tarball installed in an empty fixture, to validate package
   contents;
2. the repository root installed as an exact Git dependency, to reproduce
   Teleton's actual install path.

Before a commit exists, the tarball is the reversible test artifact. After push,
`github:TONresistor/gramjs#<commit>` is the final authoritative consumer test.

### 5.4 Version rule

Recommended fork release version: `2.32.0`.

The repository currently has `package.json` at `2.27.0` but runtime
`Version.ts` at `2.31.0`. Using `2.28.0` would make the exported library version
move backwards. Layer 228 is an additive protocol/API update, so the safest
SemVer repair is the next minor after the highest existing library version:
`2.32.0`.

The following must agree:

- `package.json`
- `package-lock.json`
- `gramjs/Version.ts`
- compiled `Version.js`
- compiled `Version.d.ts`
- `FORK.md`
- `CHANGELOG.md`

The Telegram Layer remains a separate value and must always come from the TL
schema, not from the npm version.

Adopting a layer-encoded version such as `2.228.0` is a separate versioning-policy
change and is not recommended inside this maintenance release.

## 6. User Stories

### US-001: Establish a green, reproducible baseline

**Description:** As the fork maintainer, I need clean installs, typechecks, and
tests to work before changing the protocol schema so that new failures can be
attributed correctly.

**Acceptance Criteria:**

- [ ] `npm ci` succeeds without `--legacy-peer-deps`.
- [ ] TypeDoc and its plugin support TypeScript 5.9.
- [ ] Node typings match the supported Node 20 baseline.
- [ ] `sleep(..., true)` uses a runtime-safe `unref` guard and compiles with
      browser and Node libraries.
- [ ] Quiz conversion maps correct answers to documented zero-based numeric
      answer indices.
- [ ] Poll click logic narrows `Api.TypePollAnswer` before reading `.option`.
- [ ] Unit tests cover quiz answer-index conversion.
- [ ] `npm run typecheck` passes on the Layer 224 baseline.
- [ ] All existing Jest suites pass on the Layer 224 baseline.
- [ ] Baseline fixes are isolated from the Layer 228 schema commit.

### US-002: Make schema generation deterministic

**Description:** As the fork maintainer, I want one deterministic generation
pipeline so that source, declarations, compiled output, and layer constants
cannot drift.

**Acceptance Criteria:**

- [ ] Add a schema lock containing the exact source commit and SHA-256 hashes.
- [ ] `npm run generate:tl` validates both schema files against the lock.
- [ ] The generator rejects a missing or ambiguous `// LAYER N` marker.
- [ ] The layer constant is generated from the schema marker.
- [ ] The generator produces `gramjs/tl/api.d.ts`, `apiTl.js`, and
      `schemaTl.js`.
- [ ] A separate staged build produces the Git-consumable root artifacts.
- [ ] The staged root package can be loaded with `require()`.
- [ ] `npm run check:generated` exits non-zero if committed generated files
      differ from regenerated output.
- [ ] The drift check runs in a clean temporary copy against an explicit
      generated-artifact manifest.
- [ ] Two consecutive generations produce identical hashes and an empty Git
      diff.
- [ ] The build never leaves partially synchronized root artifacts after a
      compilation failure.

### US-003: Import Layer 228 from an immutable Telegram source

**Description:** As the fork maintainer, I want the exact first-party Layer 228
schema snapshot so that constructor IDs and field layouts match Telegram.

**Acceptance Criteria:**

- [ ] `api.tl` comes from Telegram Desktop commit
      `138b937f01a275000fb2e06b3d5b864f5b78cc81`.
- [ ] API SHA-256 equals
      `bbddd9c4c3f5ff16fd4abbf39f2a864fdac7553e9f05b6bf9ead2aeb9c8eb566`.
- [ ] MTProto SHA-256 equals
      `40c10255afb6cfcbcfc190a457a53b66ec9e410f6418cd97cc4c276709a739a9`.
- [ ] Schema tail is exactly `// LAYER 228`.
- [ ] Generator reports 2,449 definitions.
- [ ] A committed semantic-diff report records all four transitions and the
      cumulative `+120 / -0 / 35 modified / 26 changed IDs`.
- [ ] Generator reports zero definitions removed from Layer 224.
- [ ] All source and compiled layer exports equal 228.
- [ ] `Api.messages.SearchGlobal.CONSTRUCTOR_ID >>> 0` equals `0x6126a43c`.
- [ ] The new optional `community` argument is present in generated types.

### US-004: Adapt GramJS high-level code to Layer 228 unions

**Description:** As a library consumer, I need high-level helpers to tolerate new
Layer 228 union members without crashing or reading fields that do not exist.

**Acceptance Criteria:**

- [ ] Participants iteration reads `participantsCount` only from
      `Api.ChannelFull`.
- [ ] Dialog iteration explicitly skips or handles `Api.DialogCommunity`.
- [ ] Dialog pagination does not access `peer` or `topMessage` on a community
      dialog.
- [ ] Tests cover mixed dialog arrays containing `DialogCommunity`.
- [ ] Tests cover a full-chat response containing `CommunityFull`.
- [ ] No unsafe blanket cast is used to silence these union errors.
- [ ] `npm run typecheck` passes against generated Layer 228 types.
- [ ] Existing unit tests pass.

### US-005: Validate protocol-critical constructor changes

**Description:** As a maintainer, I want focused regression tests around changed
constructors so that a green generic unit suite cannot hide a wire-level mismatch.

**Acceptance Criteria:**

- [ ] Assert Layer 228 constructor IDs for `User`, `Channel`, `Message`, and
      `messages.SearchGlobal`.
- [ ] Serialize `messages.SearchGlobal` with the exact argument shape used by
      Teleton.
- [ ] Serialize `messages.SendMessage`, `messages.EditMessage`, and
      `messages.EditInlineBotMessage` without their new optional rich-message
      field.
- [ ] Validate deserialization or registry lookup for changed constructor IDs.
- [ ] Confirm the superseded IDs of the 26 changed definitions are not
      registered under their old definition names in the Layer 228 runtime
      registry.
- [ ] Test both source imports and root package imports.
- [ ] No live Telegram credentials are required for these tests.

### US-006: Harden package and CI quality gates

**Description:** As the fork maintainer, I want every push and pull request to
prove that the exact Git dependency artifact is usable.

**Acceptance Criteria:**

- [ ] Add scripts for `generate:tl`, `build:git`, `typecheck`,
      `check:generated`, and `test:ci`.
- [ ] Pin the supported package-manager version through `packageManager` and CI.
- [ ] CI runs on Node 20 and Node 24.
- [ ] CI runs `npm ci`, schema verification, generation drift check, typecheck,
      unit tests, root-package smoke tests, and pack/dry-run validation.
- [ ] CI verifies the browser bundle because the package advertises browser
      support; removing that support requires a separate explicit decision.
- [ ] CI has explicit timeouts and least-privilege permissions.
- [ ] GitHub Actions are updated and pinned to reviewed immutable revisions.
- [ ] Release jobs run only from explicit version tags.
- [ ] No npm publish occurs from the ordinary CI workflow.
- [ ] The current fixable production findings are remediated.
- [ ] `npm audit --omit=dev --audit-level=high` is a blocking release gate;
      the full audit report remains visible for lower-severity review.
- [ ] No high or critical vulnerability remains without a documented,
      time-bounded exception.
- [ ] The first new CI run is observed green before merging to `master`.

### US-007: Correct Layer 228 downstream behavior in Teleton

**Description:** As the Teleton operator, I need the upgraded fork to compile and
behave correctly across all Telegram tools before changing the production pin.

**Acceptance Criteria:**

- [ ] Create a package tarball from the local fork and install it into a
      disposable Teleton worktree or archive.
- [ ] After the fork commit is pushed, repeat the disposable install using the
      exact `github:TONresistor/gramjs#<commit>` dependency form.
- [ ] Do not alter the real Teleton lockfile during the initial integration
      spike.
- [ ] Run `npm run build:sdk`.
- [ ] Run `npm run typecheck`.
- [ ] Run the full Vitest suite.
- [ ] Run `npm run build`.
- [ ] Focused tests cover global search, post search, cursor pagination, poll
      creation, join by public username, and join-result parsing.
- [ ] `telegram_join_channel` handles every Layer 228
      `messages.ChatInviteJoinResult` variant.
- [ ] Existing search behavior remains unchanged when `community` is omitted.
- [ ] No new community filter is exposed in the Teleton tool during this upgrade.
- [ ] Bot-client inline edit types compile with the changed constructor.
- [ ] No existing `from "telegram"` import path changes.

### US-008: Perform a reversible pre-commit production validation

**Description:** As the operator, I want to test the exact uncommitted fork build
on `gton` before accepting commits, with a fast rollback.

**Acceptance Criteria:**

- [ ] Build a local `telegram-2.32.0.tgz` from the validated fork.
- [ ] Vendor that tarball only into an isolated Teleton staging snapshot.
- [ ] The staging snapshot references the local tarball, not an unpushed Git
      hash.
- [ ] Build and test the staging snapshot before service interruption.
- [ ] Save a timestamped rollback copy of the current production source.
- [ ] Atomically swap `/opt/teleton-agent` only after staging validation.
- [ ] Preserve `/var/lib/teleton` and `/var/lib/teleton-codex`.
- [ ] Verify the deployed package reports version `2.32.0` and Layer 228.
- [ ] Verify `teleton.service` is active and `NRestarts=0`.
- [ ] Verify user and bot Telegram clients reconnect successfully.
- [ ] Run read-only smoke tests for global search, public post search, dialogs,
      history, and read-only gift endpoints.
- [ ] Run a minimal protocol handshake smoke (`connect`, `getMe`,
      `help.GetConfig`) and parse changed `User`, `Channel`, and `Message`
      constructors before the wider Teleton smoke.
- [ ] Reuse an existing authorized session without starting a new login and
      never print API credentials or serialized session material.
- [ ] Any write smoke test is confined to Saved Messages or a dedicated test
      chat and requires explicit approval.
- [ ] Rollback restores Layer 224 commit `fab33c2` without database changes.

### US-009: Finalize immutable pins after user acceptance

**Description:** As the maintainer, I want the tested artifact to become
reproducible from Git after the production behavior is accepted.

**Acceptance Criteria:**

- [ ] Commit the fork in small logical commits.
- [ ] Push only after all fork and Teleton validation gates pass.
- [ ] Record the final immutable fork commit.
- [ ] Change Teleton's `package.json` and lockfile to that exact commit.
- [ ] Re-run the full Teleton validation pipeline from a clean install.
- [ ] Confirm the Git-built dependency matches the accepted tarball by generated
      artifact hashes.
- [ ] Commit the Teleton pin separately.
- [ ] Redeploy the immutable build and re-run production health checks.
- [ ] Keep the Layer 224 production rollback until the Layer 228 observation
      window has passed.

### US-010: Detect future layer drift

**Description:** As the fork maintainer, I want a low-risk freshness signal so
that future Telegram layer releases are visible without silently modifying code.

**Acceptance Criteria:**

- [ ] Add a read-only script that compares the locked layer with Telegram
      Desktop `dev`.
- [ ] A scheduled or manually dispatched workflow reports when a newer layer
      exists.
- [ ] The freshness check never commits or merges generated code automatically.
- [ ] Network failure is reported distinctly from “new layer available.”
- [ ] Updating the lock still requires a reviewed implementation change.

## 7. Functional Requirements

- **FR-1:** The package name must remain `telegram`.
- **FR-2:** Existing subpath imports such as `telegram/sessions/index.js`,
  `telegram/events/index.js`, and `telegram/Password.js` must remain valid.
- **FR-3:** The runtime must advertise Telegram API Layer 228.
- **FR-4:** The schema source commit and content hashes must be recorded.
- **FR-5:** Generation must fail if schema content does not match its lock.
- **FR-6:** Generation must derive the layer value from the schema.
- **FR-7:** All generated source and compiled outputs must be reproducible.
- **FR-8:** A clean checkout must install without legacy peer dependency flags.
- **FR-9:** The root Git package must load under Node 20 and Node 24.
- **FR-10:** Existing Layer 224 calls must remain valid when new Layer 228
  arguments are optional.
- **FR-11:** New Layer 228 union members must be narrowed explicitly.
- **FR-12:** Teleton global search must keep its current pagination and sorting
  semantics when no community is provided.
- **FR-13:** Teleton invite joining must parse Layer 228 join results.
- **FR-14:** Automated tests must not mutate Telegram state.
- **FR-15:** Production validation must support a local uncommitted tarball.
- **FR-16:** Final Teleton delivery must pin an immutable Git commit.
- **FR-17:** Rollback must not modify or restore application databases.
- **FR-18:** Package repository, issue, and homepage metadata must point to
  `TONresistor/gramjs`.
- **FR-19:** `FORK.md`, `UPDATING.md`, and `CHANGELOG.md` must describe the
  actual Layer 228 workflow.
- **FR-20:** Security lockfile updates for `socks` and `store2` must be included
  or explicitly justified.
- **FR-21:** A machine-readable semantic diff must retain the 224-to-228
  transition evidence and fail on an unexpected removal.
- **FR-22:** Package version and Telegram layer must remain distinct and all
  version exports must agree on `2.32.0`.
- **FR-23:** Final validation must exercise the exact Git dependency form used
  by Teleton, not only an npm tarball.
- **FR-24:** Live smoke scripts must be read-only by default, rate-limited, and
  must never log credentials or Telegram sessions.

## 8. Recommended Implementation Sequence

### Phase 0: Branch and preserve the rollback baseline

1. Fetch `origin` and verify `master` still equals `fab33c2`.
2. Create `feat/layer-228`.
3. Record current source and root package hashes.
4. Keep the original Teleton pin unchanged.

Exit gate: clean feature branch based exactly on the currently pinned Layer 224
fork. Live production parity is verified separately before staging deployment.

### Phase 1: Repair the Layer 224 baseline

1. Upgrade TypeDoc to a TypeScript 5.9-compatible release and update its plugin.
2. Align `ts-jest` and Node 20 typings without changing the runtime API.
3. Pin the package-manager version used by developers and CI.
4. Fix timer typing with a runtime-safe `unref` check.
5. Convert quiz correct answers to zero-based numeric indices.
6. Narrow poll answer unions.
7. Add focused unit tests.
8. Refresh the lockfile, including fixed `socks` and `store2`.

Exit gate: clean install, typecheck, tests, and production dependency audit are
green on Layer 224.

### Phase 2: Replace the manual build process

1. Add schema lock verification.
2. Add deterministic layer extraction.
3. Add explicit npm scripts.
4. Build compiled output into a temporary/staging directory.
5. Validate staged output before syncing tracked root artifacts.
6. Add an explicit generated-artifact manifest.
7. Add clean-copy idempotency and drift checks.

Exit gate: regenerate twice with zero diff; root package loads in a clean
consumer fixture.

### Phase 3A: Import and audit the cumulative Layer 228 schema

1. Replace both TL schemas with the immutable Telegram Desktop files.
2. Verify the locked content hashes before generation.
3. Generate and review the semantic diff for 224→225→226→227→228.
4. Confirm the cumulative counts and zero removals.

Exit gate: exact first-party Layer 228 bytes and an explainable semantic diff.

### Phase 3B: Regenerate protocol artifacts

1. Regenerate types, embedded definitions, registry, and layer constants.
2. Compile source and root artifacts in staging.
3. Run constructor ID, registry, serialization, and generated-drift tests.

Exit gate: every generated artifact agrees on Layer 228 before high-level code
is changed.

### Phase 3C: Adapt high-level GramJS behavior

1. Adapt `ChannelFull | CommunityFull`.
2. Adapt `Dialog | DialogFolder | DialogCommunity`.
3. Fix remaining errors through real narrowing, not blanket casts.
4. Add focused union and pagination regressions.

Exit gate: Layer 228 source typecheck and unit tests are green.

### Phase 4: Synchronize and validate the Git package

1. Generate root compiled JS and declarations.
2. Assert all layer constants equal 228.
3. Assert source and root schema hashes match.
4. Run root import and constructor serialization smoke tests.
5. Run `npm pack --json`, inspect the exact file list, and install the tarball
   in an empty consumer fixture.
6. Install the repository from an exact temporary Git commit in a second empty
   fixture.
7. Build and smoke-test the browser bundle.

Exit gate: the repository root is a self-contained, reproducible Git dependency.

### Phase 5: CI and documentation

1. Add Node 20/24 CI matrix.
2. Add generated drift, typecheck, test, package, and audit gates.
3. Harden workflow permissions and action pinning.
4. Rewrite `UPDATING.md` with immutable source paths and exact commands.
5. Update `FORK.md`, package metadata, version files, and changelog.
6. Add a read-only future-layer freshness workflow.

Exit gate: the first actual GitHub Actions run is green.

### Phase 6: Disposable Teleton integration

1. Pack the local fork.
2. Install it in a disposable Teleton checkout.
3. Run SDK build, typecheck, all tests, and full build.
4. Fix only demonstrated downstream Layer 228 incompatibilities.
5. Verify the 13 changed direct API usages.

Exit gate: Teleton is fully green with the local package and the real Teleton
checkout remains untouched.

### Phase 7: Reversible `gton` test before commit

1. Build an isolated Teleton staging snapshot with the local fork tarball.
2. Validate staging completely.
3. Create a timestamped source rollback.
4. Atomically deploy the staging snapshot.
5. Run the minimal read-only protocol handshake with a pre-existing session.
6. Verify runtime, logs, Layer 228, Telegram connections, and read-only tools.
7. Let the user perform the concrete Telegram behavior tests.
8. Roll back immediately if any regression appears.

Exit gate: explicit user acceptance of real behavior.

### Phase 8: Commit, push, pin, and immutable redeploy

Recommended commit boundaries:

1. `fix: restore reproducible gramjs baseline`
2. `build: make TL generation deterministic`
3. `feat: update Telegram API to layer 228`
4. `ci: verify generated git package`
5. `docs: document TONresistor fork maintenance`

Then:

1. Push the fork feature branch.
2. Observe green CI.
3. Merge or fast-forward according to the selected workflow.
4. Install the exact pushed fork commit in a disposable Teleton checkout.
5. Compare generated-artifact hashes with the accepted tarball.
6. Pin Teleton to the final fork commit.
7. Validate clean installs again.
8. Commit the Teleton pin separately.
9. Redeploy and confirm parity with the accepted test snapshot.

## 9. Verification Matrix

| Gate | Node 20 | Node 24 | No Telegram credentials | Live Telegram |
|---|---:|---:|---:|---:|
| Clean install | Required | Required | Yes | No |
| Schema/hash verification | Required | Required | Yes | No |
| Layer semantic-diff verification | Required | Required | Yes | No |
| Generator idempotency | Required | Required | Yes | No |
| Typecheck | Required | Required | Yes | No |
| GramJS unit tests | Required | Required | Yes | No |
| Root package smoke | Required | Required | Yes | No |
| Tarball consumer fixture | Required | Required | Yes | No |
| Exact Git dependency fixture | Required | Required | Yes | No |
| Constructor serialization | Required | Required | Yes | No |
| Browser bundle | One matrix job | One matrix job | Yes | No |
| Teleton SDK/typecheck/tests/build | Optional | Required | Yes | No |
| Protocol handshake and changed-constructor parse | No | Production Node | No | Read-only |
| Search/history smoke | No | Production Node | No | Read-only |
| Saved Messages write smoke | No | Production Node | No | Explicit approval |
| Inline bot edit smoke | No | Production Node | No | Dedicated test only |

## 10. Production Smoke Checklist

### Read-only checks

- service active
- `NRestarts=0`
- no fresh uncaught exception or TL constructor error
- runtime version `2.32.0`
- runtime Layer 228
- Telegram user client connected
- Telegram bot client connected
- `telegram_search_global` keyword search
- `telegram_search_global` next-cursor request
- `telegram_search_posts`
- message history and reply retrieval
- admined public channels listing
- read-only gift endpoints

### Optional controlled write checks

Only after explicit approval:

- send a tagged message to Saved Messages
- edit the tagged message
- schedule a tagged message
- list and delete the scheduled message
- quote-reply inside Saved Messages
- inline bot edit in a dedicated bot test flow

Joining a real channel or consuming an invite must not be used as a generic smoke
test. If join behavior requires validation, use a dedicated disposable test group.

## 11. Rollback Plan

### Before the fork is committed

- Restore the timestamped `/opt/teleton-agent` source backup.
- Restart `teleton.service`.
- Verify active state, `NRestarts=0`, Layer 224, and Telegram connectivity.
- Keep mutable state directories untouched.

### After immutable pins are committed

- Revert Teleton's dependency pin to
  `fab33c216ef035f9bab24682eecac1ebb33c36d0`.
- Restore the matching lockfile.
- Rebuild from a clean install.
- Deploy using the normal atomic source swap.

No database migration is required for this library upgrade, so rollback must not
restore or overwrite SQLite data.

## 12. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Wrong constructor ID or field order | Critical | Immutable official schema, hash lock, constructor serialization tests |
| Documentation lags the deployed schema | High | Telegram Desktop immutable schema bytes take precedence over lagging docs |
| Source and root package drift | High | Staged deterministic build and CI `git diff --exit-code` |
| Community union crashes dialog iteration | High | Explicit guards plus mixed-union tests |
| Invite join result silently loses chat data | High | Downstream result-variant tests in Teleton |
| Tests appear green only in source tree | High | Root Git-package consumer fixture |
| Browser build regresses | Medium | Required bundle build and consumer smoke while support is advertised |
| Dependency cleanup expands scope | Medium | Minimal compatible upgrades; isolate baseline commit |
| Live Telegram write mutates real state | Medium | Read-only default; Saved Messages/dedicated test only |
| Pre-commit prod build cannot be reproduced | Medium | Hash the local tarball; compare with final Git build |
| Tarball passes but Git dependency differs | High | Test both consumer paths and repeat against the exact pushed commit |
| Version appears to move backward | High | Reconcile every version export at `2.32.0`; keep Layer 228 separate |
| Live smoke leaks or invalidates a session | High | Existing session only, read-only calls, redacted logs, no login flow |
| Future Telegram schema syntax breaks parser | Medium | Parser fixture and explicit freshness alert, never auto-merge |
| `teleproto` changes are copied blindly | Medium | Adapt only demonstrated Layer 228 compatibility fixes |

## 13. Success Metrics

- One authoritative Layer value: 228 everywhere.
- Clean `npm ci` succeeds without legacy flags.
- Node 20 and Node 24 CI are green.
- Generator and compiled artifacts are idempotent.
- All GramJS tests and Teleton tests pass.
- No fixable production dependency vulnerability remains.
- All 13 changed Teleton API usages compile and have relevant coverage.
- Global search and post search preserve behavior and pagination.
- Production reaches active state with zero restart loop.
- Rollback to Layer 224 is documented, staged, and does not touch databases.
- Final Teleton dependency is an immutable fork commit, not a branch name.

## 14. Open Decisions

Recommended defaults are marked **A**.

1. **Scope**
   - **A.** Layer 228 plus deterministic generation and future-layer detection
   - B. Layer 228 only
   - C. Migrate to `teleproto`

2. **Distribution**
   - **A.** Git commit pin consumed by Teleton
   - B. npm publication
   - C. Both Git pin and npm publication

3. **Real validation**
   - **A.** Local tests followed by a reversible `gton` snapshot
   - B. Local tests only
   - C. Separate Telegram staging account/environment

4. **Community search**
   - **A.** Keep the new `community` argument internal and out of Teleton scope
   - B. Expose it as a new Teleton search filter in the same delivery

5. **Versioning**
   - **A.** Preserve SemVer and reconcile all library versions at `2.32.0`
   - B. Adopt a documented `MAJOR.LAYER.PATCH` policy as a separate change,
     then use `2.228.0`

## 15. Definition of Done

The upgrade is complete only when:

1. the fork clean-installs, generates, typechecks, tests, and packages on Node 20
   and Node 24;
2. all source and root artifacts agree on Layer 228 and version `2.32.0`;
3. the root Git dependency passes a disposable Teleton full build and test run;
4. real read-only Telegram behavior is validated on the reversible production
   snapshot;
5. the user accepts the observed behavior;
6. the fork is committed and pushed with green CI;
7. Teleton is pinned to the exact tested fork commit;
8. the immutable production deployment is healthy; and
9. the Layer 224 rollback remains available through the observation window.

## 16. Best-Practice Decision Record

The implementation order is intentionally:

1. restore a green Layer 224 baseline;
2. make generation deterministic;
3. import and audit the exact cumulative Layer 228 schema;
4. regenerate all protocol artifacts without manual edits;
5. adapt high-level unions exposed by generated types;
6. validate source, root package, tarball, browser, and exact Git dependency;
7. integrate into disposable Teleton;
8. test a reversible local-tarball snapshot on `gton`;
9. only after acceptance, commit, push, revalidate the Git commit, pin it, and
   deploy immutably.

This ordering follows the proven Layer 228 maintenance pattern: schema first,
generated registry second, source compatibility third, version last. It also
keeps the uncommitted production test reversible without confusing that tarball
with the final immutable Git artifact.
