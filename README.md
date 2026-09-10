# WebMasti - Exclusive OTT Web Series & Movie Streaming Platform

WebMasti is a fast, responsive, ad-free web streaming application with dynamic catalog pagination, direct MP4 video player, and cloud auto-scraping capabilities.

## 🚀 Cloudflare Pages Deployment (Step-by-Step)

### Option 1: Automatic GitHub Integration (Recommended)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and click **Workers & Pages** -> **Create Application** -> **Pages**.
2. Select **Connect to Git** and authorize your GitHub account (`Dev3550`).
3. Select the repository: **`webmasti`**.
4. Configure Build settings:
   - **Framework preset**: `None` (Static HTML/CSS/JS)
   - **Build command**: (Leave empty)
   - **Build output directory**: `/` or `.`
5. Click **Save and Deploy**. Cloudflare Pages will automatically deploy your site and give you a free SSL URL (e.g. `https://webmasti.pages.dev`).
6. Every time GitHub Actions auto-scrapes new episodes, Cloudflare Pages will automatically re-deploy the updated catalog live!

### Option 2: Command Line (Wrangler CLI)
```bash
npx wrangler pages deploy . --project-name=webmasti
```

---

## 🤖 Cloud Auto-Scraper (GitHub Actions)
- Scrapes `uffmaal.com` automatically every 6 hours in the cloud.
- Extracts direct MP4 video streaming URLs.
- Updates `data/catalog.json` automatically without using local PC bandwidth.
