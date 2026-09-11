// WebMasti App Core JavaScript
let catalogData = [];
let filteredData = [];

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

    // Sanitize every single item to ensure 100% WebMasti branding everywhere & filter out empty 0-episode items
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
    
    // Render Hero with first item
    if (catalogData.length > 0) {
      setupHero(catalogData[0]);
    }

    renderCategoryPills();
    currentPage = 1;
    renderGrid();
  } catch (err) {
    console.error('Error loading catalog:', err);
    catalogGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff0055;">
        ⚠️ Unable to load catalog.json. Make sure data/catalog.json exists.
      </div>
    `;
  }
}

// Render Dynamic Category Pills from Scraped Catalog (OTT Platforms ONLY - No Cast/Actress Names)
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

  // Filter ONLY matching OTT platform names from the catalog
  const foundPlatforms = allowedPlatforms.filter(plat => 
    Array.from(categoriesSet).some(c => c.toLowerCase() === plat.toLowerCase())
  );

  let pillsHTML = `<button class="pill active" data-cat="all">🔥 All WebSeries</button>`;
  
  foundPlatforms.forEach(plat => {
    pillsHTML += `<button class="pill" data-cat="${plat}">${plat}</button>`;
  });

  categoryPills.innerHTML = pillsHTML;
}

// Setup Featured Hero
function setupHero(item) {
  if (!item) return;
  heroBackdrop.style.backgroundImage = `url('${item.cover_image}')`;
  heroTitle.innerText = cleanTextBranding(item.title);
  heroDesc.innerText = cleanTextBranding(item.description) || `Watch ${cleanTextBranding(item.title)} exclusively on WebMasti with HD stream & zero ads.`;
  heroEpisodes.innerText = `${item.total_episodes || item.episodes?.length || 1} Episodes`;
  heroCat.innerText = item.categories && item.categories[0] ? item.categories[0] : 'Web Series';

  heroPlayBtn.onclick = () => openModal(item);
}

// Render Catalog Grid with Pagination
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

// Render Pagination Buttons
function renderPagination(totalPages) {
  paginationControls.innerHTML = '';
  if (totalPages <= 1) return;

  // Prev Button
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

  // Page Numbers
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

  // Next Button
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


// Current Active Series & Episode State
let currentEpisodesList = [];
let currentEpisodeIndex = 0;

// Card click handler in catalog grid
function handleCardClick(item) {
  if (typeof window.triggerAdOnClick === 'function') {
    window.triggerAdOnClick();
  }
  openModal(item);
}

// Open Detail & Streaming Modal
function openModal(item) {
  modalCover.src = item.cover_image;
  modalTitle.innerText = item.title;
  modalDescription.innerText = item.description || `Watch all episodes of ${item.title} with high-speed direct MP4 streaming on WebMasti.`;
  
  modalCategories.innerHTML = (item.categories || [])
    .map(c => `<span class="meta-tag">${c}</span>`)
    .join('');

  currentEpisodesList = item.episodes || [];
  currentEpisodeIndex = 0;
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
      epBtn.className = `btn-ep ${idx === 0 ? 'active' : ''}`;
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

    // Start 1st episode
    if (currentEpisodesList[0] && currentEpisodesList[0].video_url) {
      playEpisodeAtIndex(0, false);
    }
  }

  playerModal.classList.add('active');
}

// Play Episode at specific Index (Handles Ad trigger & active state)
function playEpisodeAtIndex(idx, isManualClick) {
  if (!currentEpisodesList || !currentEpisodesList[idx]) return;

  // Trigger Popunder / Click Ad
  if (typeof window.triggerAdOnClick === 'function') {
    window.triggerAdOnClick();
  }

  currentEpisodeIndex = idx;
  const ep = currentEpisodesList[idx];

  // Update UI active button
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
  } else {
    playerStatus.innerText = '⚠️ Video link missing for this episode';
  }
}

// Preload next episode stream for smooth zero-wait playback
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

// Auto Play Next Episode when video finishes playing (ended event)
mainVideoPlayer.addEventListener('ended', () => {
  // Gracefully exit full screen if video ended while in fullscreen mode
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

  if (currentEpisodesList && currentEpisodeIndex + 1 < currentEpisodesList.length) {
    const nextIdx = currentEpisodeIndex + 1;
    playerStatus.innerText = `⏭️ Auto-playing Episode ${nextIdx + 1}...`;
    setTimeout(() => {
      playEpisodeAtIndex(nextIdx, false);
    }, 600);
  } else {
    playerStatus.innerText = '🎉 Series completed!';
  }
});


// Close Modal
closeModal.onclick = () => {
  playerModal.classList.remove('active');
  mainVideoPlayer.pause();
  videoSource.src = '';
};

playerModal.onclick = (e) => {
  if (e.target === playerModal) {
    playerModal.classList.remove('active');
    mainVideoPlayer.pause();
    videoSource.src = '';
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

// Initialize Ad Monetization System
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

  // 4. Push Ad Script
  if (ads.pushAdScript && ads.pushAdScript.trim().length > 5) {
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


