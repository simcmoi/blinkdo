# BlinkDo Auto-Update Setup

BlinkDo uses the official Tauri v2 updater plugin.

## Current Configuration

- Rust plugin: `tauri-plugin-updater`
- Frontend package: `@tauri-apps/plugin-updater`
- Updater endpoint: `https://github.com/simcmoi/blinkdo/releases/latest/download/latest.json`
- Updater artifacts: enabled with `bundle.createUpdaterArtifacts`
- Release workflow: `.github/workflows/release.yml`

## Required GitHub Secrets

Tauri updater artifacts must be signed. Never commit the private key.

Generate a signing key locally:

```bash
npm run tauri signer generate -w ~/.tauri/blinkdo.key
```

Add the generated public key to `src-tauri/tauri.conf.json` under:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "PUBLIC_KEY_HERE"
    }
  }
}
```

Add these GitHub repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: the private key content
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the key password, if one was set

## Release Flow

1. Bump the version with `npm run release`, `npm run release:minor`, or `npm run release:major`.
2. Push the generated tag.
3. GitHub Actions builds macOS and Windows bundles.
4. The Tauri action uploads bundles, signatures, and `latest.json` to the GitHub Release.
5. Clients check `latest.json`, download the signed artifact, install it, then prompt for restart.

## Verification

Before publishing a release, run:

```bash
npm run lint
npm run build
npm run test:run
cd src-tauri && cargo check
cd src-tauri && cargo clippy
```

## Notes

- The updater only works in signed packaged builds, not in normal Vite browser mode.
- The private signing key must stay in GitHub Secrets or a secure local secret manager.
- `latest.json` must be present on the latest GitHub Release for update checks to succeed.
