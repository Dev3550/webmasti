// scraper_cluster.js – 10‑worker parallel scraper for uffmaal.com
// Inspired by the bollyflix scraper, but tuned for the HTML structure of uffmaal.com.

const fs = require('fs');
const path = require('path');
const { fetchHtml, parseDetailPage } = require('./utils');

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
      $('a.post-card-link, article a, .post a, .entry-title a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http') && !href.includes('/page/') && !href.includes('/ott/') && !href.includes('/model/') && !href.includes('/episodes/') && !href.includes('/privacy-policy/') && !href.includes('/sitemap')) {
          links.push(href);
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
 * Worker function that processes URLs from the shared queue.
 */
async function worker(id, queue) {
  while (queue.length > 0) {
    const url = queue.shift();
    if (!url || scrapedUrls.has(url)) continue;
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
        // Strict Deduplication by ID and Title (Case-insensitive)
        const cleanTitleLower = (item.title || '').toLowerCase().trim();
        catalog = catalog.filter(i => i.id !== item.id && (i.title || '').toLowerCase().trim() !== cleanTitleLower);
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
  console.log('  🚀 WebMasti – Cloud Auto-Scraper (10 Workers)');
  console.log('==================================================================');

  const allUrls = await discoverAllItemUrls();
  const queue = allUrls.filter(u => !scrapedUrls.has(u));

  if (queue.length === 0) {
    console.log(' 🎉 All items already scraped – nothing to do.');
    return;
  }

  console.log(`\n🗂️  Queue size: ${queue.length} (skipping ${allUrls.length - queue.length} already done)`);
  console.log(`🚀 Launching ${WORKER_COUNT} parallel workers...`);

  const promises = [];
  for (let i = 1; i <= WORKER_COUNT; i++) {
    promises.push(worker(i, queue));
  }
  await Promise.all(promises);
  saveProgress();
  console.log('\n==================================================================');
  console.log(`✅ Scraping completed – ${catalog.length} items stored in ${OUTPUT_FILE}`);
  console.log('==================================================================');
}

runClusterScraper();
