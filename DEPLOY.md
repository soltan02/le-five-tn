# Deploy Le Five

## Instant live link (already done)
Published as a Claude artifact — open, then use **Share** on the page:
https://claude.ai/code/artifact/05de94f6-2edc-4069-ac9d-a0d466651e43

That's the whole app inlined into one file. Note: data is stored **per
browser** (localStorage) and notifications only fire while the app is open —
for shared data across phones + push-when-closed you need the backend.

## Your own URL (free, ~1 minute)
The app is a static site — `npm run build` produces `dist/`, deployable anywhere:

- **Netlify Drop** (no account needed): build, then drag the `dist` folder onto
  https://app.netlify.com/drop → instant HTTPS URL.
- **Vercel:** import the GitHub repo (or `npm i -g vercel && vercel`). Clean URLs
  work via `vercel.json` (SPA rewrite) + BrowserRouter.
- **Cloudflare Pages / GitHub Pages:** point at the repo, build command
  `npm run build`, output dir `dist`.

```bash
npm install
npm run build      # -> dist/
```

Uses HashRouter + relative asset paths (`base: "./"`), so it runs from any host
or subpath with zero server config. A minimal PWA manifest is included, so on a
real HTTPS host users can "Add to Home Screen".
