// scraper_cluster.js – 10‑worker parallel scraper for uffmaal.com
// Inspired by the bollyflix scraper, but tuned for the HTML structure of uffmaal.com.

const fs = require('fs');
const path = require('path');
const { fetchHtml, parseDetailPage, generateSitemap } = require('./utils');

// Load configuration (same file used by utils)
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

const OUTPUT_FILE = path.resolve(__dirname, config.output_file);
const CHECKPOINT_FILE = path.resolve(__dirname, config.checkpoint_file);

const WORKER_COUNT = config.concurrency_limit || 10;

// Ensure data directory exists
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let catalog = [];
if (fs.existsSync(OUTPUT_FILE)) {
  try { catalog = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')); } catch (_) {}
}

let scrapedUrls = new Set();
if (fs.existsSync(CHECKPOINT_FILE)) {
  try { scrapedUrls = new Set(JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))); } catch (_) {}
}

function saveProgress() {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(Array.from(scrapedUrls), null, 2), 'utf-8');
  generateSitemap(catalog);
}

/**
 * Discover all item (movie / series) URLs from the configured categories.
 * Handles pagination until a "next" button is absent.
 */
async function discoverAllItemUrls() {
  const allUrls = new Set();
  for (const cat of config.categories) {
    console.log(`\n🔎 Scanning category: ${cat}`);
    let page = 1;
    while (true) {
      const pageUrl = page === 1 ? cat : `${cat.replace(/\/?$/, '')}/page/${page}/`;
      const html = await fetchHtml(pageUrl);
      if (!html) break;
      const $ = require('cheerio').load(html);
      // Typical WordPress theme uses article.post or div.item
      const links = [];
      $('a.post-card-link, article a, .post a, .entry-title a, .item a, h2 a, h3 a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) {
          const u = href.replace(/\/$/, '');
          const isCategory = u.endsWith('/ott') || u.endsWith('/model') || u.endsWith('/series') || u.endsWith('/privacy-policy') || u.endsWith('/sitemap') || u.includes('/page/') || u.includes('/category/') || u.includes('/tag/');
          if (!isCategory && u !== 'https://uffmaal.com' && u !== 'https://hmaal.gg' && u !== 'https://newmaal.com') {
            links.push(href);
          }
        }
      });
      if (links.length === 0) break;
      for (const l of links) allUrls.add(l);

      // Detect next page button – common selectors
      const nextBtn = $('a.next, .pagination a.next, a.pagination-next, .page-numbers.next').first();
      if (!nextBtn.length) break;
      page++;
      // Polite delay
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`   ➜ Discovered ${[...allUrls].filter(u => u.startsWith(cat)).length} items in this category`);
  }
  console.log(`\n✅ Total unique item URLs collected: ${allUrls.size}`);
  return Array.from(allUrls);
}

/**
 * Helper to check if an item's signed video URLs are nearing expiration (>= 5 days old).
 * Signed S3/R2 URLs typically expire in 7 days (X-Amz-Expires=604800).
 * By renewing them at 5 days, no video will ever expire for users.
 */
function isItemExpiringOrExpired(item, maxAgeDays = 5) {
  if (!item) return true;

  // 1. Check item.scraped_at timestamp if present
  if (item.scraped_at) {
    const scrapedTime = new Date(item.scraped_at).getTime();
    if (!isNaN(scrapedTime)) {
      const ageMs = Date.now() - scrapedTime;
      if (ageMs >= maxAgeDays * 24 * 60 * 60 * 1000) {
        return true;
      }
    }
  }

  // 2. Inspect video URLs for cryptographic signature timestamp: X-Amz-Date=YYYYMMDDTHHMMSSZ
  const sampleUrls = [];
  if (item.episodes && item.episodes.length > 0) {
    for (const ep of item.episodes) {
      if (ep.video_url) sampleUrls.push(ep.video_url);
    }
  }
  if (item.video_urls && item.video_urls.length > 0) {
    sampleUrls.push(...item.video_urls);
  }

  if (sampleUrls.length === 0) return true; // Missing video links, re-scrape

  for (const vUrl of sampleUrls) {
    const match = vUrl.match(/X-Amz-Date=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const min = parseInt(match[5], 10);
      const sec = parseInt(match[6], 10);
      const signedTime = Date.UTC(year, month, day, hour, min, sec);
      const ageMs = Date.now() - signedTime;
      if (ageMs >= maxAgeDays * 24 * 60 * 60 * 1000) {
        return true; // Older than 5 days – auto-renew!
      }
    }
  }

  return false;
}

/**
 * Worker function that processes URLs from the shared queue.
 */
async function worker(id, queue) {
  while (queue.length > 0) {
    const url = queue.shift();
    if (!url) continue;
    try {
      console.log(`[Worker ${id}] 📥 Fetching ${url}`);
      const html = await fetchHtml(url);
      if (!html) {
        console.warn(`[Worker ${id}] ⚠️ No HTML for ${url}`);
        continue;
      }
      const item = await parseDetailPage(html, url);
      // Only add items that actually contain playable episodes or video URLs
      if ((item.episodes && item.episodes.length > 0) || (item.video_urls && item.video_urls.length > 0) || (item.total_episodes && item.total_episodes > 0)) {
        // Strict Deduplication by ID, Title, and URL (Case-insensitive)
        const cleanTitleLower = (item.title || '').toLowerCase().trim();
        catalog = catalog.filter(i => i.id !== item.id && (i.title || '').toLowerCase().trim() !== cleanTitleLower && i.url !== url);
        catalog.unshift(item);
      }
      scrapedUrls.add(url);
      if (scrapedUrls.size % 10 === 0) {
        saveProgress();
        console.log(`   💾 Checkpoint saved – ${scrapedUrls.size} URLs processed`);
      }
    } catch (e) {
      console.error(`[Worker ${id}] ❌ Error processing ${url}: ${e.message}`);
    }
  }
}

async function runClusterScraper() {
  console.log('==================================================================');
  console.log('  🚀 WebMasti – Cloud Auto-Scraper (10 Workers + 5-Day Auto-Renewal)');
  console.log('==================================================================');

  const allUrls = await discoverAllItemUrls();

  // Create lookup map of existing catalog items
  const catalogUrlMap = new Map();
  catalog.forEach(item => {
    if (item.url) catalogUrlMap.set(item.url, item);
  });

  const newUrls = [];
  const expiringUrls = [];

  for (const url of allUrls) {
    const existing = catalogUrlMap.get(url);
    if (!existing || !scrapedUrls.has(url)) {
      newUrls.push(url);
    } else if (isItemExpiringOrExpired(existing, 5)) {
      expiringUrls.push(url);
    }
  }

  console.log(`\n🔎 Discovery Analysis:`);
  console.log(`   ✨ New items to scrape: ${newUrls.length}`);
  console.log(`   ⏳ Expiring items (>= 5 days old, auto-renewing fresh links): ${expiringUrls.length}`);

  // Prioritize new series, followed by renewing expiring ones
  const queue = [...newUrls, ...expiringUrls];

  if (queue.length === 0) {
    console.log(' 🎉 All catalog items have fresh signed video links (< 5 days old) – nothing to do.');
    return;
  }

  console.log(`\n🗂️  Total queue size: ${queue.length} items`);
  console.log(`🚀 Launching ${WORKER_COUNT} parallel workers...`);

  const promises = [];
  for (let i = 1; i <= WORKER_COUNT; i++) {
    promises.push(worker(i, queue));
  }
  await Promise.all(promises);
  saveProgress();
  console.log('\n==================================================================');
  console.log(`✅ Scraping & Auto-Renewal completed – ${catalog.length} items stored in ${OUTPUT_FILE}`);
  console.log('==================================================================');
}

runClusterScraper();
