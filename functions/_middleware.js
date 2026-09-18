// Cloudflare Pages Middleware for Dynamic Open Graph Preview (WhatsApp, Telegram, Facebook, Twitter)
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const seriesId = url.searchParams.get('series');

  // If request contains a series ID query parameter
  if (seriesId) {
    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      let html = await response.text();

      let seriesTitle = url.searchParams.get('title') || '';
      let seriesCover = url.searchParams.get('img') || '';

      // Try reading catalog.json from assets if title/img not already in query
      if (!seriesTitle || !seriesCover) {
        try {
          const catalogUrl = new URL('/data/catalog.json', url.origin);
          const catalogRes = await context.env.ASSETS.fetch(catalogUrl);
          if (catalogRes.ok) {
            const catalog = await catalogRes.json();
            const item = catalog.find(i => i.id === seriesId);
            if (item) {
              seriesTitle = item.title;
              seriesCover = item.cover_image;
            }
          }
        } catch (e) {
          // Fallback to defaults
        }
      }

      if (!seriesTitle) {
        seriesTitle = seriesId.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      }
      if (!seriesCover) {
        seriesCover = `${url.origin}/og-banner.jpg`;
      }

      // Format clean, rich social media metadata with series thumbnail
      const dynamicTags = `
  <title>${seriesTitle} - Watch Free HD on WebMasti</title>
  <meta property="og:site_name" content="WebMasti">
  <meta property="og:title" content="${seriesTitle} - Watch Full HD Web Series">
  <meta property="og:description" content="Watch all episodes of ${seriesTitle} online in HD quality for free on WebMasti. Direct video streaming.">
  <meta property="og:image" content="${seriesCover}">
  <meta property="og:image:secure_url" content="${seriesCover}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="338">
  <meta property="og:url" content="${url.href}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${seriesTitle} - Watch Full HD Web Series">
  <meta name="twitter:description" content="Watch all episodes of ${seriesTitle} in HD quality on WebMasti!">
  <meta name="twitter:image" content="${seriesCover}">
`;

      // Clean existing tags and inject dynamic series metadata
      html = html.replace(/<title>.*?<\/title>/i, '');
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
    }
    return response;
  }

  return context.next();
}
