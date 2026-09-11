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
      <img class="continue-thumb" src="${record.cover_image}" alt="${record.title}" onerror="this.src='https://via.placeholder.com/200x120/111/fff?text=WebMasti'">
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

// URL Router & History State (Preserves page on refresh & back button)
function updateUrlHash(item, epIdx) {
  if (item) {
    const newHash = `#series=${item.id}&ep=${epIdx || 0}`;
    if (window.location.hash !== newHash) {
      history.pushState({ modalOpen: true, id: item.id, epIdx: epIdx || 0 }, '', newHash);
    }
  } else {
    if (window.location.hash) {
      history.pushState({ modalOpen: false }, '', window.location.pathname);
    }
  }
}

function checkUrlRoute() {
  const hash = window.location.hash;
  if (hash && hash.includes('#series=')) {
    const params = new URLSearchParams(hash.replace('#', '?'));
    const seriesId = params.get('series');
    const epIdx = parseInt(params.get('ep') || '0', 10);
    if (seriesId) {
      const item = catalogData.find(i => i.id === seriesId);
      if (item) {
        openModal(item, epIdx, false);
      }
    }
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
  heroDesc.innerText = cleanTextBranding(item.description) || `Watch ${cleanTextBranding(item.title)} exclusively on WebMasti with HD stream & zero ads.`;
  heroEpisodes.innerText = `${item.total_episodes || item.episodes?.length || 1} Episodes`;
  heroCat.innerText = item.categories && item.categories[0] ? item.categories[0] : 'Web Series';

  heroPlayBtn.onclick = () => openModal(item, 0, true);
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
        <img src="${item.cover_image}" alt="${item.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x225/111/fff?text=WebMasti'">
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

function handleCardClick(item) {
  if (typeof window.triggerAdOnClick === 'function') {
    window.triggerAdOnClick(false);
  }
  openModal(item, 0, true);
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

  episodesGrid.innerHTML = '';
  
  if (currentEpisodesList.length === 0) {
    episodesGrid.innerHTML = `<p style="color:#9ca3af; font-size:0.9rem;">No episodes available for this item.</p>`;
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
    window.triggerAdOnClick(false);
  }

  currentEpisodeIndex = idx;
  const ep = currentEpisodesList[idx];

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

// Preload next episode stream
function preloadNextEpisode(currentIdx) {
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
  }
}

// Play Direct MP4 Stream Video
function playVideo(url, label) {
  playerStatus.innerText = `▶️ Playing: ${label}`;
  videoSource.src = url;
  mainVideoPlayer.load();
  mainVideoPlayer.play().catch(e => {
    console.log('Autoplay blocked or stream ready:', e);
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
    playerStatus.innerText = `⏭️ Next Episode ${nextIdx + 1} starting...`;
    
    // Start 5-second countdown progress bar before playing next episode
    startAutoplayCountdown(nextIdx, () => {
      playEpisodeAtIndex(nextIdx, false);
    });
  } else {
    playerStatus.innerText = '🎉 Series completed!';
  }
});

// Render Recommended Series Grid inside Modal
function renderRecommendedSeries(currentItem) {
  const recGrid = document.getElementById('recommendedGrid');
  if (!recGrid) return;
  recGrid.innerHTML = '';

  const pool = catalogData.filter(i => i.id !== currentItem.id);
  const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 6);

  shuffled.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '0';
    card.innerHTML = `
      <div class="card-poster">
        <img src="${item.cover_image}" alt="${item.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x225/111/fff?text=WebMasti'">
      </div>
      <div class="card-info" style="padding: 6px;">
        <h4 style="font-size:0.8rem; font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.title}</h4>
      </div>
    `;
    card.onclick = () => openModal(item, 0, true);
    recGrid.appendChild(card);
  });
}

// Close Modal
function closeModalAction(updateHash) {
  playerModal.classList.remove('active');
  mainVideoPlayer.pause();
  videoSource.src = '';
  if (autoplayTimer) clearInterval(autoplayTimer);
  const wrapper = document.getElementById('autoplayBarWrapper');
  if (wrapper) wrapper.style.display = 'none';

  if (updateHash !== false) {
    updateUrlHash(null);
  }
}

closeModal.onclick = () => closeModalAction(true);

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

// Initialize Ad Monetization System (With Desktop-Only Social Bar check)
function initAdMonetization() {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return;

  const ads = window.WEBMASTI_ADS;

  // 1. Top Banner Ad
  const topAdContainer = document.getElementById('topAdContainer');
  if (topAdContainer && ads.topBannerCode && ads.topBannerCode.trim().length > 15) {
    topAdContainer.innerHTML = ads.topBannerCode;
    topAdContainer.style.display = 'block';
  }

  // 2. Modal Player Banner Ad
  const modalAdContainer = document.getElementById('modalAdContainer');
  if (modalAdContainer && ads.playerBannerCode && ads.playerBannerCode.trim().length > 15) {
    modalAdContainer.innerHTML = ads.playerBannerCode;
    modalAdContainer.style.display = 'block';
  }

  // 3. Popunder Script
  if (ads.popunderScript && ads.popunderScript.trim().length > 5) {
    const s = document.createElement('script');
    if (ads.popunderScript.startsWith('http')) {
      s.src = ads.popunderScript;
    } else {
      s.text = ads.popunderScript;
    }
    document.head.appendChild(s);
  }

  // 4. Push / Social Bar Ad Script (Loaded ONLY on PC / Tablet screens > 768px)
  if (window.innerWidth > 768 && ads.pushAdScript && ads.pushAdScript.trim().length > 5) {
    const s = document.createElement('script');
    s.src = ads.pushAdScript;
    document.head.appendChild(s);
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  initAdMonetization();
});
