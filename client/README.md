# MoodFlix Client

Next.js frontend for the MoodFlix recommendation engine demo.

## Requirements

- Node.js 20+
- pnpm
- MoodFlix API running locally or reachable through `NEXT_PUBLIC_API_URL`

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

By default the client calls `http://localhost:4000`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
```
