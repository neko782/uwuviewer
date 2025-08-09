# uwuviewer

A fast, single-user imageboard viewer built with Next.js. Browse and search multiple Booru-style sites from one interface with unified tagging, color-coded autocomplete, and an on-disk tag cache for instant suggestions.

Supported sites:
- yande.re (Moebooru)
- konachan.com (Moebooru)
- e621.net
- rule34.xxx
- gelbooru.com


## Features

- Unified search across multiple sites
  - Per-site defaults (e.g., rating:safe / rating:general)
  - Click a tag in the viewer to pivot your search
  - Pagination with configurable posts per page
- Color‑coded tag autocomplete
  - Uses a local tag cache for instant suggestions on: yande.re, konachan.com, e621.net, rule34.xxx
  - Gelbooru autocomplete uses the live API (with debounce)
  - e621 alias support (antecedent → canonical tag in suggestions)
- One‑click tag prefetch with background progress
  - Per‑site consent and background download via SSE
  - Small, collapsible progress toast with a minimized floating capsule
  - Approximate download sizes: yande.re/konachan ~10 MB, e621 ~15 MB, rule34 ~100 MB
  - Tag cache stored on disk and auto‑refreshed: 24h (most), 7d (rule34)
- Local, single‑user settings and credentials
  - Settings: image quality (preview/sample), posts per page, blacklist tags (global negatives)
  - Credentials: Gelbooru API fragment and e621 login/API key
  - Persisted to ./data/global_creds.json (created automatically)
- Safe, rate‑limited server proxies
  - /api/proxy for JSON API calls with host allowlist and injected auth where needed
  - /api/image for streaming images/videos with Range/304 support and caching
  - Both endpoints are IP‑scoped rate‑limited and block local/loopback hosts
- Responsive UI
  - Masonry gallery, mobile‑friendly layout, keyboard‑friendly autocomplete


## Requirements

- Node.js 18.18+ (LTS recommended) and npm
- Linux/macOS/Windows supported
- No external databases or cloud services; everything is stored locally under ./data


## Installation

```bash
# Clone the repo
git clone <your-fork-or-repo-url>
cd uwuviewer

# Install exact dependencies
npm ci

# Start the dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

If you prefer yarn/pnpm/bun you can use the equivalent commands, but the lockfile is npm‑based and the CI path assumes npm.


## Configuration (optional but recommended)

You can run the app without any configuration. For the best experience:

- Open the Settings panel (gear icon) in the UI.
- Credentials
  - Gelbooru: paste your API credentials in the format: `&api_key=YOUR_KEY&user_id=YOUR_ID`
    - Required for reliable Gelbooru API access (search, details, autocomplete)
  - e621: set your username and API key
    - Required to view certain restricted content on e621 and to set a compliant User‑Agent/Authorization
- Tag download preferences
  - Choose which sites should maintain an on‑disk tag cache for instant autocomplete
  - First visit to a supported site will optionally prompt to download tags
  - You can start/stop and monitor progress via the collapsible toast; cached files are stored under ./data
- Settings
  - Image quality: Preview (fast) or Sample (higher quality)
  - Posts per page: number of posts to fetch per page (default 100)
  - Blacklist tags: space‑separated tags to always exclude (automatically applied as negatives)

All settings and credentials are stored locally in ./data/global_creds.json and are applied server‑side.


## How tag caching works

- yande.re / konachan.com: downloaded via their JSON tag endpoint
- e621.net: daily CSV dumps for tags and aliases (today or yesterday) are downloaded and stored as CSV
- rule34.xxx: tags are streamed from the XML DAPI and written to disk; autocomplete and tag info are served from this cache
- Freshness: most caches refresh every 24h; rule34 refreshes every 7 days
- Files stored under ./data:
  - <site>_tags.csv
  - <site>_aliases.csv (e621 only)
  - <site>_tag_meta.json (contains lastFetch timestamp)

To clear a cache, stop the app and delete the corresponding files from ./data.


## Troubleshooting

- Build succeeds but requests fail
  - Make sure your network allows external HTTPS requests to the supported hosts
  - For Gelbooru 401 errors, set a valid `&api_key=...&user_id=...` fragment in Settings → API keys
- e621 posts missing or restricted
  - Provide e621 login + API key in Settings → API keys
- Autocomplete empty for rule34/e621 right after first launch
  - Download the tag cache when prompted or enable it in Settings → Tag download preferences
- Disk permission errors
  - Ensure the process can read/write the local ./data directory


## Scripts

- dev: start development server with hot reload
- build: compile Next.js app for production
- start: start the production server
- lint: run ESLint and type checks

```bash
npm run dev
npm run build
npm start
npm run lint
```


## Tech stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS (v4) via @tailwindcss/postcss
- undici for outbound fetch with custom Agent
- saxes for streaming XML parse (rule34 tags)
- sonner for toasts


## Security & privacy

- No third‑party backends: all state and caches are local under ./data
- Proxies enforce an allowlist of hosts and block local/loopback/IP literals
- Simple per‑IP rate limiting on server routes to avoid abuse


## License

No license file is present. If you plan to publish or distribute this project, consider adding a license file appropriate for your use.
