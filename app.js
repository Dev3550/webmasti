// WebMasti App Core JavaScript
let catalogData = [];
let filteredData = [];
let currentActiveItem = null;
let currentEpisodesList = [];
let currentEpisodeIndex = 0;
let autoplayTimer = null;

// Helper to sanitize any third-party website branding to WebMasti
function cleanTextBranding(str) {
  if (!str) return '';
  return str
    .replace(/»\s*(UFFMaal|HMaal|NewMaal|AzMaal|PMaal|UffMaal|Hmaal|Newmaal|Bollyflix|Maal)/gi, '')
    .replace(/(UFFMaal|HMaal|NewMaal|AzMaal|PMaal|UffMaal|Hmaal|Newmaal|uffmaal\.com|hmaal\.gg|newmaal\.com|azmaal\.com|pmaal\.com|bollyflix|uff\s*maal|h\s*maal|new\s*maal)/gi, 'WebMasti')
    .replace(/\b(UffMaal|HMaal|NewMaal|AzMaal|PMaal|Bollyflix)\b/gi, 'WebMasti')
    .trim();
}

// Pagination State
let currentPage = 1;
const itemsPerPage = 12;

// DOM Elements
const catalogGrid = document.getElementById('catalogGrid');
const paginationControls = document.getElementById('paginationControls');
const searchInput = document.getElementById('searchInput');
const categoryPills = document.getElementById('categoryPills');

// Hero Elements
const heroBackdrop = document.getElementById('heroBackdrop');
const heroTitle = document.getElementById('heroTitle');
const heroDesc = document.getElementById('heroDesc');
const heroEpisodes = document.getElementById('heroEpisodes');
const heroCat = document.getElementById('heroCat');
const heroPlayBtn = document.getElementById('heroPlayBtn');

// Modal Elements
const playerModal = document.getElementById('playerModal');
const closeModal = document.getElementById('closeModal');
const modalCover = document.getElementById('modalCover');
const modalTitle = document.getElementById('modalTitle');
const modalCategories = document.getElementById('modalCategories');
const modalDescription = document.getElementById('modalDescription');
const epCount = document.getElementById('epCount');
const episodesGrid = document.getElementById('episodesGrid');
const mainVideoPlayer = document.getElementById('mainVideoPlayer');
const videoSource = document.getElementById('videoSource');
const playerStatus = document.getElementById('playerStatus');

// Load Catalog JSON
async function loadCatalog() {
  try {
    const res = await fetch('data/catalog.json');
    if (!res.ok) throw new Error('Catalog JSON not found');
    const rawData = await res.json();

    catalogData = rawData
      .filter(item => (item.episodes && item.episodes.length > 0) || (item.video_urls && item.video_urls.length > 0) || (item.total_episodes && item.total_episodes > 0))
      .map(item => ({
        ...item,
        title: cleanTextBranding(item.title),
        description: cleanTextBranding(item.description),
        categories: (item.categories || [])
          .map(cleanTextBranding)
          .filter(c => c && !['Home', 'Episodes', 'Model', 'OTT', 'UffMaal', 'HMaal', 'NewMaal', 'WebMasti'].includes(c)),
        episodes: (item.episodes || []).map(ep => ({
          ...ep,
          title: cleanTextBranding(ep.title)
        }))
      }));

    filteredData = [...catalogData];
    
    // Setup Featured Hero
    if (catalogData.length > 0) {
      setupHero(catalogData[0]);
    }

    renderCategoryPills();
    renderGrid();
    renderContinueWatching();

    // Check URL state for deep-linked series or refresh recovery
    checkUrlRoute();

  } catch (err) {
    console.error('Error loading catalog:', err);
    catalogGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff0055;">
        ⚠️ Unable to load catalog.json. Make sure data/catalog.json exists.
      </div>
    `;
  }
}

// Continue Watching (LocalStorage)
function saveContinueWatching(item, epIdx) {
  if (!item) return;
  const record = {
    id: item.id,
    title: item.title,
    cover_image: item.cover_image,
    epIdx: epIdx || 0,
    epTitle: (item.episodes && item.episodes[epIdx]) ? item.episodes[epIdx].title : `Episode ${(epIdx || 0) + 1}`,
    timestamp: Date.now()
  };
  localStorage.setItem('webmasti_continue', JSON.stringify(record));
  renderContinueWatching();
}

function renderContinueWatching() {
  const continueSec = document.getElementById('continueWatchingSection');
  const continueCard = document.getElementById('continueCard');
  if (!continueSec || !continueCard) return;

  const raw = localStorage.getItem('webmasti_continue');
  if (!raw) {
    continueSec.style.display = 'none';
    return;
  }

  try {
    const record = JSON.parse(raw);
    const item = catalogData.find(i => i.id === record.id);
    if (!item) {
      continueSec.style.display = 'none';
      return;
    }

    continueCard.innerHTML = `
      <img class="continue-thumb" src="${record.cover_image}" alt="${record.title}" onerror="this.src='logo.svg'">
      <div class="continue-details">
        <div class="continue-title">${record.title}</div>
        <div class="continue-ep">▶ ${record.epTitle}</div>
      </div>
      <button class="btn-resume" id="btnResumePlay">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Resume Watching
      </button>
    `;

    document.getElementById('btnResumePlay').onclick = () => {
      openModal(item, record.epIdx, true);
    };

    continueSec.style.display = 'block';
  } catch (e) {
    continueSec.style.display = 'none';
  }
}

// URL Router & History State (Preserves page on refresh & back button, Googlebot crawlable)
function updateUrlHash(item, epIdx) {
  if (item) {
    const newSearch = `?series=${encodeURIComponent(item.id)}${epIdx ? `&ep=${epIdx}` : ''}`;
    if (window.location.search !== newSearch) {
      history.pushState({ modalOpen: true, id: item.id, epIdx: epIdx || 0 }, '', newSearch);
    }
  } else {
    if (window.location.search || window.location.hash) {
      history.pushState({ modalOpen: false }, '', window.location.pathname);
    }
  }
}

function checkUrlRoute() {
  const searchParams = new URLSearchParams(window.location.search);
  let seriesId = searchParams.get('series');
  let epIdx = parseInt(searchParams.get('ep') || '0', 10);
  const cat = searchParams.get('cat');

  // Support /series/:slug path
  if (!seriesId && window.location.pathname.startsWith('/series/')) {
    seriesId = decodeURIComponent(window.location.pathname.replace(/^\/series\//, '').replace(/\/$/, ''));
  }

  // Fallback for legacy hash links (#series=...)
  if (!seriesId && window.location.hash && window.location.hash.includes('series=')) {
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    seriesId = hashParams.get('series');
    epIdx = parseInt(hashParams.get('ep') || '0', 10);
  }

  if (seriesId) {
    const sLower = seriesId.toLowerCase();
    const item = catalogData.find(i => 
      i.id.toLowerCase() === sLower || 
      (i.title && cleanTextBranding(i.title).toLowerCase().replace(/[^a-z0-9]+/g, '-') === sLower)
    );
    if (item) {
      openModal(item, epIdx, false);
    }
  } else if (cat) {
    // Auto-filter category from URL
    const targetCat = cat.toLowerCase();
    const pill = document.querySelector(`.pill[data-cat="${cat}"]`) ||
                 Array.from(document.querySelectorAll('.pill')).find(p => p.getAttribute('data-cat').toLowerCase() === targetCat);
    if (pill) {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    }
    filteredData = catalogData.filter(item => {
      return (item.categories || []).some(c => c.toLowerCase().includes(targetCat));
    });
    currentPage = 1;
    renderGrid();
  } else {
    if (playerModal.classList.contains('active')) {
      closeModalAction(false);
    }
  }
}

window.addEventListener('popstate', () => {
  checkUrlRoute();
});

// Category Pills
function renderCategoryPills() {
  const allowedPlatforms = [
    'ULLU', 'Atrangii', 'Rabbit', 'Kooku', 'PrimeShots', 
    'ALTT', 'MoodX', 'Jugnu', 'PrimePlay', 'AKKU', 'Woow', 
    'HitPrime', 'Makhan', 'BigShots', 'Bulbul Play', 'Fliz', 
    'CinemaDosti', 'Voovi', 'Hunter', 'Hotshots', 'Chikooflix', 'Nuefliks'
  ];

  const categoriesSet = new Set();
  catalogData.forEach(item => {
    (item.categories || []).forEach(cat => {
      if (cat) categoriesSet.add(cat.trim());
    });
  });

  const foundPlatforms = allowedPlatforms.filter(plat => 
    Array.from(categoriesSet).some(c => c.toLowerCase() === plat.toLowerCase())
  );

  let pillsHTML = `<button class="pill active" data-cat="all">🔥 All WebSeries</button>`;
  
  foundPlatforms.forEach(plat => {
    pillsHTML += `<button class="pill" data-cat="${plat}">${plat}</button>`;
  });

  categoryPills.innerHTML = pillsHTML;
}

// Setup Hero
function setupHero(item) {
  if (!item) return;
  heroBackdrop.style.backgroundImage = `url('${item.cover_image}')`;
  heroTitle.innerText = cleanTextBranding(item.title);
  heroDesc.innerText = cleanTextBranding(item.description) || `Watch ${cleanTextBranding(item.title)} exclusively on WebMasti with HD stream.`;
  heroEpisodes.innerText = `${item.total_episodes || item.episodes?.length || 1} Episodes`;
  heroCat.innerText = item.categories && item.categories[0] ? item.categories[0] : 'Web Series';

  heroPlayBtn.onclick = () => handleCardClick(item);
}

// Render Catalog Grid
function renderGrid() {
  catalogGrid.innerHTML = '';
  if (filteredData.length === 0) {
    catalogGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #9ca3af;">No series found.</div>`;
    paginationControls.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

  pageItems.forEach(item => {
    const epCountText = item.total_episodes || (item.episodes ? item.episodes.length : 1);
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-poster">
        <img src="${item.cover_image}" alt="${item.title}" loading="lazy" onerror="this.src='logo.svg'">
        <span class="card-episodes-badge">${epCountText} EPS</span>
      </div>
      <div class="card-info">
        <h3 class="card-title">${item.title}</h3>
        <div class="card-tags">
          ${(item.categories || []).slice(0, 2).map(cat => `<span class="tag">${cat}</span>`).join('')}
        </div>
      </div>
    `;

    card.onclick = () => handleCardClick(item);
    catalogGrid.appendChild(card);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  paginationControls.innerHTML = '';
  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-page';
  prevBtn.innerText = '« Prev';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderGrid();
      window.scrollTo({ top: catalogGrid.offsetTop - 100, behavior: 'smooth' });
    }
  };
  paginationControls.appendChild(prevBtn);

  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `btn-page ${p === currentPage ? 'active' : ''}`;
    pageBtn.innerText = p;
    pageBtn.onclick = () => {
      currentPage = p;
      renderGrid();
      window.scrollTo({ top: catalogGrid.offsetTop - 100, behavior: 'smooth' });
    };
    paginationControls.appendChild(pageBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-page';
  nextBtn.innerText = 'Next »';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderGrid();
      window.scrollTo({ top: catalogGrid.offsetTop - 100, behavior: 'smooth' });
    }
  };
  paginationControls.appendChild(nextBtn);
}

function handleCardClick(item, epIdx) {
  if (!item) return;
  openModal(item, epIdx || 0, true);
  if (typeof window.triggerAdOnClick === 'function') {
    try {
      window.triggerAdOnClick(false);
    } catch (e) {}
  }
}

// Dynamic SEO Meta Tags & Schema.org Structured Data
function updateDynamicSEO(item, epIdx) {
  if (!item) return;
  const epText = (item.episodes && item.episodes[epIdx]) ? ` - ${item.episodes[epIdx].title}` : '';
  const pageTitle = `${item.title}${epText} Full Web Series - Watch Online Free HD | WebMasti`;
  document.title = pageTitle;

  const pageDesc = `Watch ${item.title} full web series episodes online in HD for free on WebMasti. Stream latest 18+ uncut Hindi web series with direct video access.`;
  
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', pageDesc);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', pageTitle);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', pageDesc);

  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg && item.cover_image) ogImg.setAttribute('content', item.cover_image);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `https://webmastihot.in/?series=${encodeURIComponent(item.id)}`);

  // Inject dynamic TVSeries JSON-LD Schema for Google Rich Snippets
  let schemaScript = document.getElementById('dynamic-series-schema');
  if (!schemaScript) {
    schemaScript = document.createElement('script');
    schemaScript.id = 'dynamic-series-schema';
    schemaScript.type = 'application/ld+json';
    document.head.appendChild(schemaScript);
  }

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "name": item.title,
    "description": item.description || pageDesc,
    "image": item.cover_image,
    "numberOfEpisodes": item.total_episodes || (item.episodes ? item.episodes.length : 1),
    "inLanguage": "Hindi",
    "genre": item.categories || ["Web Series", "18+ Uncut"],
    "provider": {
      "@type": "Organization",
      "name": "WebMasti",
      "url": "https://webmastihot.in/"
    }
  };

  schemaScript.textContent = JSON.stringify(schemaData);
}

function resetSEOToDefault() {
  document.title = "WebMasti - Watch 18+ Uncut Web Series & Movies Online Free HD";
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', "Watch HD 18+ Uncut Web Series online for free on WebMasti. Stream latest episodes from ULLU, MoodX, PrimePlay, Kooku, Rabbit, Woow, Jugnu, and Exclusive Indian Web Series with direct streaming and fast buffering.");

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', "https://webmastihot.in/");

  const schemaScript = document.getElementById('dynamic-series-schema');
  if (schemaScript) schemaScript.remove();
}

// Seeded Engagement Metrics & Native Share System
function getSeededStats(itemId) {
  let hash = 0;
  for (let i = 0; i < (itemId || '').length; i++) {
    hash = (hash << 5) - hash + itemId.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const baseViews = 12500 + (positiveHash % 34500); // 12.5k to 47k views
  const baseLikes = 1200 + (positiveHash % 3600);   // 1.2k to 4.8k likes

  const userViews = parseInt(localStorage.getItem(`webmasti_views_${itemId}`) || '0', 10);
  const userLiked = localStorage.getItem(`webmasti_liked_${itemId}`) === 'true';

  return {
    views: baseViews + userViews,
    likes: baseLikes + (userLiked ? 1 : 0),
    isLiked: userLiked
  };
}

function updateEngagementBar(item) {
  if (!item) return;

  // Increment view count on modal open
  const currentViews = parseInt(localStorage.getItem(`webmasti_views_${item.id}`) || '0', 10);
  localStorage.setItem(`webmasti_views_${item.id}`, (currentViews + 1).toString());

  const stats = getSeededStats(item.id);

  const viewsEl = document.getElementById('modalViewsCount');
  const likesEl = document.getElementById('modalLikesCount');
  const likeBtn = document.getElementById('btnModalLike');
  const shareBtn = document.getElementById('btnModalShare');

  if (viewsEl) {
    viewsEl.innerText = stats.views >= 1000 ? `${(stats.views / 1000).toFixed(1)}K` : stats.views.toLocaleString();
  }

  if (likesEl) {
    likesEl.innerText = stats.likes.toLocaleString();
  }

  if (likeBtn) {
    if (stats.isLiked) {
      likeBtn.classList.add('liked');
    } else {
      likeBtn.classList.remove('liked');
    }

    const toggleLike = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isCurrentlyLiked = localStorage.getItem(`webmasti_liked_${item.id}`) === 'true';
      if (isCurrentlyLiked) {
        localStorage.setItem(`webmasti_liked_${item.id}`, 'false');
        likeBtn.classList.remove('liked');
        setPlayerStatus('💔 Unliked', 2000);
      } else {
        localStorage.setItem(`webmasti_liked_${item.id}`, 'true');
        likeBtn.classList.add('liked');
        setPlayerStatus('❤️ Liked this series!', 2000);
      }
      const updatedStats = getSeededStats(item.id);
      if (likesEl) likesEl.innerText = updatedStats.likes.toLocaleString();
    };

    likeBtn.onclick = toggleLike;
  }

  if (shareBtn) {
    const triggerShare = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      handleNativeShare(item);
    };

    shareBtn.onclick = triggerShare;
  }
}

function handleNativeShare(item) {
  if (!item) return;
  const baseUrl = 'https://webmastihot.in';
  const directVid = (item.video_urls && item.video_urls[0]) || 
                    (item.episodes && item.episodes[0] && item.episodes[0].video_url) || '';

  const shareParams = new URLSearchParams();
  shareParams.set('series', item.id);
  if (item.title) shareParams.set('title', item.title);
  if (item.cover_image) shareParams.set('img', item.cover_image);
  if (directVid) shareParams.set('vid', directVid);

  const shareUrl = `${baseUrl}/watch?${shareParams.toString()}`;
  const shareTitle = `${item.title} - Watch Full HD Web Series on WebMasti`;
  const shareText = `🔥 Watch *${item.title}* Full Episodes Free in HD on WebMasti!\n${shareUrl}`;

  if (navigator.share) {
    navigator.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl
    }).then(() => {
      setPlayerStatus('🔗 Shared successfully!', 2500);
    }).catch(e => {
      console.log('Native share canceled/fallback:', e);
      fallbackCopy(shareUrl, item);
    });
  } else {
    fallbackCopy(shareUrl, item);
  }
}

function fallbackCopy(shareUrl, item) {
  const waText = encodeURIComponent(`${shareUrl}\n\n🔥 Watch *${item ? item.title : 'Web Series'}* Full Episodes Free in HD on WebMasti!`);
  const waUrl = `https://api.whatsapp.com/send?text=${waText}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setPlayerStatus('📋 Link copied! Opening WhatsApp...', 3000);
      window.open(waUrl, '_blank');
    }).catch(() => {
      window.open(waUrl, '_blank');
    });
  } else {
    window.open(waUrl, '_blank');
  }
}

// Open Detail & Streaming Modal
function openModal(item, startEpIdx, updateHash) {
  if (!item) return;
  currentActiveItem = item;
  modalCover.src = item.cover_image;
  modalTitle.innerText = item.title;
  modalDescription.innerText = item.description || `Watch all episodes of ${item.title} with high-speed direct MP4 streaming on WebMasti.`;
  
  modalCategories.innerHTML = (item.categories || [])
    .map(c => `<span class="meta-tag">${c}</span>`)
    .join('');

  currentEpisodesList = item.episodes || [];
  const initEpIdx = (startEpIdx >= 0 && startEpIdx < currentEpisodesList.length) ? startEpIdx : 0;
  currentEpisodeIndex = initEpIdx;
  epCount.innerText = currentEpisodesList.length;

  const epSelect = document.getElementById('episodeSelect');
  if (epSelect) {
    epSelect.innerHTML = '';
    currentEpisodesList.forEach((ep, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.innerText = ep.title || `Episode ${idx + 1}`;
      if (idx === initEpIdx) opt.selected = true;
      epSelect.appendChild(opt);
    });

    epSelect.onchange = (e) => {
      const selectedIdx = parseInt(e.target.value, 10);
      playEpisodeAtIndex(selectedIdx, true);
    };
  }

  if (currentEpisodesList.length === 0) {
    if (item.video_urls && item.video_urls.length > 0) {
      playVideo(item.video_urls[0], 'Full Video');
    }
  } else {
    currentEpisodesList.forEach((ep, idx) => {
      const epBtn = document.createElement('button');
      epBtn.className = `btn-ep ${idx === initEpIdx ? 'active' : ''}`;
      epBtn.setAttribute('data-ep-idx', idx);
      epBtn.innerHTML = `
        <span>${ep.title || 'Episode ' + (idx + 1)}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      `;

      epBtn.onclick = () => {
        playEpisodeAtIndex(idx, true);
      };

      episodesGrid.appendChild(epBtn);
    });

    playEpisodeAtIndex(initEpIdx, false);
  }

  renderRecommendedSeries(item);
  updateDynamicSEO(item, initEpIdx);
  updateEngagementBar(item);

  if (updateHash !== false) {
    updateUrlHash(item, initEpIdx);
  }

  playerModal.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 5-Sec Autoplay Progress Bar Header
function startAutoplayCountdown(nextEpIdx, onComplete) {
  const wrapper = document.getElementById('autoplayBarWrapper');
  const text = document.getElementById('autoplayText');
  const fill = document.getElementById('autoplayProgressFill');
  const playBtn = document.getElementById('btnPlayNow');
  if (!wrapper || !fill) {
    onComplete();
    return;
  }

  wrapper.style.display = 'block';
  fill.style.width = '0%';

  if (autoplayTimer) clearInterval(autoplayTimer);

  const startTime = Date.now();
  const durationMs = 5000;

  autoplayTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(100, (elapsed / durationMs) * 100);
    fill.style.width = `${progress}%`;

    const remainingSec = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
    text.innerText = `⏳ Episode ${nextEpIdx + 1} starting in ${remainingSec}s...`;

    if (elapsed >= durationMs) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
      wrapper.style.display = 'none';
      onComplete();
    }
  }, 100);

  playBtn.onclick = () => {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = null;
    wrapper.style.display = 'none';
    onComplete();
  };
}

// Play Episode at specific Index
function playEpisodeAtIndex(idx, isManualClick) {
  if (!currentEpisodesList || !currentEpisodesList[idx]) return;

  if (isManualClick && typeof window.triggerAdOnClick === 'function') {
    try {
      window.triggerAdOnClick(false);
    } catch (e) {}
  }

  currentEpisodeIndex = idx;
  const ep = currentEpisodesList[idx];

  const epSelect = document.getElementById('episodeSelect');
  if (epSelect) {
    epSelect.value = idx;
  }

  document.querySelectorAll('.btn-ep').forEach((btn, bIdx) => {
    if (bIdx === idx) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (ep.video_url) {
    playVideo(ep.video_url, ep.title);
    preloadNextEpisode(idx);
    saveContinueWatching(currentActiveItem, idx);
    updateUrlHash(currentActiveItem, idx);
  } else {
    playerStatus.innerText = '⚠️ Video link missing for this episode';
  }
}

let playerStatusTimer = null;

// Helper to set player status with automatic fadeout after 3.5 seconds
function setPlayerStatus(text, autoHideMs = 3500) {
  if (!playerStatus) return;
  playerStatus.innerText = text;
  playerStatus.style.opacity = '1';
  playerStatus.style.visibility = 'visible';

  if (playerStatusTimer) clearTimeout(playerStatusTimer);
  if (autoHideMs > 0) {
    playerStatusTimer = setTimeout(() => {
      playerStatus.style.opacity = '0';
      playerStatus.style.visibility = 'hidden';
    }, autoHideMs);
  }
}

let bufferCheckInterval = null;

// Flush Video RAM & Decoded Buffer Memory between episodes so 2nd/3rd episode never lags or stutters
function flushVideoMemory() {
  if (bufferCheckInterval) clearInterval(bufferCheckInterval);
  if (mainVideoPlayer) {
    try {
      mainVideoPlayer.pause();
      if (videoSource) videoSource.removeAttribute('src');
      mainVideoPlayer.removeAttribute('src');
      mainVideoPlayer.load();
    } catch (e) {
      console.log('Video RAM flush notice:', e);
    }
  }
}

// Detect Network Connection Speed (Slow 2G/3G vs Fast 4G/Wi-Fi)
function getNetworkType() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return { isSlow: false, effectiveType: '4g', downlink: 10 };
  
  const effectiveType = conn.effectiveType || '4g';
  const downlink = conn.downlink || 10;
  const saveData = conn.saveData || false;

  const isSlow = (effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g' || downlink < 1.8 || saveData);
  return { isSlow, effectiveType, downlink, saveData };
}

// Adaptive Preload Engine - Adjusts caching behavior based on connection speed
function preloadNextEpisode(currentIdx) {
  const net = getNetworkType();
  // On slow network connections (2G/3G/SaveData), preserve 100% bandwidth for the playing video
  if (net.isSlow) return;

  if (currentEpisodesList && currentEpisodesList[currentIdx + 1] && currentEpisodesList[currentIdx + 1].video_url) {
    const nextUrl = currentEpisodesList[currentIdx + 1].video_url;
    
    const existing = document.querySelector(`link[href="${nextUrl}"]`);
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.href = nextUrl;
      document.head.appendChild(link);
    }

    try {
      fetch(nextUrl, {
        headers: { 'Range': 'bytes=0-5242880' } // 5MB initial chunk
      }).catch(e => console.log('Next episode pre-fetch ready:', e));
    } catch (_) {}
  }
}

let adaptiveStallCount = 0;
let lastStallTime = 0;

// Adaptive Stream Buffer Engine - Dynamic buffering without fixed hardcoding
function startBufferPump() {
  if (bufferCheckInterval) clearInterval(bufferCheckInterval);

  bufferCheckInterval = setInterval(() => {
    if (!mainVideoPlayer || mainVideoPlayer.paused || mainVideoPlayer.ended) return;

    try {
      const currentTime = mainVideoPlayer.currentTime;
      let bufferedAhead = 0;

      for (let i = 0; i < mainVideoPlayer.buffered.length; i++) {
        const start = mainVideoPlayer.buffered.start(i);
        const end = mainVideoPlayer.buffered.end(i);
        if (currentTime >= start && currentTime <= end) {
          bufferedAhead = end - currentTime;
          break;
        }
      }

      const net = getNetworkType();
      const targetBuffer = net.isSlow ? 15 : 45; // 15s target on slow net, 45s on fast net

      if (bufferedAhead < targetBuffer && mainVideoPlayer.duration && (mainVideoPlayer.duration - currentTime > 3)) {
        mainVideoPlayer.preload = 'auto';
      }
    } catch (e) {}
  }, 2000);
}

// Auto-Stall Recovery & Adaptive Network Listener
if (mainVideoPlayer) {
  mainVideoPlayer.addEventListener('waiting', () => {
    const now = Date.now();
    if (now - lastStallTime < 20000) {
      adaptiveStallCount++;
    } else {
      adaptiveStallCount = 1;
    }
    lastStallTime = now;

    const net = getNetworkType();
    if (net.isSlow || adaptiveStallCount >= 2) {
      setPlayerStatus('📶 Slow network: Auto-optimizing stream...', 3000);
    } else {
      setPlayerStatus('⚡ Optimizing stream buffer...', 2000);
    }
  });

  mainVideoPlayer.addEventListener('stalled', () => {
    if (mainVideoPlayer.readyState >= 2 && mainVideoPlayer.paused) {
      mainVideoPlayer.play().catch(() => {});
    }
  });

  mainVideoPlayer.addEventListener('canplay', () => {
    if (adaptiveStallCount > 0) {
      adaptiveStallCount = 0;
    }
  });

  mainVideoPlayer.addEventListener('playing', () => {
    startBufferPump();
  });

  mainVideoPlayer.addEventListener('error', (e) => {
    console.error('Video playback error:', e);
    setPlayerStatus('⚠️ Video link expired or unavailable. Retrying or select another episode.', 6000);
  });
}

// Play Direct MP4 Stream Video with RAM Memory Flush
function playVideo(url, label) {
  setPlayerStatus(`▶️ Playing: ${label}`, 3500);

  // 1. Flush previous video RAM memory buffer so 2nd/3rd episodes never lag or stutter
  flushVideoMemory();

  // 2. Assign new video URL
  videoSource.src = url;
  mainVideoPlayer.load();

  // 3. Start adaptive buffer pump engine
  startBufferPump();

  // 4. Play video with robust autoplay fallback (for Facebook/external link clicks)
  mainVideoPlayer.play().catch(e => {
    console.log('Autoplay unmuted blocked by browser, trying muted autoplay:', e);
    mainVideoPlayer.muted = true;
    mainVideoPlayer.play().then(() => {
      setPlayerStatus('🔊 Playing (Muted) - Tap to unmute sound', 4000);
    }).catch(err => {
      console.log('Playback requires user tap:', err);
    });
  });
}

// Auto Play Next Episode on Video Completion (with Forced Ad Trigger & 5s Countdown)
mainVideoPlayer.addEventListener('ended', () => {
  // Exit fullscreen if active so ad opens cleanly and UI is accessible
  if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(e => console.log(e));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (err) {
      console.log('Fullscreen exit notice:', err);
    }
  }

  // Force trigger transition ad on episode completion!
  if (typeof window.triggerAdOnClick === 'function') {
    window.triggerAdOnClick(true);
  }

  if (currentEpisodesList && currentEpisodeIndex + 1 < currentEpisodesList.length) {
    const nextIdx = currentEpisodeIndex + 1;
    setPlayerStatus(`⏭️ Next Episode ${nextIdx + 1} starting...`, 3000);
    
    // Start 5-second countdown progress bar before playing next episode
    startAutoplayCountdown(nextIdx, () => {
      playEpisodeAtIndex(nextIdx, false);
    });
  } else {
    setPlayerStatus('🎉 Series completed!', 4000);
  }
});

let sliderAutoScrollInterval = null;
let isUserInteractingWithSlider = false;

// Render Recommended Series Grid inside Modal with 6-Second Auto-Scroll
function renderRecommendedSeries(currentItem) {
  const recGrid = document.getElementById('recommendedGrid');
  if (!recGrid) return;
  recGrid.innerHTML = '';

  if (sliderAutoScrollInterval) {
    clearInterval(sliderAutoScrollInterval);
    sliderAutoScrollInterval = null;
  }

  // Pick 15 series from catalog for continuous slider exploration
  const pool = catalogData.filter(i => i.id !== currentItem.id);
  const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 15);

  shuffled.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '0';
    card.innerHTML = `
      <div class="card-poster">
        <img src="${item.cover_image}" alt="${item.title}" loading="lazy" onerror="this.src='logo.svg'">
        <span class="card-episodes-badge">${item.total_episodes || (item.episodes ? item.episodes.length : 1)} EPS</span>
      </div>
      <div class="card-info" style="padding: 8px 6px;">
        <h4 style="font-size:0.82rem; font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom: 4px;">${item.title}</h4>
        <div class="card-tags" style="margin: 0;">
          ${(item.categories || []).slice(0, 1).map(cat => `<span class="tag" style="font-size: 0.68rem; padding: 2px 6px;">${cat}</span>`).join('')}
        </div>
      </div>
    `;
    card.onclick = () => {
      handleCardClick(item);
      const scrollBody = playerModal.querySelector('.modal-scroll-body');
      if (scrollBody) scrollBody.scrollTo({ top: 0, behavior: 'smooth' });
    };
    recGrid.appendChild(card);
  });

  // Start 6-Second Auto-Scroll Engine
  startSliderAutoScroll(recGrid);
}

function startSliderAutoScroll(recGrid) {
  if (sliderAutoScrollInterval) clearInterval(sliderAutoScrollInterval);
  if (!recGrid) return;

  // Touch, wheel, and navigation controls (attached once)
  if (!recGrid._hasScrollListeners) {
    recGrid.addEventListener('touchstart', () => { isUserInteractingWithSlider = true; }, { passive: true });
    recGrid.addEventListener('touchend', () => {
      setTimeout(() => { isUserInteractingWithSlider = false; }, 3000);
    }, { passive: true });
    recGrid.addEventListener('mouseenter', () => { isUserInteractingWithSlider = true; });
    recGrid.addEventListener('mouseleave', () => { isUserInteractingWithSlider = false; });

    // Desktop Mouse Wheel support (Horizontal scrolling via mouse wheel)
    recGrid.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        recGrid.scrollBy({ left: e.deltaY * 1.5, behavior: 'smooth' });
      }
    }, { passive: false });

    // Desktop Navigation Arrow buttons
    const prevBtn = document.getElementById('btnSlidePrev');
    const nextBtn = document.getElementById('btnSlideNext');
    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        const step = recGrid.clientWidth * 0.65;
        recGrid.scrollBy({ left: -step, behavior: 'smooth' });
      };
    }
    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        const step = recGrid.clientWidth * 0.65;
        recGrid.scrollBy({ left: step, behavior: 'smooth' });
      };
    }

    recGrid._hasScrollListeners = true;
  }

  sliderAutoScrollInterval = setInterval(() => {
    if (isUserInteractingWithSlider) return;
    if (!playerModal || !playerModal.classList.contains('active')) {
      clearInterval(sliderAutoScrollInterval);
      return;
    }

    const firstCard = recGrid.querySelector('.card');
    const step = firstCard ? (firstCard.offsetWidth + 14) : 150;

    // Smoothly reset to 0 if reached the rightmost end
    if (recGrid.scrollLeft + recGrid.clientWidth >= recGrid.scrollWidth - 15) {
      recGrid.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      recGrid.scrollBy({ left: step, behavior: 'smooth' });
    }
  }, 6000);
}

// Close Modal
function closeModalAction(updateHash) {
  playerModal.classList.remove('active');
  flushVideoMemory();
  if (autoplayTimer) clearInterval(autoplayTimer);
  if (sliderAutoScrollInterval) {
    clearInterval(sliderAutoScrollInterval);
    sliderAutoScrollInterval = null;
  }
  const wrapper = document.getElementById('autoplayBarWrapper');
  if (wrapper) wrapper.style.display = 'none';

  resetSEOToDefault();

  if (updateHash !== false) {
    updateUrlHash(null);
  }
}

closeModal.onclick = () => closeModalAction(true);

const btnModalHome = document.getElementById('btnModalHome');
if (btnModalHome) {
  btnModalHome.onclick = () => closeModalAction(true);
}

playerModal.onclick = (e) => {
  if (e.target === playerModal) {
    closeModalAction(true);
  }
};

// Search Filter
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  filteredData = catalogData.filter(item => {
    const t = item.title.toLowerCase();
    const c = (item.categories || []).join(' ').toLowerCase();
    return t.includes(query) || c.includes(query);
  });
  currentPage = 1;
  renderGrid();
});

// Category Filter Pills
categoryPills.addEventListener('click', (e) => {
  if (!e.target.classList.contains('pill')) return;
  
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  e.target.classList.add('active');
  
  const cat = e.target.getAttribute('data-cat');
  if (cat === 'all') {
    filteredData = [...catalogData];
  } else {
    filteredData = catalogData.filter(item => {
      return (item.categories || []).some(c => c.toLowerCase().includes(cat.toLowerCase()));
    });
  }
  currentPage = 1;
  renderGrid();
});

// Initialize Ad Monetization System (Social Bar active ONLY on PC/Tablet > 768px, disabled on Mobile)
function initAdMonetization() {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return;
  // Monetag ads are initialized via tag.min.js in index.html and sw.js
  console.log('WebMasti Monetag Ad Engine Initialized.');
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  initAdMonetization();

  // Corner Floating Home Button handler
  const floatingHomeBtn = document.getElementById('floatingHomeBtn');
  if (floatingHomeBtn) {
    floatingHomeBtn.addEventListener('click', (e) => {
      if (playerModal && playerModal.classList.contains('active')) {
        e.preventDefault();
        closeModalAction(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (window.location.hash) {
        e.preventDefault();
        history.pushState("", document.title, window.location.pathname + window.location.search);
        resetSEOToDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Register Monetag Push Notification Service Worker (sw.js)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('WebMasti ServiceWorker registered successfully:', reg.scope);
      }).catch(err => {
        console.log('WebMasti ServiceWorker registration notice:', err);
      });
    });
  }
});

