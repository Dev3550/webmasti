// README for WebMasti project

# WebMasti

A premium video portal that mirrors the structure of https://uffmaal.com/ with full branding.

## Project Structure
```
webmasti/
├─ frontend/            # Static HTML/CSS/JS for the UI (brand customisation)
│   ├─ index.html
│   ├─ series.html
│   ├─ episode.html
│   └─ css/
│       ├─ style.css
│       └─ branding.css
│   └─ js/
│       └─ app.js
├─ backend/             # Express API serving catalogue data
│   └─ server.js
├─ scraper/             # Async scraper (cluster engine)
│   ├─ scraper.js        # entry point
│   ├─ scraper_cluster.js
│   └─ utils.js
├─ data/                # Scraped data storage (JSON files)
│   ├─ catalog.json      # output catalogue
│   └─ checkpoint_urls.json
├─ config.json          # scraper configuration
└─ package.json
```

Run `npm install` then `npm run scrape` to populate `data/catalog.json`. The frontend can be served via the backend static files.
