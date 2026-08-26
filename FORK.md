# TONresistor/gramjs

Maintained GramJS fork consumed by
[`TONresistor/teleton-agent`](https://github.com/TONresistor/teleton-agent) as
an immutable Git dependency.

## Current release

- Package: `telegram`
- Fork version: `2.33.0`
- Telegram API layer: `229`
- Schema source: Telegram Desktop commit
  `11d18d829b25d583f2e3058663b522a528fde51a`
- Supported maintenance runtimes: Node.js 20 and 24

The fork keeps the existing `telegram` package name and GramJS import paths. The
repository root contains compiled JavaScript and declarations because npm Git
dependencies consume those files directly.

## Reproducible maintenance

```bash
npm ci
npm run verify:schema
npm run update:schema-diff
npm run generate:tl
npm run build:git
npm run check:generated
npm run check:package
npm run check:git-package
npm run test:ci
npm run build:browser
```

`telegram-schema.lock.json` records the exact first-party schema commits, paths,
hashes, layers, and definition counts. The immutable snapshots in
`schema-history/` let `verify:schema` recompute every Layer 224→229 transition
offline. `telegram-schema-diff.json` is the reviewable generated report; any
unapproved removal, stale report, changed ID count, or snapshot drift fails the
gate. Generated files must not be edited manually.

The root Git package and the TypeScript source are both release-critical.
`git-package-manifest.json` lists every compiled artifact synchronized by
`npm run build:git`. `check:git-package` creates an isolated temporary commit,
installs that exact commit through npm's Git dependency path, checks all package
hashes, and removes the temporary repository. It never commits the real
worktree.

## Dependency audit

`npm audit --omit=dev --audit-level=high` is the blocking production release
gate. `npm run audit:exceptions` checks the complete audit and fails if a new
high/critical advisory appears, an exception expires, or an obsolete exception
is left behind.

As of 2026-08-26, both the full dependency audit and the production dependency
audit are clean. `audit-exceptions.json` contains no active exceptions.

## Teleton usage

```json
{
  "dependencies": {
    "telegram": "github:TONresistor/gramjs#<immutable-commit>"
  }
}
```

Before updating that pin:

1. install a local `npm pack` tarball in a disposable Teleton checkout;
2. run the complete Teleton build and test suite;
3. after the fork is pushed, repeat with the exact Git commit;
4. compare the generated artifact hashes;
5. keep the previous immutable commit available for rollback.

Publishing to npm is not part of the normal fork workflow.
