# TONresistor/gramjs — GramJS Layer 222 Fork

## What

Fork of [attikusfinch/gramjs](https://github.com/attikusfinch/gramjs) with pre-compiled JavaScript, consumed as a git dependency by [teleton-agent](https://github.com/TONresistor/teleton-agent).

## Why

The official `telegram` npm package (gram-js/gramjs) is stuck at **Layer 198**. Telegram's API is at **Layer 222**. This fork provides:

- **Layer 222 TL schema** — native `keyboardButtonStyle`, `keyboardButtonCallback` (new IDs), gift resale APIs
- **Pre-compiled JS** — attikusfinch ships raw TypeScript; npm git deps don't run build steps
- **Typed declarations** — full `api.d.ts` (34K lines) with all Layer 222 constructors

## Key Layer 222 types (used by teleton)

| Constructor | Hex ID | Purpose |
|---|---|---|
| `keyboardButtonStyle` | `#4fdd3430` | Styled inline buttons (bg colors, icons) |
| `keyboardButtonCallback` | `#e62bc960` | Callback buttons (new ID, replaces `#35bbdb6b`) |
| `payments.UpdateStarGiftPrice` | `#edbe6ccb` | Set/unset collectible gift price |
| `InputSavedStarGiftUser` | — | Reference saved gift by user |
| `InputInvoiceStarGiftResale` | — | Buy resale gifts |
| `payments.GetResaleStarGifts` | — | List resale marketplace |
| `KeyboardButtonCopy` | — | Copy-to-clipboard button |

## Usage in teleton-agent

```json
{
  "dependencies": {
    "telegram": "github:TONresistor/gramjs#<commit-hash>"
  }
}
```

All 79 import sites use `from "telegram"` — the package name is `"telegram"` so npm resolves it to `node_modules/telegram` unchanged.

## Build process

If you need to update the TL layer or rebuild:

```bash
npm install --legacy-peer-deps
npx tsc --outDir .
cp gramjs/tl/api.d.ts tl/api.d.ts        # tsc generates a stub, need the real 34K-line file
cp gramjs/tl/static/api.tl tl/static/     # TL schema definitions
cp gramjs/tl/static/schema.tl tl/static/
cp gramjs/define.d.ts .
```

Then commit the compiled output and push.

## Upstream

- **Source**: attikusfinch/gramjs (Layer 222, commit `32d6684`)
- **Original**: gram-js/gramjs (Layer 198, npm `telegram@2.26.22`)
- **This fork**: TONresistor/gramjs — adds pre-compiled JS only, zero source changes

## Version info

- `package.json` version: `2.27.0`
- `Version.ts` version: `2.31.0` (upstream inconsistency, not ours)
- TL Layer: **222**
