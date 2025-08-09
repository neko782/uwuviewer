# uwuviewer

A fast, single-user imageboard viewer built with Next.js. Browse and search multiple Booru-style sites from one interface with unified tagging, color-coded autocomplete, and an on-disk tag cache for instant suggestions.

Supported sites:
- yande.re
- konachan.com
- e621.net
- rule34.xxx
- gelbooru.com


## Warning 

This is completely vibe coded, I did not review code at all. It may contain awful security vulnerabilities, silly bugs or other nasty things.


## Features

- Unified search across multiple sites
- Fast completely-local* tag autocomplete
- Responsive, mobile friendly masonry UI

\* except for gelbooru


## Requirements

- Node.js of some new-ish version and npm


## Installation

```bash
git clone https://github.com/neko782/uwuviewer
cd uwuviewer
npm ci 
# For termux:
# npm i lightningcss.android-arm64.node
npm run build
npm start
```


## Tech stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS (v4) via @tailwindcss/postcss
- undici for outbound fetch with custom Agent
- saxes for streaming XML parse (rule34 tags)
- sonner for toasts


