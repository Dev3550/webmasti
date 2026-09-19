// Cloudflare Pages Middleware for Instant Dynamic SEO & Social Thumbnails
// Bundles seo_map.js at build time for 0ms, 100% reliable thumbnail resolution
import { seoMap } from './seo_map.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 1. High-Performance Thumbnail Image Proxy for Social Crawlers
  if (url.pathname === '/api/thumb') {
    const seriesId = url.searchParams.get('series');
    let srcUrl = url.searchParams.get('src') || '';

    // Direct lookup from bundled seoMap
    if (!srcUrl && seriesId && seoMap[seriesId]) {
      srcUrl = seoMap[seriesId].cover || '';
    }

    if (srcUrl && srcUrl.startsWith('http')) {
      try {
        const imgRes = await fetch(srcUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://uffmaal.com/',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        });
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
          return new Response(buffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=604800, s-maxage=604800',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch (err) {}
    }

    // Fallback: serve local webmasti-banner.jpg
    try {
      const fallbackUrl = new URL('/webmasti-banner.jpg', url.origin);
      return await context.env.ASSETS.fetch(new Request(fallbackUrl));
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  }

  // 2. Extract series ID from query or pathname
  let seriesId = url.searchParams.get('series');
  if (!seriesId && url.pathname.startsWith('/series/')) {
    seriesId = decodeURIComponent(url.pathname.replace(/^\/series\//, '').replace(/\/$/, ''));
  } else if (!seriesId && url.pathname.startsWith('/watch')) {
    seriesId = url.searchParams.get('series');
  } else if (!seriesId && url.pathname.startsWith('/s/')) {
    seriesId = decodeURIComponent(url.pathname.replace(/^\/s\//, '').replace(/\/$/, ''));
  }

  const category = url.searchParams.get('cat');

  // 3. Handle series deep link or category link with HTTP 200 OK
  if (seriesId || category || url.pathname.startsWith('/watch') || url.pathname.startsWith('/series/')) {
    try {
      const indexReq = new Request(new URL('/index.html', url.origin));
      const response = await context.env.ASSETS.fetch(indexReq);
      let html = await response.text();

      if (seriesId) {
        const item = seoMap[seriesId] || {};
        let seriesTitle = url.searchParams.get('title') || item.title || '';
        let seriesCover = url.searchParams.get('img') || item.cover || '';
        let videoUrl = url.searchParams.get('vid') || item.vid || '';

        if (!seriesTitle) {
          seriesTitle = seriesId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        }
        if (!seriesCover) {
          seriesCover = `${url.origin}/webmasti-banner.jpg`;
        }
        const seriesDesc = `Watch ${seriesTitle} uncut web series full episodes online in Full HD for free on WebMasti. Fast streaming playback.`;

        const canonicalUrl = `https://webmastihot.in/?series=${encodeURIComponent(seriesId)}`;
        const pageTitle = `${seriesTitle} - Watch Full HD Web Series on WebMasti`;
        const proxyCover = `${url.origin}/api/thumb?series=${encodeURIComponent(seriesId)}&src=${encodeURIComponent(seriesCover)}`;
        const playerEmbedUrl = `https://webmastihot.in/?series=${encodeURIComponent(seriesId)}`;

        const dynamicTags = `
  <title>${pageTitle}</title>
  <meta name="description" content="${seriesDesc.replace(/"/g, '&quot;')}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1">

  <!-- Open Graph / Facebook / WhatsApp Preview with Exact Series Thumbnail -->
  <meta property="og:site_name" content="WebMasti">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${pageTitle.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${seriesDesc.replace(/"/g, '&quot;')}">
  <meta property="og:image" content="${seriesCover}">
  <meta property="og:image:secure_url" content="${seriesCover}">
  <meta property="og:image" content="${proxyCover}">
  <meta property="og:image:secure_url" content="${proxyCover}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="338">
  <meta property="og:image:alt" content="${seriesTitle.replace(/"/g, '&quot;')}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${seriesDesc.replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${seriesCover}">
  <meta name="twitter:image:src" content="${seriesCover}">

  <!-- Google VideoObject Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": "${seriesTitle.replace(/"/g, '\\"')}",
    "description": "${seriesDesc.replace(/"/g, '\\"')}",
    "thumbnailUrl": ["${seriesCover}", "${proxyCover}"],
    "uploadDate": "2026-01-01T00:00:00+05:30",
    "embedUrl": "${playerEmbedUrl}",
    "contentUrl": "${(videoUrl || '').replace(/"/g, '\\"')}",
    "isFamilyFriendly": false,
    "inLanguage": "hi",
    "publisher": {
      "@type": "Organization",
      "name": "WebMasti",
      "url": "https://webmastihot.in/"
    }
  }
  </script>
`;

        html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
        html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
        html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+property=["']og:image[^'"]*["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+name=["']twitter:image[^'"]*["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+name=["']twitter:card["'][^>]*>/gi, '');
        html = html.replace('<head>', `<head>${dynamicTags}`);

        return new Response(html, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=86400',
            'x-rendered-by': 'webmasti-middleware'
          }
        });
      } else if (category) {
        const canonicalUrl = `https://webmastihot.in/?cat=${encodeURIComponent(category)}`;
        const pageTitle = `${category} Web Series Watch Online Free HD - WebMasti`;
        const pageDesc = `Watch all latest ${category} 18+ uncut web series full episodes in HD online for free on WebMasti. Stream with fast buffering and direct playback.`;

        const dynamicTags = `
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:site_name" content="WebMasti">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDesc}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDesc}">
`;

        html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
        html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
        html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/gi, '');
        html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/gi, '');
        html = html.replace('<head>', `<head>${dynamicTags}`);

        return new Response(html, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=3600, s-maxage=86400',
            'x-rendered-by': 'webmasti-middleware'
          }
        });
      }
    } catch (err) {
      // Fallback
    }
  }

  return context.next();
}
