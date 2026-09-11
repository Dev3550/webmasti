// utils.js – helper functions for the WebMasti scraper
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

// Load configuration – config.json resides one level up from this file
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

/**
 * Fetch HTML with retries and exponential back‑off.
 * Returns null on failure.
 */
async function fetchHtml(url) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await axios.get(url, {
        headers: config.headers,
        timeout: (config.request_timeout_seconds || 30) * 1000,
      });
      if (resp.status === 200) return resp.data;
    } catch (e) {
      if (e.response && e.response.status === 404) return null;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

/**
 * Extract a file identifier from known URL patterns (Google Drive, FastDL, GDFlix).
 */
function extractFileId(url) {
  if (!url) return '';
  const gdMatch = url.match(/(?:[?&]id=|\/file\/)([a-zA-Z0-9_-]+)/);
  if (gdMatch) return gdMatch[1];
  try {
    const u = new URL(url);
    if (u.searchParams.has('id')) return u.searchParams.get('id');
  } catch (_) {}
  return '';
}

/**
 * Resolve short‑link providers (e.g., linksmod.top) to direct mirrors.
 * Returns an array of { provider, url } objects.
 */
async function fetchShortenerMirrors(shortenerUrl) {
  if (!shortenerUrl || !shortenerUrl.includes('linksmod.top')) return [];
  const html = await fetchHtml(shortenerUrl);
  if (!html) return [];
  const $ = cheerio.load(html);
  const mirrors = [];
  $('.view-well a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('http')) {
      try {
        const host = new URL(href).hostname.replace('www.', '');
        mirrors.push({ provider: host, url: href });
      } catch (_) {
        mirrors.push({ provider: 'Direct Cloud', url: href });
      }
    }
  });
  return mirrors;
}

function cleanBranding(text) {
  if (!text) return '';
  return text
    .replace(/»\s*(UFFMaal|HMaal|NewMaal|AzMaal|PMaal|UffMaal|Hmaal|Newmaal|Bollyflix|Maal)/gi, '')
    .replace(/(UFFMaal|HMaal|NewMaal|AzMaal|PMaal|UffMaal|Hmaal|Newmaal|uffmaal\.com|hmaal\.gg|newmaal\.com|azmaal\.com|pmaal\.com|bollyflix|uff\s*maal|h\s*maal|new\s*maal)/gi, 'WebMasti')
    .replace(/\b(UffMaal|HMaal|NewMaal|AzMaal|PMaal|Bollyflix)\b/gi, 'WebMasti')
    .trim();
}

/**
 * Parse a series or movie page and return a unified JSON object.
 * Extracts title, cover image, categories, description, and for each episode,
 * fetches its direct CDN MP4 video streaming link.
 */
async function parseDetailPage(html, pageUrl) {
  const $ = cheerio.load(html);

  // Title
  let rawTitle = $('h1').first().text().trim();
  if (!rawTitle) rawTitle = $('meta[property="og:title"]').attr('content') || '';
  const title = cleanBranding(rawTitle);

  const slug = pageUrl.split('/').filter(Boolean).pop() || `item-${Date.now()}`;

  // Poster / featured image
  let posterUrl = $('meta[property="og:image"]').attr('content') || '';
  if (!posterUrl) {
    const img = $('img.wp-post-image, .featured-thumbnail img, .post-thumbnail img').first();
    posterUrl = img.attr('src') || '';
  }

  // Categories / Tags / Cast
  const categories = [];
  $('a[href*="/ott/"], a[href*="/model/"], #breadcrumbs a, .category a').each((_, el) => {
    const txt = cleanBranding($(el).text().trim());
    if (txt && !categories.includes(txt) && txt !== 'Home' && txt !== 'Episodes' && txt !== 'Model' && txt !== 'OTT') {
      categories.push(txt);
    }
  });

  // Description
  const description = cleanBranding($('.entry-content p, .post-content p').text().trim());

  // Find all Episode URLs on the series page
  const episodeLinks = [];
  $('a[href*="/episode/"]').each((_, el) => {
    const href = $(el).attr('href');
    const txt = $(el).text().trim();
    if (href && !episodeLinks.some(e => e.url === href)) {
      episodeLinks.push({
        title: cleanBranding(txt ? (isNaN(txt) ? txt : `Episode ${txt}`) : `Episode ${episodeLinks.length + 1}`),
        url: href
      });
    }
  });

  // Fetch direct video stream URLs for each episode
  const episodesData = [];
  const videoLinks = [];

  if (episodeLinks.length > 0) {
    for (const ep of episodeLinks) {
      const epHtml = await fetchHtml(ep.url);
      let videoUrl = '';
      if (epHtml) {
        const ep$ = cheerio.load(epHtml);
        ep$('video source, video').each((_, el) => {
          const src = ep$(el).attr('src');
          if (src && src.startsWith('http')) videoUrl = src;
        });

        if (!videoUrl) {
          ep$('a').each((_, el) => {
            const href = ep$(el).attr('href');
            if (href && (href.includes('.mp4') || href.includes('cdn.') || href.includes('download'))) {
              if (!href.includes('uffmaal.com')) videoUrl = href;
            }
          });
        }
      }

      episodesData.push({
        title: ep.title,
        url: ep.url,
        video_url: videoUrl
      });
      if (videoUrl) videoLinks.push(videoUrl);
    }
  } else {
    // Single movie/video page check direct video tag
    $('video source, video').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('http')) videoLinks.push(src);
    });

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('.mp4') || href.includes('cdn.') || href.includes('download'))) {
        if (!href.includes('uffmaal.com')) videoLinks.push(href);
      }
    });
  }

  return {
    id: slug,
    title,
    url: pageUrl,
    cover_image: posterUrl,
    categories,
    description,
    total_episodes: episodesData.length,
    episodes: episodesData,
    video_urls: videoLinks,
  };
}

/**
 * Automatically update sitemap.xml with all valid catalog item URLs for search engine indexing.
 */
function generateSitemap(catalog) {
  try {
    const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
    const baseUrl = 'https://webmasti.devendradubey61.workers.dev';
    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>\n`;

    (catalog || []).forEach(item => {
      if (item && item.id) {
        xml += `  <url>
    <loc>${baseUrl}/#series=${encodeURIComponent(item.id)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
      }
    });

    xml += `</urlset>`;
    fs.writeFileSync(sitemapPath, xml, 'utf-8');
  } catch (err) {
    console.error('Error generating sitemap:', err.message);
  }
}

module.exports = {
  fetchHtml,
  extractFileId,
  fetchShortenerMirrors,
  parseDetailPage,
  generateSitemap,
};

