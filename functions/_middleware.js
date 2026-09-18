// Cloudflare Pages Middleware for Dynamic SEO & Open Graph Previews
// Automatically optimizes Googlebot, Bingbot, WhatsApp, Telegram, and social crawlers for every series & category

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const seriesId = url.searchParams.get('series');
  const category = url.searchParams.get('cat');

  // Handle series deep link or category link
  if (seriesId || category) {
    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      let html = await response.text();

      if (seriesId) {
        let seriesTitle = url.searchParams.get('title') || '';
        let seriesCover = url.searchParams.get('img') || '';
        let seriesDesc = '';
        let seriesCategories = [];
        let totalEpisodes = 1;

        // Try reading catalog.json from assets if metadata is missing from query
        try {
          const catalogUrl = new URL('/data/catalog.json', url.origin);
          const catalogRes = await context.env.ASSETS.fetch(catalogUrl);
          if (catalogRes.ok) {
            const catalog = await catalogRes.json();
            const item = catalog.find(i => i.id === seriesId);
            if (item) {
              if (!seriesTitle) seriesTitle = item.title;
              if (!seriesCover) seriesCover = item.cover_image;
              seriesDesc = item.description || '';
              seriesCategories = item.categories || [];
              totalEpisodes = item.total_episodes || (item.episodes ? item.episodes.length : 1);
            }
          }
        } catch (e) {
          // Fallback to query or defaults
        }

        if (!seriesTitle) {
          seriesTitle = seriesId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        }
        if (!seriesCover) {
          seriesCover = `${url.origin}/og-banner.jpg`;
        }
        if (!seriesDesc) {
          seriesDesc = `Watch ${seriesTitle} uncut web series all episodes online in Full HD for free on WebMasti. Stream latest Indian OTT web series with fast buffer and high video quality.`;
        }

        const canonicalUrl = `https://webmastihot.in/?series=${encodeURIComponent(seriesId)}`;
        const pageTitle = `${seriesTitle} Watch Online Free HD Episodes - WebMasti`;

        const dynamicTags = `
  <title>${pageTitle}</title>
  <meta name="description" content="${seriesDesc.replace(/"/g, '&quot;')}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:site_name" content="WebMasti">
  <meta property="og:type" content="video.other">
  <meta property="og:title" content="${pageTitle.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${seriesDesc.replace(/"/g, '&quot;')}">
  <meta property="og:image" content="${seriesCover}">
  <meta property="og:image:secure_url" content="${seriesCover}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="338">
  <meta property="og:url" content="${canonicalUrl}">

  <!-- Twitter Meta -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${seriesDesc.replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${seriesCover}">

  <!-- Google VideoObject Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": "${seriesTitle.replace(/"/g, '\\"')}",
    "description": "${seriesDesc.replace(/"/g, '\\"')}",
    "thumbnailUrl": ["${seriesCover}"],
    "uploadDate": "2026-01-01T00:00:00+05:30",
    "embedUrl": "${canonicalUrl}",
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

        html = html.replace(/<title>.*?<\/title>/i, '');
        html = html.replace(/<meta name="description"[^>]*>/gi, '');
        html = html.replace(/<link rel="canonical"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:title"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:description"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:image"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:image:alt"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:url"[^>]*>/gi, '');
        html = html.replace(/<meta name="twitter:title"[^>]*>/gi, '');
        html = html.replace(/<meta name="twitter:description"[^>]*>/gi, '');
        html = html.replace(/<meta name="twitter:image"[^>]*>/gi, '');
        html = html.replace('<head>', `<head>${dynamicTags}`);

        return new Response(html, {
          status: response.status,
          headers: response.headers
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

        html = html.replace(/<title>.*?<\/title>/i, '');
        html = html.replace(/<meta name="description"[^>]*>/gi, '');
        html = html.replace(/<link rel="canonical"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:title"[^>]*>/gi, '');
        html = html.replace(/<meta property="og:description"[^>]*>/gi, '');
        html = html.replace('<head>', `<head>${dynamicTags}`);

        return new Response(html, {
          status: response.status,
          headers: response.headers
        });
      }
    }
    return response;
  }

  return context.next();
}
