// Cloudflare Worker for Instant Dynamic SEO & Social Thumbnails
// Bundles seo_map.js at build time for 0ms, 100% reliable thumbnail resolution
import { seoMap } from './functions/seo_map.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. High-Performance Thumbnail Image Proxy for Social Crawlers & Direct Image Downloading
    if (url.pathname === '/api/thumb') {
      const seriesId = url.searchParams.get('series') || 'webmasti-cover';
      const isDownload = url.searchParams.get('download') === '1' || url.searchParams.get('dl') === '1';
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
            const ext = mimeType.includes('webp') ? 'webp' : (mimeType.includes('png') ? 'png' : 'jpg');
            const resHeaders = {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=604800, s-maxage=604800',
              'Access-Control-Allow-Origin': '*'
            };
            if (isDownload) {
              resHeaders['Content-Disposition'] = `attachment; filename="${seriesId}-cover.${ext}"`;
            }
            return new Response(buffer, {
              status: 200,
              headers: resHeaders
            });
          }
        } catch (err) {}
      }

      // Fallback: serve local webmasti-banner.jpg
      try {
        const fallbackUrl = new URL('/webmasti-banner.jpg', url.origin);
        const res = await env.ASSETS.fetch(new Request(fallbackUrl));
        if (isDownload) {
          const headers = new Headers(res.headers);
          headers.set('Content-Disposition', `attachment; filename="${seriesId}-cover.jpg"`);
          return new Response(res.body, { status: 200, headers });
        }
        return res;
      } catch (e) {
        return new Response('Not found', { status: 404 });
      }
    }

    // 2. Determine Series ID or Category from pathname or query
    let seriesId = url.searchParams.get('series');
    if (!seriesId && url.pathname.startsWith('/series/')) {
      seriesId = decodeURIComponent(url.pathname.replace(/^\/series\//, '').replace(/\/$/, ''));
    } else if (!seriesId && url.pathname.startsWith('/watch')) {
      seriesId = url.searchParams.get('series');
    } else if (!seriesId && url.pathname.startsWith('/s/')) {
      seriesId = decodeURIComponent(url.pathname.replace(/^\/s\//, '').replace(/\/$/, ''));
    }

    const category = url.searchParams.get('cat');

    // 3. Dynamic Meta Tag Injection for Series Deep Links
    if (seriesId || category || url.pathname.startsWith('/watch') || url.pathname.startsWith('/series/')) {
      try {
        const indexUrl = new URL('/index.html', url.origin);
        const response = await env.ASSETS.fetch(new Request(indexUrl));
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

          const canonicalUrl = `https://webmastihot.in/watch?series=${encodeURIComponent(seriesId)}`;
          const pageTitle = `${seriesTitle} - Watch Full HD Web Series on WebMasti`;
          const proxyCover = `${url.origin}/api/thumb?series=${encodeURIComponent(seriesId)}&src=${encodeURIComponent(seriesCover)}`;
          const playerEmbedUrl = `https://webmastihot.in/player?series=${encodeURIComponent(seriesId)}`;

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
    "thumbnailUrl": ["${proxyCover}", "${seriesCover}"],
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
          html = html.replace(/<meta\s+name=["']twitter:image["'][^>]*>/gi, '');
          html = html.replace(/<meta\s+name=["']twitter:card["'][^>]*>/gi, '');
          html = html.replace('<head>', `<head>${dynamicTags}`);

          return new Response(html, {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'public, max-age=3600, s-maxage=86400',
              'x-rendered-by': 'webmasti-worker'
            }
          });
        }
      } catch (err) {
        // Continue to assets if any error occurs
      }
    }

    return env.ASSETS.fetch(request);
  }
};
