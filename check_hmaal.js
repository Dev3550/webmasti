const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

async function checkHmaalWebSeries() {
  const targetUrl = 'https://hmaal.gg/web-series/';
  console.log(`🔎 Discovering series on ${targetUrl}...`);
  
  const hmaalItems = new Map(); // slug -> title
  let page = 1;

  while (page <= 50) {
    const pageUrl = page === 1 ? targetUrl : `${targetUrl.replace(/\/?$/, '')}/page/${page}/`;
    const html = await fetchHtml(pageUrl);
    if (!html) break;

    const $ = cheerio.load(html);
    let foundOnPage = 0;

    $('a.post-card-link, article a, .post a, .entry-title a, .item a').each((_, el) => {
      const href = $(el).attr('href');
      let title = $(el).text().trim() || $(el).find('h2, h3, .title').text().trim();
      if (href && href.startsWith('http') && !href.includes('/page/') && !href.includes('/ott/') && !href.includes('/category/') && !href.includes('/model/')) {
        const slug = href.split('/').filter(Boolean).pop();
        if (slug && !hmaalItems.has(slug)) {
          hmaalItems.set(slug, title || slug);
          foundOnPage++;
        }
      }
    });

    if (foundOnPage === 0) break;

    const nextBtn = $('a.next, .pagination a.next, a.pagination-next, .page-numbers.next').first();
    if (!nextBtn.length) break;

    page++;
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n✅ Total unique series found on hmaal.gg: ${hmaalItems.size}`);

  // Load existing catalog
  const catalog = JSON.parse(fs.readFileSync('data/catalog.json', 'utf-8'));
  const existingSlugs = new Set(catalog.map(i => i.id));
  const existingTitles = new Set(catalog.map(i => {
    return i.title.toLowerCase()
      .replace(/web series|\(18\+\)|hot|»|uffmaal|hmaal/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }));

  let matchedCount = 0;
  let newItems = [];

  hmaalItems.forEach((title, slug) => {
    const cleanTitle = title.toLowerCase()
      .replace(/web series|\(18\+\)|hot|»|uffmaal|hmaal/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (existingSlugs.has(slug) || (cleanTitle && existingTitles.has(cleanTitle))) {
      matchedCount++;
    } else {
      newItems.push({ slug, title });
    }
  });

  console.log('==================================================================');
  console.log(`📊 Total Series on hmaal.gg/web-series/: ${hmaalItems.size}`);
  console.log(`✅ Already in your WebMasti catalog: ${matchedCount}`);
  console.log(`🆕 New / Unique Series on hmaal.gg: ${hmaalItems.size - matchedCount}`);
  console.log('==================================================================');

  if (newItems.length > 0) {
    console.log('\nSample New Series titles on hmaal.gg:');
    newItems.slice(0, 15).forEach((item, idx) => {
      console.log(` ${idx + 1}. ${item.title} (${item.slug})`);
    });
  }

  // Clean debug files
  fs.unlinkSync('inspect_hmaal.js');
  fs.unlinkSync('debug_hmaal.js');
}

checkHmaalWebSeries();
