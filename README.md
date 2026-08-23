# taken. — browser portrait

A from-scratch static recreation of the interaction language behind [Since You Arrived · Vol. IV](https://sinceyouarrived.world/taken).

It collects common browser-exposed values locally, turns them into a staged narrative, and does not persist or transmit the resulting fingerprint.

The interface supports English and Simplified Chinese. It follows the browser language automatically; use the switch in the top-right corner or append `?lang=zh` / `?lang=en` to select a language explicitly.

## Run locally

```bash
npm install
npm run dev
```

Build a deployable version with:

```bash
npm run build
```

The output is written to `dist/` and can be deployed to any static host.
