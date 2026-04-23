import type { FC } from "hono/jsx";
import { raw } from "hono/html";

export const HighlightsPage: FC = () => (
  <div>
    <header class="mb-8 text-center">
      <div aria-hidden="true" class="mb-3 flex items-center justify-center gap-3">
        <span class="h-px w-16 bg-saffron-600/30"></span>
        <span class="font-display text-saffron-700 text-2xl leading-none">॥</span>
        <span class="h-px w-16 bg-saffron-600/30"></span>
      </div>
      <h1 class="font-display text-4xl md:text-5xl font-bold text-maroon-700">Highlights of previous events</h1>
      <p id="tab-subtitle" class="mt-3 text-ink/60">Photos curated from the event</p>
    </header>

    {/* Tabs */}
    <div class="mb-10 flex justify-center">
      <div
        role="tablist"
        class="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-saffron-200"
      >
        <button
          type="button"
          role="tab"
          data-tab="goa"
          class="highlights-tab rounded-full px-6 py-2 text-sm font-semibold transition"
        >
          Goa Mahotsav
        </button>
        <button
          type="button"
          role="tab"
          data-tab="delhi"
          class="highlights-tab rounded-full px-6 py-2 text-sm font-semibold transition"
        >
          Delhi Mahotsav
        </button>
      </div>
    </div>

    <div id="loader" class="flex justify-center my-10">
      <div class="w-12 h-12 border-4 border-saffron-600 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <p id="status-msg" class="hidden text-center text-ink/60 font-medium mb-8"></p>

    <div
      id="gallery-grid"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
    ></div>

    <div
      id="pagination-controls"
      class="mt-12 mb-8 flex items-center justify-center gap-4"
      style="display:none"
    >
      <button
        id="prev-page"
        class="rounded-lg bg-white px-4 py-2 font-semibold text-ink shadow hover:bg-saffron-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span id="page-info" class="font-medium text-ink/70">Page 1 of 1</span>
      <button
        id="next-page"
        class="rounded-lg bg-white px-4 py-2 font-semibold text-ink shadow hover:bg-saffron-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>

    {/* Lightbox */}
    <div
      id="lightbox"
      class="fixed inset-0 z-50 hidden flex-col items-center justify-center bg-black/95"
    >
      <button
        id="lb-close"
        aria-label="Close"
        class="absolute right-4 top-4 z-50 text-5xl leading-none text-white"
      >
        &times;
      </button>
      <button
        id="lb-prev"
        aria-label="Previous"
        class="absolute left-2 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:left-4 md:p-4"
      >
        <svg class="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        id="lb-next"
        aria-label="Next"
        class="absolute right-2 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-4 md:p-4"
      >
        <svg class="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div class="flex h-full w-full flex-col items-center justify-center p-4">
        <img
          id="lightbox-img"
          src=""
          alt=""
          referrerpolicy="no-referrer"
          class="max-h-[70vh] max-w-full object-contain shadow-2xl md:max-h-[85vh]"
        />
        <p id="lightbox-caption" class="mt-6 px-4 text-center font-medium text-white"></p>
      </div>
    </div>

    {raw(`<script>
(function(){
  const ITEMS_PER_PAGE = 20;
  const TABS = {
    goa:   { label: 'Goa Mahotsav',   subtitle: 'Photos curated from the Goa Mahotsav' },
    delhi: { label: 'Delhi Mahotsav', subtitle: 'Photos curated from the Delhi Mahotsav' },
  };
  const DEFAULT_TAB = 'goa';

  const cache = {};   // { goa: [...], delhi: [...] }
  let activeTab = DEFAULT_TAB;
  let files = [];
  let page = 1;
  let idx = 0;

  const grid      = document.getElementById('gallery-grid');
  const loader    = document.getElementById('loader');
  const statusMsg = document.getElementById('status-msg');
  const pageInfo  = document.getElementById('page-info');
  const btnPrev   = document.getElementById('prev-page');
  const btnNext   = document.getElementById('next-page');
  const pagCtrl   = document.getElementById('pagination-controls');
  const subtitle  = document.getElementById('tab-subtitle');
  const lb        = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightbox-img');
  const lbCap     = document.getElementById('lightbox-caption');
  const tabEls    = document.querySelectorAll('.highlights-tab');

  const TAB_ACTIVE   = ['bg-saffron-600','text-white','shadow'];
  const TAB_INACTIVE = ['text-ink/70','hover:text-maroon-700','hover:bg-saffron-50'];

  function paintTabs(){
    tabEls.forEach(el => {
      const isActive = el.dataset.tab === activeTab;
      TAB_ACTIVE.forEach(c => el.classList.toggle(c, isActive));
      TAB_INACTIVE.forEach(c => el.classList.toggle(c, !isActive));
      el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }

  async function loadTab(key){
    activeTab = TABS[key] ? key : DEFAULT_TAB;
    paintTabs();
    subtitle.textContent = TABS[activeTab].subtitle;
    page = 1;
    history.replaceState(null, '', '#' + activeTab);

    if (cache[activeTab]) {
      files = cache[activeTab];
      loader.classList.add('hidden');
      renderOrEmpty();
      return;
    }

    // show loader, hide grid/status
    grid.innerHTML = '';
    statusMsg.classList.add('hidden');
    pagCtrl.style.display = 'none';
    loader.classList.remove('hidden');

    try {
      const res = await fetch('/api/highlights?event=' + encodeURIComponent(activeTab));
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error) || 'Request failed');
      const list = (data.files || [])
        .map(f => ({ ...f, fullDate: fmtDate(f.createdTime) }))
        .sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      cache[activeTab] = list;
      if (activeTab !== key && !TABS[key]) { /* user switched tabs already, no-op */ }
      files = cache[activeTab];
      loader.classList.add('hidden');
      renderOrEmpty();
    } catch (err) {
      console.error(err);
      loader.classList.add('hidden');
      statusMsg.textContent = 'Could not load photos. Please try again later.';
      statusMsg.classList.remove('hidden');
    }
  }

  function renderOrEmpty(){
    if (!files || files.length === 0) {
      statusMsg.textContent = 'No photos yet.';
      statusMsg.classList.remove('hidden');
      grid.innerHTML = '';
      pagCtrl.style.display = 'none';
      return;
    }
    statusMsg.classList.add('hidden');
    render();
  }

  function render(){
    const totalPages = Math.max(1, Math.ceil(files.length / ITEMS_PER_PAGE));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const items = files.slice(start, start + ITEMS_PER_PAGE);

    grid.innerHTML = '';
    items.forEach((f, i) => {
      const thumb = (f.thumbnailLink || '').replace(/=s\\d+/, '=s800');
      const gIdx = start + i;
      const card = document.createElement('div');
      card.className = 'group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-300 hover:shadow-xl';
      card.innerHTML =
        '<div class="relative h-48 bg-saffron-100">' +
          '<img src="' + thumb + '" alt="" referrerpolicy="no-referrer" ' +
            'class="h-full w-full object-cover opacity-0 transition-transform duration-500 group-hover:scale-110" ' +
            'onload="this.classList.remove(\\'opacity-0\\')" onerror="this.style.display=\\'none\\'">' +
          '<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">' +
            '<p class="text-xs font-semibold text-white">' + f.fullDate + '</p>' +
          '</div>' +
        '</div>';
      card.addEventListener('click', () => openLightbox(gIdx));
      grid.appendChild(card);
    });

    pageInfo.textContent = 'Page ' + page + ' of ' + totalPages;
    btnPrev.disabled = page === 1;
    btnNext.disabled = page === totalPages;
    pagCtrl.style.display = totalPages <= 1 ? 'none' : 'flex';
  }

  function openLightbox(i){
    idx = i;
    showImage();
    lb.classList.remove('hidden');
    lb.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    lb.classList.add('hidden');
    lb.classList.remove('flex');
    document.body.style.overflow = '';
    lbImg.src = '';
  }
  function slide(dir){
    if (!files.length) return;
    idx = (idx + dir + files.length) % files.length;
    showImage();
  }
  function showImage(){
    const f = files[idx];
    const hi = (f.thumbnailLink || '').replace(/=s\\d+/, '=s1600');
    lbImg.src = hi;
    lbCap.textContent = f.fullDate + '  (' + (idx + 1) + ' / ' + files.length + ')';
  }

  tabEls.forEach(el => el.addEventListener('click', () => loadTab(el.dataset.tab)));
  btnPrev.addEventListener('click', () => { page--; render(); window.scrollTo({top:0,behavior:'smooth'}); });
  btnNext.addEventListener('click', () => { page++; render(); window.scrollTo({top:0,behavior:'smooth'}); });
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', () => slide(-1));
  document.getElementById('lb-next').addEventListener('click', () => slide(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (lb.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') slide(-1);
    else if (e.key === 'ArrowRight') slide(1);
  });

  // initial tab from URL hash (#goa / #delhi) or default
  const initialHash = (location.hash || '').replace('#','').toLowerCase();
  loadTab(TABS[initialHash] ? initialHash : DEFAULT_TAB);
})();
</script>`)}
  </div>
);
