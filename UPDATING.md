# Updating the Telegram API layer

This fork uses an immutable Telegram Desktop schema snapshot. Do not copy the
schema from the moving `dev` branch or from `core.telegram.org/schema`, because
the documentation may lag the deployed Telegram layer.

## 1. Select and lock the source

Use the final Telegram Desktop commit for the target layer:

```text
Telegram/SourceFiles/mtproto/scheme/api.tl
Telegram/SourceFiles/mtproto/scheme/mtproto.tl
```

Record the repository, full commit, source paths, SHA-256 hashes, layer, and
definition count in `telegram-schema.lock.json`.

Keep the final snapshot for each intervening layer under `schema-history/` and
add it to the lock's ordered `history`. Then regenerate the semantic report:

```bash
npm run update:schema-diff
npm run verify:schema
```

`update:schema-diff` never approves removals. A removed definition must be
reviewed and named explicitly in that transition's `allowedRemovals`; otherwise
verification fails. The verifier independently recomputes every transition,
the cumulative diff, all hashes, and the committed report.

For Layer 228 the locked source is:

```text
commit: 138b937f01a275000fb2e06b3d5b864f5b78cc81
api.tl: bbddd9c4c3f5ff16fd4abbf39f2a864fdac7553e9f05b6bf9ead2aeb9c8eb566
mtproto.tl: 40c10255afb6cfcbcfc190a457a53b66ec9e410f6418cd97cc4c276709a739a9
definitions: 2449
```

## 2. Verify and generate

```bash
npm ci
npm run verify:schema
npm run generate:tl
```

Generation updates:

- `gramjs/tl/api.d.ts`
- `gramjs/tl/apiTl.js`
- `gramjs/tl/schemaTl.js`
- `gramjs/tl/AllTLObjects.ts`

The runtime layer is derived from the single `// LAYER N` marker. Never update
it independently.

## 3. Adapt source compatibility

Run the source checks before compiling the Git package:

```bash
npm run typecheck
npm test -- --runInBand
```

Review changed unions and constructor IDs explicitly. Use runtime narrowing such
as `instanceof`; do not hide new union members with blanket casts.

Layer 228 consumers must also account for the join-result wrapper introduced
after Layer 224:

```ts
const result = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
const updates =
  result instanceof Api.messages.ChatInviteJoinResultOk
    ? result.updates
    : undefined;
```

`Api.channels.JoinChannel` returns the same union. The
`ChatInviteJoinResultWebView` branch contains `botId`, `queryId`, and `users`,
not `updates`.

## 4. Build the Git dependency

```bash
npm run build:git
npm run smoke:package
npm run check:generated
```

The build compiles in a temporary staging directory, validates the staged
version, layer, registry, and `messages.searchGlobal` constructor, then
synchronizes the root artifacts listed in `git-package-manifest.json`.

`check:generated` repeats generation and compilation in a clean temporary copy
and compares every generated artifact hash.

## 5. Browser and package validation

```bash
npm run build:browser
npm run check:package
npm run check:git-package
npm audit --omit=dev --audit-level=high
npm run audit:exceptions
```

The browser build uses temporary source variants and never rewrites
`package.json`, `package-lock.json`, or `tsconfig.json`.

`check:package` verifies the exact tarball manifest, installs the tarball in an
empty consumer fixture, loads the supported subpath imports, checks every
changed constructor ID, and serializes a Layer 228 request.

`check:git-package` additionally copies the current worktree into an isolated
temporary repository, creates a temporary commit, installs that exact commit as
an npm Git dependency, compares every published file hash, runs the same
consumer smoke, and deletes the temporary repository. It does not modify the
real Git history.

## 6. Consumer validation

Before committing, create a tarball and install it in a disposable Teleton
checkout. After pushing the fork, repeat the complete validation with:

```text
github:TONresistor/gramjs#<immutable-commit>
```

Do not replace the production pin with a branch name. Production validation is
read-only by default and must reuse an existing authorized Telegram session
without logging credentials or session material.

## 7. Future layer signal

```bash
npm run check:latest-layer
```

This read-only command reports when Telegram Desktop `dev` contains a newer
layer. It never downloads into the repository, generates code, commits, or
merges automatically.
