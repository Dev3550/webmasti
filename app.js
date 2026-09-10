// WebMasti App Core JavaScript
let catalogData = [];
let filteredData = [];

// Pagination State
let currentPage = 1;
const itemsPerPage = 12;

// DOM Elements
const catalogGrid = document.getElementById('catalogGrid');
const paginationControls = document.getElementById('paginationControls');
const searchInput = document.getElementById('searchInput');
const itemCount = document.getElementById('itemCount');
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
    catalogData = await res.json();
    filteredData = [...catalogData];
    
    itemCount.innerText = `Total Items: ${catalogData.length}`;
    
    // Render Hero with first item
    if (catalogData.length > 0) {
      setupHero(catalogData[0]);
    }
    
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

// Setup Featured Hero
function setupHero(item) {
  if (!item) return;
  heroBackdrop.style.backgroundImage = `url('${item.cover_image}')`;
  heroTitle.innerText = item.title;
  heroDesc.innerText = item.description || `Watch ${item.title} exclusively on WebMasti with HD stream & zero ads.`;
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

    card.onclick = () => openModal(item);
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


// Open Detail & Streaming Modal
function openModal(item) {
  modalCover.src = item.cover_image;
  modalTitle.innerText = item.title;
  modalDescription.innerText = item.description || `Watch all episodes of ${item.title} with high-speed direct MP4 streaming on WebMasti.`;
  
  modalCategories.innerHTML = (item.categories || [])
    .map(c => `<span class="meta-tag">${c}</span>`)
    .join('');

  const episodes = item.episodes || [];
  epCount.innerText = episodes.length;

  episodesGrid.innerHTML = '';
  
  if (episodes.length === 0) {
    episodesGrid.innerHTML = `<p style="color:#9ca3af; font-size:0.9rem;">No episodes available for this item.</p>`;
    // Fallback if video_urls exist directly
    if (item.video_urls && item.video_urls.length > 0) {
      playVideo(item.video_urls[0], 'Full Video');
    }
  } else {
    episodes.forEach((ep, idx) => {
      const epBtn = document.createElement('button');
      epBtn.className = `btn-ep ${idx === 0 ? 'active' : ''}`;
      epBtn.innerHTML = `
        <span>${ep.title || 'Episode ' + (idx + 1)}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      `;

      epBtn.onclick = () => {
        document.querySelectorAll('.btn-ep').forEach(b => b.classList.remove('active'));
        epBtn.classList.add('active');
        if (ep.video_url) {
          playVideo(ep.video_url, ep.title);
        } else {
          playerStatus.innerText = '⚠️ Video link missing for this episode';
        }
      };

      episodesGrid.appendChild(epBtn);
    });

    // Auto play 1st episode if video link exists
    if (episodes[0] && episodes[0].video_url) {
      playVideo(episodes[0].video_url, episodes[0].title);
    }
  }

  playerModal.classList.add('active');
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

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', loadCatalog);

