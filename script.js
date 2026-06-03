// ── AUTH: JWT-based (data dari database, bukan hard-coded) ────────
const API_BASE = 'https://cobapart3-production.up.railway.app';

// Simpan & ambil token dari localStorage
function saveToken(token)  { localStorage.setItem('auth_token', token); }
function getToken()        { return localStorage.getItem('auth_token'); }
function removeToken()     { localStorage.removeItem('auth_token'); }

// Buat header Authorization untuk setiap fetch ke API
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken() || ''}`
  };
}

let currentRole = null;
let currentUser  = null;
let selectedLoginRole = 'admin';

// Cek token saat halaman pertama kali dibuka
async function checkSavedSession() {
  const token = getToken();
  if (!token) return;
  try {
    const res  = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok && data.user) {
      currentRole = data.user.role;
      currentUser = data.user;
      applyRole(data.user);
      switchPage('keuangan');
    } else {
      removeToken();
    }
  } catch (_) {
    removeToken();
  }
}

function openLoginModal() {
  const backdrop = document.getElementById('loginModalBackdrop');
  backdrop.classList.add('open');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginUsername').focus();
  setLoginRoleTab('admin');
}
function closeLoginModal() {
  document.getElementById('loginModalBackdrop').classList.remove('open');
}
function setLoginRoleTab(role) {
  selectedLoginRole = role;
  document.querySelectorAll('.login-role-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.login-role-tab[data-role="${role}"]`).classList.add('active');
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginUsername').focus();
  const isUser = role === 'user';
  document.getElementById('loginGuestBtn').style.display     = isUser ? 'flex' : 'none';
  document.getElementById('loginGuestDivider').style.display = isUser ? 'flex' : 'none';
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btnText  = document.getElementById('loginBtnText');
  const btnLoader= document.getElementById('loginBtnLoader');

  errEl.style.display    = 'none';
  btnText.style.display  = 'none';
  btnLoader.style.display= 'inline-flex';

  try {
    const res  = await fetch(`${API_BASE}/api/login`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      saveToken(data.token);
      currentRole = data.user.role;
      currentUser  = data.user;
      localStorage.setItem('last_login_time', new Date().toISOString());
      applyRole(data.user);
      closeLoginModal();
      switchPage('keuangan');
    } else {
      errEl.textContent   = data.error || 'Username atau password salah.';
      errEl.style.display = 'flex';
    }
  } catch (_) {
    errEl.textContent   = 'Tidak dapat terhubung ke server.';
    errEl.style.display = 'flex';
  } finally {
    btnText.style.display  = 'inline';
    btnLoader.style.display= 'none';
  }
}

function loginAsGuest() {
  currentRole = 'user';
  currentUser  = null;
  document.body.classList.remove('role-admin', 'role-user');
  document.body.classList.add('role-user');
  document.getElementById('headerAvatar').textContent    = 'G';
  document.getElementById('headerUserName').textContent  = 'Tamu';
  document.getElementById('headerUserRole').textContent  = 'Guest Access';
  document.getElementById('headerRoleBadge').textContent = 'User';
  closeLoginModal();
  switchPage('keuangan');
}

function applyRole(user) {
  document.body.classList.remove('role-admin', 'role-user');
  document.body.classList.add('role-' + user.role);
  document.getElementById('headerAvatar').textContent    = user.initials || user.username.slice(0,2).toUpperCase();
  document.getElementById('headerUserName').textContent  = user.nama || user.username;
  document.getElementById('headerUserRole').textContent  = user.divisi || (user.role === 'admin' ? 'Administrator' : 'Read Only Access');
  document.getElementById('headerRoleBadge').textContent = user.role === 'admin' ? 'Admin' : 'User';
  // Sembunyikan tombol Login di hero setelah user berhasil login
  const hpLoginBtn = document.getElementById('hpLoginBtn');
  if (hpLoginBtn) hpLoginBtn.style.display = 'none';
}

// LOGOUT
async function doLogout() {
  // Catat logout ke audit log sebelum hapus token
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (_) { /* Lanjut logout meski request gagal */ }

  removeToken();
  currentRole = null;
  currentUser  = null;
  document.body.classList.remove('role-admin', 'role-user');
  // Tampilkan kembali tombol Login di hero
  const hpLoginBtn = document.getElementById('hpLoginBtn');
  if (hpLoginBtn) hpLoginBtn.style.display = '';
  switchPage('home');
}

// Panggil cek session saat halaman dimuat
document.addEventListener('DOMContentLoaded', checkSavedSession);


/* ══ PROFILE DROPDOWN ══ */
function toggleProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.classList.toggle('open');
}
function closeProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.classList.remove('open');
}

// Tutup dropdown saat klik di luar
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('headerUserWrap');
  const dd   = document.getElementById('profileDropdown');
  if (dd && wrap && !wrap.contains(e.target)) closeProfileDropdown();
});

// Hubungkan item dropdown ke aksi
document.addEventListener('DOMContentLoaded', function() {
  // Tambah Data
  document.getElementById('ddTambahData')?.addEventListener('click', function() {
    closeProfileDropdown();
    if (typeof window.openTambahDataModal === 'function') window.openTambahDataModal();
  });

  document.getElementById('ddAdminPanel')?.addEventListener('click', function() {
    closeProfileDropdown();
    if (typeof window.openAdminPage === 'function') window.openAdminPage('hapus');
  });
});
document.addEventListener('DOMContentLoaded', () => {
  // Tab role
  document.querySelectorAll('.login-role-tab').forEach(tab => {
    tab.addEventListener('click', () => setLoginRoleTab(tab.dataset.role));
  });

  document.getElementById('loginSubmitBtn').addEventListener('click', doLogin);

  document.getElementById('loginModal').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  document.getElementById('loginModalBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('loginModalBackdrop')) closeLoginModal();
  });

  document.getElementById('loginTogglePw').addEventListener('click', () => {
    const input = document.getElementById('loginPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

const pageMeta = {
  home: {
    title: "PT Indocement Financial Dashboard",
    sub:   "Financial Analytics Platform"
  },
  // Dashboard Keuangan → Operasional
  keuangan:    { title: "Dashboard Keuangan", sub: "Operasional — Financial Overview · Per data terakhir: December 2025" },
  operasional: { title: "Dashboard Keuangan", sub: "Operasional — Resource Overview · Per data terakhir: December 2025" },
  penjualan:   { title: "Dashboard Keuangan", sub: "Operasional — Cash Flow Health · Per data terakhir: December 2025" },
  // Dashboard Keuangan → Financial Performance
  margin:  { title: "Dashboard Keuangan", sub: "Financial Performance — Margin Trends · Per data terakhir: December 2025" },
  balance: { title: "Dashboard Keuangan", sub: "Financial Performance — Balance Sheet Trends · Per data terakhir: December 2025" },
  kfi:     { title: "Dashboard Keuangan", sub: "Financial Performance — Key Financial Indicators · Per data terakhir: December 2025" },
  // Laporan Keuangan
  'laporan-keuangan': { title: "Laporan Keuangan", sub: "PT Indocement Tunggal Prakarsa Tbk" },
  admin: { title: "Admin Panel", sub: "Kelola data & pengumuman — PT INDOCEMENT" },
};

/* ── MAP: page → nav group yang harus dibuka otomatis ── */
const pageToNavGroup = {
  // Dashboard Keuangan group
  keuangan:    'navgroup-dashboard',
  operasional: 'navgroup-dashboard',
  penjualan:   'navgroup-dashboard',
  margin:      'navgroup-dashboard',
  balance:     'navgroup-dashboard',
  kfi:         'navgroup-dashboard',
};

/* ── SUB-GROUP mapping (page → sub-group) ── */
const pageToSubGroup = {
  keuangan:    'navsubgroup-operational',
  operasional: 'navsubgroup-operational',
  penjualan:   'navsubgroup-operational',
  margin:      'navsubgroup-financial',
  balance:     'navsubgroup-financial',
  kfi:         'navsubgroup-financial',
};

/* ── Toggle collapsible nav group ── */
function toggleNavGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.toggle('open');
}

/* ── Open a specific nav group (without closing others) ── */
function openNavGroup(groupId) {
  const group = document.getElementById(groupId);
  if (group && !group.classList.contains('open')) {
    group.classList.add('open');
  }
}

/* ── Toggle collapsible nav sub-group ── */
function toggleNavSubGroup(subGroupId) {
  const group = document.getElementById(subGroupId);
  if (!group) return;
  group.classList.toggle('open');
}

/* ── Open a specific nav sub-group ── */
function openNavSubGroup(subGroupId) {
  const group = document.getElementById(subGroupId);
  if (group && !group.classList.contains('open')) {
    group.classList.add('open');
  }
}

/* ── 2. ROUTER ── */
function switchPage(target) {
  // Jika bukan home dan belum login, tampilkan modal login
  if (target !== 'home' && !currentRole) {
    openLoginModal();
    return;
  }

  if (target === 'admin' && currentRole !== 'admin') {
    alert('Akses ditolak. Halaman Admin hanya untuk role Admin.');
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page-body').forEach(p => p.classList.remove('active-page'));

  // Clear active state from nav-item AND nav-sub-item
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const page = document.getElementById('page-' + target);
  if (page) page.classList.add('active-page');

  // Activate the correct nav element (top-level item or sub-item)
  const navItem = document.querySelector(`.nav-item[data-page="${target}"]`);
  if (navItem) navItem.classList.add('active');

  const subItem = document.querySelector(`.nav-sub-item[data-page="${target}"]`);
  if (subItem) subItem.classList.add('active');

  // Auto-open the nav group that contains this page
  const groupId = pageToNavGroup[target];
  if (groupId) openNavGroup(groupId);

  // Auto-open the nav sub-group if applicable
  const subGroupId = pageToSubGroup ? pageToSubGroup[target] : null;
  if (subGroupId) openNavSubGroup(subGroupId);

  // Toggle homepage mode
  const mainHeader = document.querySelector('header.header');
  const bannerArea = document.getElementById('bannerArea');
  const hpLoginBtn = document.getElementById('hpLoginBtn');

  if (target === 'home') {
    document.body.classList.add('on-homepage');
    document.body.classList.remove('lk-fullbleed', 'profile-active', 'admin-active');
    // Sembunyikan app header saat di homepage
    if (mainHeader) mainHeader.style.display = 'none';
    if (bannerArea) bannerArea.style.display = 'none';
    // Tombol Login di hero: tampilkan hanya jika belum login
    if (hpLoginBtn) hpLoginBtn.style.display = currentRole ? 'none' : '';
  } else {
    document.body.classList.remove('on-homepage');
    const meta = pageMeta[target] || pageMeta.keuangan;
    document.getElementById('pageTitle').textContent    = meta.title;
    document.getElementById('pageSubtitle').textContent = meta.sub;

    if (target === 'laporan-keuangan') {
      if (mainHeader) mainHeader.style.display = '';
      if (bannerArea) bannerArea.style.display = '';
      document.body.classList.remove('lk-fullbleed', 'profile-active', 'admin-active');
    } else if (target === 'admin') {
      if (mainHeader) mainHeader.style.display = 'none';
      if (bannerArea) bannerArea.style.display = 'none';
      document.body.classList.remove('lk-fullbleed', 'profile-active');
      document.body.classList.add('admin-active');
    } else if (target === 'profile') {
      if (mainHeader) mainHeader.style.display = 'none';
      if (bannerArea) bannerArea.style.display = 'none';
      document.body.classList.remove('lk-fullbleed', 'admin-active');
      document.body.classList.add('profile-active');
    } else {
      if (mainHeader) mainHeader.style.display = '';
      if (bannerArea) bannerArea.style.display = '';
      document.body.classList.remove('lk-fullbleed', 'profile-active', 'admin-active');
    }
  }

  // Close notif panel on page switch
  if (typeof notifPanel !== 'undefined') notifPanel.classList.remove('open');

  // Load Metabase iframes saat halaman pertama kali dibuka
  if (target === 'margin') {
    if (typeof updateMargin === 'function') updateMargin();
    if (typeof updateKpiMargin === 'function') updateKpiMargin();
  }
}

// Only attach click listeners to top-level nav-items (Home)
// Sub-items use inline onclick="switchPage(...)" in HTML
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', function (e) {
    e.preventDefault();
    switchPage(this.dataset.page);
  });
});

/* ── 3. QUARTER PILL BUTTONS ──
   Replaces old <select> quarter filters with pill button groups.
   Each group syncs a hidden input and fires the matching update function.
*/
function initQuarterBtns(groupId, hiddenInputId, onChangeCallback) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const hidden = document.getElementById(hiddenInputId);

  group.querySelectorAll('.q-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      group.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      if (hidden) hidden.value = this.dataset.val;
      if (onChangeCallback) onChangeCallback();
    });
  });
}

/* ── 4. KEUANGAN FILTERS ── */
const KEU = {
  "keu-chart1": "http://localhost:3000/public/question/cc5f3355-5e12-442c-b9a1-780f2b9cd21f?titled=false",
  "keu-chart2": "http://localhost:3000/public/question/9cfdc768-ee6f-4e39-8044-a59785117ea7?titled=false",
  "keu-chart3": "http://localhost:3000/public/question/36fff35d-3860-4642-979e-9fe40cca46aa?titled=false",
};

function updateKeuangan() {
  const params = new URLSearchParams();
  const y = document.getElementById("keu-yearFilter").value;
  const q = document.getElementById("keu-quarterFilter").value;
  if (y) params.set("year",    y);
  if (q) params.set("quarter", q);
  const qs = params.toString();

  // Update "Showing" label
  const showEl = document.getElementById('keu-showingYear');
  if (showEl) showEl.textContent = y || 'All Years';

  Object.entries(KEU).forEach(([id, base]) => {
    const el = document.getElementById(id);
    if (el) el.src = qs ? `${base}&${qs}` : base;
  });
}

const _keuYearFilterEl = document.getElementById("keu-yearFilter");
if (_keuYearFilterEl) _keuYearFilterEl.addEventListener("change", updateKeuangan);
initQuarterBtns('keu-quarterBtns', 'keu-quarterFilter', updateKeuangan);

/* ── 5. OPERASIONAL FILTERS ── */
const OPS = {
  "ops-chart1": "http://localhost:3000/public/question/8b501fe6-625f-4fa3-b39a-ef668a435714?titled=false",
  "ops-chart2": "http://localhost:3000/public/question/cc5f3355-5e12-442c-b9a1-780f2b9cd21f?titled=false",
  "ops-chart3": "http://localhost:3000/public/question/acd2f9b1-d901-44ed-b4c1-9ca3efa6f3f1?titled=false",
  "ops-chart4": "http://localhost:3000/public/question/efe9aeae-0f2f-486c-99fe-eb6bab863a7e?titled=false",
};

function updateOps() {
  const params = new URLSearchParams();
  const y = document.getElementById("ops-yearFilter").value;
  const q = document.getElementById("ops-catFilter").value;
  if (y) params.set("year",    y);
  if (q) params.set("quarter", q);
  const qs = params.toString();

  const showEl = document.getElementById('ops-showingYear');
  if (showEl) showEl.textContent = y || 'All Years';

  Object.entries(OPS).forEach(([id, base]) => {
    const el = document.getElementById(id);
    if (el) el.src = qs ? `${base}&${qs}` : base;
  });
}

initQuarterBtns('ops-quarterBtns', 'ops-catFilter', updateOps);

/* ── 6. PROFIT VS CASH QUALITY FILTERS ── */
const PCQ_BASES = {
  "pcq-chart1": "http://localhost:3000/public/question/9cfdc768-ee6f-4e39-8044-a59785117ea7?titled=false",
};

function updatePCQ() {
  const params = new URLSearchParams();
  const y = document.getElementById("pcq-yearFilter").value;
  const q = document.getElementById("pcq-quarterFilter").value;
  if (y) params.set("year",    y);
  if (q) params.set("quarter", q);
  const qs = params.toString();

  const showEl = document.getElementById('pcq-showingYear');
  if (showEl) showEl.textContent = y || 'All Years';

  Object.entries(PCQ_BASES).forEach(([id, base]) => {
    const el = document.getElementById(id);
    if (el) el.src = qs ? `${base}&${qs}` : base;
  });
}

initQuarterBtns('pcq-quarterBtns', 'pcq-quarterFilter', updatePCQ);

/* ── 7. FCF & SUSTAINABILITY FILTERS ── */
function updateFCF() {
  const y = document.getElementById("fcf-yearFilter").value;
  const showEl = document.getElementById('fcf-showingYear');
  if (showEl) showEl.textContent = y || 'All Years';
  // Connect to Metabase iframes here when ready
}

const fcfYearEl = document.getElementById("fcf-yearFilter");
if (fcfYearEl) fcfYearEl.addEventListener("change", updateFCF);
initQuarterBtns('fcf-quarterBtns', 'fcf-quarterFilter', updateFCF);

/* ── 8. MARGIN TRENDS FILTERS ── */
const MG_BASES = {
  // Chart 1 — Gross Margin Performance (UUID sudah dikonfirmasi)
  "mg-chart-gross":  "http://localhost:3000/public/question/67725a9a-bf3a-4a38-b120-8ad1824241cc?titled=false",
  // Chart 2 — EBITDA Margin Performance (ganti UUID_EBITDA dengan UUID asli dari Metabase)
  "mg-chart-ebitda": "http://localhost:3000/public/question/654e6a7c-7769-4c6e-a7a4-2a20a7828041?titled=false",
  // Chart 3 — Annual Margin Trend (ganti UUID_ANNUAL dengan UUID asli dari Metabase)
  "mg-chart-annual": "http://localhost:3000/public/question/6135fa0f-7d65-4b07-bb99-6d512d0b2364?titled=false",
  // Chart 4 — Margin Summary Table (ganti UUID_TABLE dengan UUID asli dari Metabase)
  "mg-chart-table":  "http://localhost:3000/public/question/5c6039e6-15bb-4c7e-9d31-0199542e1517?titled=false",
};

function updateMargin() {
  const params = new URLSearchParams();
  const y = document.getElementById("mg-yearFilter").value;
  const q = document.getElementById("mg-quarterFilter").value;
  if (y) params.set("year",    y);
  if (q) params.set("quarter", q);
  const qs = params.toString();

  const showEl = document.getElementById('mg-showingYear');
  if (showEl) showEl.textContent = y || 'All Years';

  Object.entries(MG_BASES).forEach(([id, base]) => {
    const el = document.getElementById(id);
    if (el) el.src = qs ? `${base}&${qs}` : base;
  });
}

const mgYearEl = document.getElementById("mg-yearFilter");
initQuarterBtns('mg-quarterBtns', 'mg-quarterFilter', updateMargin);

/* ══════════════════════════════════════════
   KPI DINAMIS — RESOURCE OVERVIEW (ops)
   ══════════════════════════════════════════ */

const OPS_KPI_MAP = [
  { valId: 'ops-kpi-operating',  badgeId: 'ops-kpi-operating-badge',  key: 'operating',  suffix: '%' },
  { valId: 'ops-kpi-investing',  badgeId: 'ops-kpi-investing-badge',   key: 'investing',  suffix: '%' },
  { valId: 'ops-kpi-financing',  badgeId: 'ops-kpi-financing-badge',   key: 'financing',  suffix: '%' },
  { valId: 'ops-kpi-inflow',     badgeId: 'ops-kpi-inflow-badge',      key: 'inflow',     prefix: 'Rp ', suffix: '' },
  { valId: 'ops-kpi-outflow',    badgeId: 'ops-kpi-outflow-badge',     key: 'outflow',    prefix: 'Rp ', suffix: '' },
];

function setOpsKpiLoading() {
  OPS_KPI_MAP.forEach(({ valId }) => {
    const el = document.getElementById(valId);
    if (el) el.innerHTML = '<span class="kpi-loading">· · ·</span>';
  });
}

function renderOpsKpiCard({ valId, badgeId, key, prefix = '', suffix = '' }, data) {
  const valEl   = document.getElementById(valId);
  const badgeEl = document.getElementById(badgeId);
  if (!valEl) return;

  if (!data.ada_data || !data[key] || data[key].nilai === undefined || data[key].nilai === null) {
    valEl.innerHTML = '<span class="kpi-loading">—</span>';
    if (badgeEl) { badgeEl.textContent = '—'; badgeEl.className = 'kpi-badge'; }
    return;
  }

  const d = data[key];
  valEl.classList.add('kpi-updating');
  setTimeout(() => {
    valEl.textContent = d.nilai !== null ? `${prefix}${d.nilai}${suffix}` : '—';
    valEl.classList.remove('kpi-updating');
  }, 180);

  if (badgeEl) {
    if (d.pct !== null && d.pct !== undefined) {
      const naik = d.pct >= 0;
      badgeEl.innerHTML = `${naik ? '↑ +' : '↓ '}${Math.abs(d.pct)}%`;
      badgeEl.className = 'kpi-badge ' + (naik ? 'up' : 'down');
    } else {
      badgeEl.textContent = 'base year';
      badgeEl.className   = 'kpi-badge';
    }
  }
}

function renderOpsKpi(data) {
  OPS_KPI_MAP.forEach(item => renderOpsKpiCard(item, data));

  // Update period label — semua 5 KPI card
  const tahun   = data.filter?.tahun;
  const kuartal = data.filter?.kuartal;
  const label   = tahun
    ? (kuartal ? `${kuartal} ${tahun} vs ${kuartal} ${tahun - 1}` : `Full Year ${tahun} vs ${tahun - 1}`)
    : 'vs last year';
  ['ops-kpi-period-1','ops-kpi-period-2','ops-kpi-period-3','ops-kpi-period-4','ops-kpi-period-5'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

async function updateKpiOps() {
  const tahun   = document.getElementById('ops-yearFilter')?.value;
  const kuartal = document.getElementById('ops-catFilter')?.value;

  const params = new URLSearchParams();
  if (tahun)   params.set('tahun',   tahun);
  if (kuartal) params.set('kuartal', kuartal);

  setOpsKpiLoading();

  try {
    const res  = await fetch(`${API_BASE}/api/kpi/operasional?${params}`);
    const data = await res.json();
    renderOpsKpi(data);
  } catch (_) {
    renderOpsKpi({ ada_data: false, filter: { tahun, kuartal } });
  }
}

// Hook filter ops ke KPI ops
const _opsYearEl = document.getElementById('ops-yearFilter');
if (_opsYearEl) _opsYearEl.addEventListener('change', () => { updateOps(); updateKpiOps(); });

const _opsQGroup = document.getElementById('ops-quarterBtns');
if (_opsQGroup) {
  _opsQGroup.querySelectorAll('.q-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(updateKpiOps, 50));
  });
}

// FILTER KPI

async function updateKpiPCQ() {
  const tahun   = document.getElementById('pcq-yearFilter')?.value;
  const kuartal = document.getElementById('pcq-quarterFilter')?.value;

  const params = new URLSearchParams();
  if (tahun)   params.set('tahun',   tahun);
  if (kuartal) params.set('kuartal', kuartal);

  const eqrEl    = document.getElementById('pcq-kpi-eqr');
  const badgeEl  = document.getElementById('pcq-kpi-eqr-badge');
  const niValEl  = document.getElementById('pcq-kpi-ni-val');
  const ocfValEl = document.getElementById('pcq-kpi-ocf-val');
  const niLblEl  = document.getElementById('pcq-kpi-ni-label');

  if (eqrEl)    eqrEl.innerHTML = '<span class="kpi-loading">· · ·</span>';
  if (niValEl)  niValEl.innerHTML = '<span class="kpi-loading">· · ·</span>';
  if (ocfValEl) ocfValEl.innerHTML = '<span class="kpi-loading">· · ·</span>';

  try {
    const res  = await fetch(`${API_BASE}/api/kpi/cashflow?${params}`);
    const data = await res.json();

    if (!data.ada_data) {
      if (eqrEl)    eqrEl.textContent = '—';
      if (badgeEl)  { badgeEl.textContent = '—'; badgeEl.className = 'kpi-badge'; }
      if (niValEl)  niValEl.textContent = '—';
      if (ocfValEl) ocfValEl.textContent = '—';
      return;
    }

    // EQR value
    if (eqrEl && data.eqr?.nilai !== undefined) {
      eqrEl.classList.add('kpi-updating');
      setTimeout(() => {
        eqrEl.textContent = data.eqr.nilai ?? '—';
        eqrEl.classList.remove('kpi-updating');
      }, 180);
    }

    // EQR badge
    if (badgeEl && data.eqr) {
      const pct = data.eqr.pct;
      if (pct !== null && pct !== undefined) {
        const naik = pct >= 0;
        badgeEl.innerHTML = `${naik ? '↑' : '↓'} ${Math.abs(pct)}% of net income`;
        badgeEl.className = 'kpi-badge ' + (naik ? 'up' : 'down');
      } else {
        badgeEl.textContent = 'base year';
        badgeEl.className   = 'kpi-badge';
      }
    }

    // Net Income detail
    const tahunLabel = tahun || 'Latest';
    if (niLblEl) niLblEl.textContent = `Net Income ${tahunLabel}`;
    if (niValEl && data.net_income?.nilai !== undefined) {
      niValEl.textContent = data.net_income.nilai !== null ? `Rp ${data.net_income.nilai}` : '—';
    }

    // OCF detail
    if (ocfValEl && data.ocf?.nilai !== undefined) {
      ocfValEl.textContent = data.ocf.nilai !== null ? `Rp ${data.ocf.nilai}` : '—';
    }

  } catch (_) {
    if (eqrEl)    eqrEl.textContent = '—';
    if (badgeEl)  { badgeEl.textContent = '—'; badgeEl.className = 'kpi-badge'; }
    if (niValEl)  niValEl.textContent = '—';
    if (ocfValEl) ocfValEl.textContent = '—';
  }
}

// Hook filter pcq ke KPI pcq
const _pcqYearEl = document.getElementById('pcq-yearFilter');
if (_pcqYearEl) _pcqYearEl.addEventListener('change', () => { updatePCQ(); updateKpiPCQ(); });

const _pcqQGroup = document.getElementById('pcq-quarterBtns');
if (_pcqQGroup) {
  _pcqQGroup.querySelectorAll('.q-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(updateKpiPCQ, 50));
  });
}

/* ══════════════════════════════════════════
   KPI DINAMIS — MARGIN TRENDS
   Fetch dari /api/kpi/margin?tahun=&kuartal=
   dan render ke 3 KPI card (Gross, EBITDA, Net Margin)
   ══════════════════════════════════════════ */

const MG_KPI_MAP = [
  {
    valId:    'mg-kpi-gm-val',
    badgeId:  'mg-kpi-gm-badge',
    labelId:  'mg-kpi-gm-label',
    periodId: 'mg-kpi-gm-period',
    key:      'gross_margin',
    baseLabel: 'Gross Margin',
  },
  {
    valId:    'mg-kpi-em-val',
    badgeId:  'mg-kpi-em-badge',
    labelId:  'mg-kpi-em-label',
    periodId: 'mg-kpi-em-period',
    key:      'ebitda_margin',
    baseLabel: 'EBITDA Margin',
  },
  {
    valId:    'mg-kpi-nm-val',
    badgeId:  'mg-kpi-nm-badge',
    labelId:  'mg-kpi-nm-label',
    periodId: 'mg-kpi-nm-period',
    key:      'net_margin',
    baseLabel: 'Net Margin',
  },
];

function setMgKpiLoading() {
  MG_KPI_MAP.forEach(({ valId }) => {
    const el = document.getElementById(valId);
    if (el) el.innerHTML = '· · · <span style="font-size:18px; font-weight:500; color:var(--text-secondary)">%</span>';
  });
}

function renderMgKpiCard(item, data) {
  const valEl    = document.getElementById(item.valId);
  const badgeEl  = document.getElementById(item.badgeId);
  const labelEl  = document.getElementById(item.labelId);
  const periodEl = document.getElementById(item.periodId);
  if (!valEl) return;

  // Update label dengan periode filter
  const tahun   = data.filter?.tahun;
  const kuartal = data.filter?.kuartal;
  const periodeStr = tahun
    ? (kuartal ? `${item.baseLabel} ${kuartal} ${tahun}` : `${item.baseLabel} FY${tahun}`)
    : item.baseLabel;
  if (labelEl) labelEl.textContent = periodeStr;

  // Update period comparison label
  const periodLabel = tahun
    ? (kuartal ? `vs ${kuartal} ${tahun - 1}` : `vs FY${tahun - 1}`)
    : 'vs last year';
  if (periodEl) periodEl.textContent = periodLabel;

  // Tidak ada data
  if (!data.ada_data || !data[item.key]) {
    valEl.innerHTML = '— <span style="font-size:18px; font-weight:500; color:var(--text-secondary)">%</span>';
    if (badgeEl) { badgeEl.textContent = '—'; badgeEl.className = 'kpi-badge'; }
    return;
  }

  const d = data[item.key];

  // Render nilai
  valEl.classList.add('kpi-updating');
  setTimeout(() => {
    const nilaiStr = d.nilai_fmt !== undefined ? d.nilai_fmt : (d.nilai !== null && d.nilai !== undefined ? Number(d.nilai).toFixed(1) : '—');
    valEl.innerHTML = `${nilaiStr} <span style="font-size:18px; font-weight:500; color:var(--text-secondary)">%</span>`;
    valEl.classList.remove('kpi-updating');
  }, 180);

  // Render badge delta (dalam pp = percentage points)
  if (badgeEl) {
    if (d.delta !== null && d.delta !== undefined) {
      const naik = d.delta >= 0;
      const deltaStr = d.delta_fmt || `${naik ? '+' : ''}${Number(d.delta).toFixed(1)} pp`;
      badgeEl.innerHTML = `${naik ? '↗' : '↘'} ${deltaStr}`;
      badgeEl.className = 'kpi-badge ' + (naik ? 'up' : 'down');
    } else {
      badgeEl.textContent = 'base year';
      badgeEl.className   = 'kpi-badge';
    }
  }
}

function renderMgKpi(data) {
  MG_KPI_MAP.forEach(item => renderMgKpiCard(item, data));
}

async function updateKpiMargin() {
  const tahun   = document.getElementById('mg-yearFilter')?.value;
  const kuartal = document.getElementById('mg-quarterFilter')?.value;

  // Normalisasi: filter "All Years" dianggap kosong
  const tahunParam   = (tahun && tahun !== 'All Years') ? tahun : '';
  const kuartalParam = kuartal || '';

  const params = new URLSearchParams();
  if (tahunParam)   params.set('tahun',   tahunParam);
  if (kuartalParam) params.set('kuartal', kuartalParam);

  setMgKpiLoading();

  try {
    const res  = await fetch(`${API_BASE}/api/kpi/margin?${params}`);
    const data = await res.json();
    renderMgKpi(data);
  } catch (_) {
    renderMgKpi({ ada_data: false, filter: { tahun: tahunParam, kuartal: kuartalParam } });
  }
}

// Hook filter Margin Trends ke KPI dinamis
const _mgYearEl = document.getElementById('mg-yearFilter');
if (_mgYearEl) _mgYearEl.addEventListener('change', () => { updateMargin(); updateKpiMargin(); });

const _mgQGroup = document.getElementById('mg-quarterBtns');
if (_mgQGroup) {
  _mgQGroup.querySelectorAll('.q-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(updateKpiMargin, 50));
  });
}

/* ══════════════════════════════════════════
   KPI DINAMIS — BALANCE SHEET TRENDS
   Fetch dari /api/kpi/balance?tahun=&kuartal=
   Render ke 3 KPI: Total Aset, Total Ekuitas, Kas & Setara
   ══════════════════════════════════════════ */

const BS_KPI_MAP = [
  {
    valId:    'bs-kpi-assets-val',
    badgeId:  'bs-kpi-assets-badge',
    periodId: 'bs-kpi-assets-period',
    trendId:  'bs-kpi-assets-trend',
    key:      'total_assets',
    prefix:   'Rp ',
  },
  {
    valId:    'bs-kpi-equity-val',
    badgeId:  'bs-kpi-equity-badge',
    periodId: 'bs-kpi-equity-period',
    trendId:  'bs-kpi-equity-trend',
    key:      'total_equity',
    prefix:   'Rp ',
  },
  {
    valId:    'bs-kpi-cash-val',
    badgeId:  'bs-kpi-cash-badge',
    periodId: 'bs-kpi-cash-period',
    trendId:  'bs-kpi-cash-trend',
    key:      'kas_setara',
    prefix:   'Rp ',
  },
];

function setBsKpiLoading() {
  BS_KPI_MAP.forEach(({ valId }) => {
    const el = document.getElementById(valId);
    if (el) el.innerHTML = '<span class="kpi-loading">· · ·</span>';
  });
}

function renderBsKpiCard(item, data) {
  const valEl    = document.getElementById(item.valId);
  const badgeEl  = document.getElementById(item.badgeId);
  const periodEl = document.getElementById(item.periodId);
  const trendEl  = document.getElementById(item.trendId);
  if (!valEl) return;

  if (!data.ada_data || !data[item.key]) {
    valEl.innerHTML = '<span class="kpi-loading">—</span>';
    if (badgeEl)  { badgeEl.textContent = '—'; badgeEl.className = 'kpi-badge'; }
    if (periodEl) periodEl.textContent = '—';
    return;
  }

  const d = data[item.key];

  // Animasi fade nilai
  valEl.classList.add('kpi-updating');
  setTimeout(() => {
    const nilaiText = (d.nilai !== null && d.nilai !== undefined) ? d.nilai : '—';
    const unitSpan  = String(nilaiText).includes('M') || String(nilaiText).includes('Jt')
      ? '' : '<span class="kpi-unit"> T</span>';
    valEl.innerHTML = `${item.prefix}${nilaiText}${unitSpan}`;
    valEl.classList.remove('kpi-updating');
  }, 180);

  // Badge YoY %
  if (badgeEl) {
    if (d.pct !== null && d.pct !== undefined) {
      const naik = d.pct >= 0;
      badgeEl.innerHTML = `${naik ? '↑ +' : '↓ '}${Math.abs(d.pct)}%`;
      badgeEl.className = 'kpi-badge ' + (naik ? 'up' : 'down');
    } else {
      badgeEl.textContent = 'base year';
      badgeEl.className   = 'kpi-badge';
    }
  }

  // Period comparison label
  if (periodEl) {
    const tahun   = data.filter?.tahun;
    const kuartal = data.filter?.kuartal;
    periodEl.textContent = tahun
      ? (kuartal ? `vs ${kuartal} ${tahun - 1}` : `vs FY ${tahun - 1}`)
      : 'vs last year';
  }

  // Trend icon arah
  if (trendEl && d.naik !== null && d.naik !== undefined) {
    trendEl.className = 'kpi-trend-icon ' + (d.naik ? 'up' : 'down');
  }
}

function renderBsKpi(data) {
  BS_KPI_MAP.forEach(item => renderBsKpiCard(item, data));

  // Update "Showing" label di filter bar
  const showEl = document.getElementById('bs-showingYear');
  if (showEl) showEl.textContent = data.periode_label || 'All Years';
}

async function updateKpiBalance() {
  const tahun   = document.getElementById('bs-yearFilter')?.value;
  const kuartal = document.getElementById('bs-quarterFilter')?.value;

  const params = new URLSearchParams();
  if (tahun)   params.set('tahun',   tahun);
  if (kuartal) params.set('kuartal', kuartal);

  setBsKpiLoading();

  try {
    const res  = await fetch(`${API_BASE}/api/kpi/balance?${params}`);
    const data = await res.json();
    renderBsKpi(data);
  } catch (_) {
    renderBsKpi({ ada_data: false, filter: { tahun, kuartal }, periode_label: tahun || 'All Years' });
  }
}

/* ── Balance Sheet Chart Frames — URL base masing-masing chart ── */
const BS_BASES = {
  'bs-chart1': 'http://localhost:3000/public/question/048f79e4-333a-447b-83f5-78b8dc754994?titled=false',
  'bs-chart2': 'http://localhost:3000/public/question/ff0ec1c3-0531-4e50-a0bd-960f30e27166?titled=false',
  'bs-chart3': 'http://localhost:3000/public/question/0a87c31d-3dc1-44dd-924c-116d3ab7522c?titled=false',
  'bs-chart4': 'http://localhost:3000/public/question/ee26e79e-3302-44fb-b453-4210f11687ff?titled=false',
};

function updateBalanceCharts() {
  const params = new URLSearchParams();
  const y = document.getElementById('bs-yearFilter')?.value;
  const q = document.getElementById('bs-quarterFilter')?.value;
  if (y) params.set('year',    y);
  if (q) params.set('quarter', q);
  const qs = params.toString();

  Object.entries(BS_BASES).forEach(([id, base]) => {
    const el = document.getElementById(id);
    if (el) el.src = qs ? `${base}&${qs}` : base;
  });
}

// Hook filter Balance Sheet ke KPI + chart frames
const _bsYearEl = document.getElementById('bs-yearFilter');
if (_bsYearEl) _bsYearEl.addEventListener('change', () => {
  updateKpiBalance();
  updateBalanceCharts();
});

// Hook quarter pill buttons bs — initQuarterBtns sudah sync ke hidden input bs-quarterFilter
initQuarterBtns('bs-quarterBtns', 'bs-quarterFilter', () => {
  updateKpiBalance();
  updateBalanceCharts();
});

/* ── 8. SIDEBAR TOGGLE ── */
(function () {
  const btn     = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  const body    = document.body;
  const tooltip = { show: 'Tampilkan menu', hide: 'Sembunyikan menu' };
  const isMobile = () => window.innerWidth <= 768;

  // Mobile: sidebar always hidden by default on load
  if (isMobile()) {
    body.classList.add('sidebar-hidden');
    btn.setAttribute('data-tooltip', tooltip.show);
  } else {
    // Desktop: restore saved state
    if (localStorage.getItem('sidebarHidden') === 'true') {
      body.classList.add('sidebar-hidden');
      btn.setAttribute('data-tooltip', tooltip.show);
    }
  }

  btn.addEventListener('click', function () {
    btn.classList.add('ripple-active');
    setTimeout(() => btn.classList.remove('ripple-active'), 420);

    if (isMobile()) {
      // Mobile: toggle mobile-sidebar-open class (overlay pattern)
      const isOpen = body.classList.toggle('mobile-sidebar-open');
      body.classList.toggle('sidebar-hidden', !isOpen);
      btn.setAttribute('data-tooltip', isOpen ? tooltip.hide : tooltip.show);
    } else {
      // Desktop: normal toggle
      const isHidden = body.classList.toggle('sidebar-hidden');
      body.classList.remove('mobile-sidebar-open');
      btn.setAttribute('data-tooltip', isHidden ? tooltip.show : tooltip.hide);
      localStorage.setItem('sidebarHidden', isHidden);
    }
  });

  // Close sidebar when clicking overlay on mobile
  if (overlay) {
    overlay.addEventListener('click', function () {
      if (isMobile()) {
        body.classList.remove('mobile-sidebar-open');
        body.classList.add('sidebar-hidden');
        btn.setAttribute('data-tooltip', tooltip.show);
      }
    });
  }

  // On resize: reset mobile state
  window.addEventListener('resize', function () {
    if (!isMobile()) {
      body.classList.remove('mobile-sidebar-open');
      if (localStorage.getItem('sidebarHidden') === 'true') {
        body.classList.add('sidebar-hidden');
      } else {
        body.classList.remove('sidebar-hidden');
      }
    } else {
      // Switched to mobile: close sidebar
      body.classList.remove('mobile-sidebar-open');
      body.classList.add('sidebar-hidden');
    }
  });
})();

/* ── 9. NOTIFICATION PANEL ── */
const notifBtn   = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');
const notifClose = document.getElementById('notifClose');

if (notifBtn && notifPanel) {

  // Move panel to document.body so it is never inside a flex/transform context
  document.body.appendChild(notifPanel);

  // Position panel anchored to button using fixed coords from getBoundingClientRect
  function positionNotifPanel() {
    const rect = notifBtn.getBoundingClientRect();
    notifPanel.style.position = 'fixed';
    // Gunakan rect dari tombol — karena header sticky, rect.bottom selalu konsisten
    notifPanel.style.top  = (rect.bottom + 8) + 'px';
    notifPanel.style.right = (window.innerWidth - rect.right) + 'px';
    notifPanel.style.left  = 'auto';
    notifPanel.style.bottom = 'auto';
  }

  notifBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = notifPanel.classList.contains('open');
    if (!isOpen) {
      positionNotifPanel();
      notifPanel.classList.add('open');
    } else {
      notifPanel.classList.remove('open');
    }
  });

  notifClose && notifClose.addEventListener('click', function () {
    notifPanel.classList.remove('open');
  });

  document.addEventListener('click', function (e) {
    if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
      notifPanel.classList.remove('open');
    }
  });

  // Re-position on window resize
  window.addEventListener('resize', function () {
    if (notifPanel.classList.contains('open')) positionNotifPanel();
  });

  // Re-position on ANY scroll (capture phase menangkap scroll dari semua elemen)
  document.addEventListener('scroll', function () {
    if (notifPanel.classList.contains('open')) positionNotifPanel();
  }, { passive: true, capture: true });

  // Mark notifications read after opening
  notifPanel.addEventListener('transitionend', function () {
    if (notifPanel.classList.contains('open')) {
      setTimeout(() => {
        const badge = notifBtn.querySelector('.notif-badge');
        if (badge) {
          badge.style.transform = 'scale(0)';
          badge.style.transition = 'transform 0.25s ease';
          setTimeout(() => badge.remove(), 250);
        }
        notifPanel.querySelectorAll('.notif-dot').forEach(dot => {
          dot.style.background = 'var(--border)';
        });
      }, 1500);
    }
  });
}


/* ══════════════════════════════════════════
   BAGIAN BARU: INPUT DATA + POLLING NOTIF
   ══════════════════════════════════════════ */

// API_BASE = 'http://localhost:5000' (dideklarasikan di atas)

/* ── MODAL LOGIC ── */
(function () {
  const btnTambah = document.getElementById('btnTambahData');
  const modal     = document.getElementById('modalTambahData');
  const overlay   = document.getElementById('modalOverlay');
  const btnClose  = document.getElementById('modalClose');
  const btnCancel = document.getElementById('btnCancel');
  const btnSubmit = document.getElementById('btnSubmit');
  const statusEl  = document.getElementById('modalStatus');

  if (!modal || !btnSubmit || !statusEl) return;

  let tabAktif = 'labarugi';

  /* ── Buka modal ── */
  function bukaModal() {
    modal.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    resetStatus();
  }

  /* ── Tutup modal ── */
  function tutupModal() {
    modal.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    resetForm();
    resetStatus();
  }

  function resetStatus() {
    statusEl.textContent = '';
    statusEl.className = 'modal-status';
  }

  function tampilStatus(pesan, tipe) {
    statusEl.textContent = pesan;
    statusEl.className = 'modal-status ' + tipe;
  }

  btnTambah && btnTambah.addEventListener('click', bukaModal);

  // Expose bukaModal ke global agar bisa dipanggil dari profile dropdown
  window.openTambahDataModal = bukaModal;

  btnClose  && btnClose.addEventListener('click', tutupModal);
  btnCancel && btnCancel.addEventListener('click', tutupModal);
  overlay   && overlay.addEventListener('click', tutupModal);

  /* ── Tab switcher (hanya modal Tambah Data) ── */
  modal.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      tabAktif = this.dataset.tab;
      document.getElementById('tab-labarugi').style.display = tabAktif === 'labarugi' ? '' : 'none';
      document.getElementById('tab-aruskas').style.display  = tabAktif === 'aruskas'  ? '' : 'none';
      document.getElementById('tab-neraca').style.display   = tabAktif === 'neraca'   ? '' : 'none';
      resetStatus();
    });
  });

  /* ── Helper: ambil nilai number atau null ── */
  function numVal(id) {
    const el = document.getElementById(id);
    if (!el || el.value === '' || el.value === null) return null;
    const v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  }

  function payloadHasValues(payload) {
    const skip = new Set(['tahun', 'kuartal', 'bulan', 'catatan']);
    return Object.entries(payload).some(([k, v]) => !skip.has(k) && v !== null && v !== undefined);
  }

  /* ── Kumpulkan payload keuangan (semua field) ── */
  function keuanganPayload() {
    const tahunEl   = document.getElementById('keu-tahun');
    const kuartalEl = document.getElementById('keu-kuartal');
    return {
      tahun:              parseInt(tahunEl.value),
      kuartal:            kuartalEl.value,
      bulan:              document.getElementById('keu-bulan')?.value || null,
      /* Laba Rugi */
      revenue:            numVal('keu-revenue'),
      cost_of_goods_sold: numVal('keu-cogs'),
      gross_profit:       numVal('keu-gross-profit'),
      operating_expenses: numVal('keu-opex'),
      operating_income:   numVal('keu-opincome'),
      laba_bersih:        numVal('keu-laba'),
      net_income:         numVal('keu-laba'),      // alias, dua kolom di DB
      ebitda:             numVal('keu-ebitda'),
      da_expense:         numVal('keu-da'),
      tax_expense:        numVal('keu-tax'),
      interest_expense:   numVal('keu-interest'),
      /* Arus Kas */
      ocf:                numVal('keu-ocf'),
      cfi:                numVal('keu-cfi'),
      cff:                numVal('keu-cff'),
      capex:              numVal('keu-capex'),
      fcf:                numVal('keu-fcf'),
      ending_cash:        numVal('keu-ending-cash'),
      net_change_cash:    numVal('keu-net-change-cash'),
      /* Neraca */
      total_assets:       numVal('keu-total-assets'),
      total_equity:       numVal('keu-total-equity'),
      total_liabilities:  numVal('keu-total-liabilities'),
      accounts_receivable: numVal('keu-ar'),
      inventory:           numVal('keu-inventory'),
      accounts_payable:    numVal('keu-ap'),
      /* Catatan */
      catatan:            document.getElementById('keu-catatan')?.value || null,
    };
  }

  /* ── Kumpulkan payload operasional ── */
  function operasionalPayload() {
    const tahunEl   = document.getElementById('ops-tahun');
    const kuartalEl = document.getElementById('ops-kuartal');
    return {
      tahun:            parseInt(tahunEl.value),
      kuartal:          kuartalEl.value,
      bulan:            document.getElementById('ops-bulan')?.value     || null,
      volume_produksi:  numVal('ops-produksi'),
      volume_penjualan: numVal('ops-penjualan'),
      kapasitas_pabrik: numVal('ops-kapasitas'),
      utilisasi_pct:    numVal('ops-utilisasi'),
      harga_jual_avg:   numVal('ops-harga'),
      biaya_energi:     numVal('ops-energi'),
      catatan:          document.getElementById('ops-catatan')?.value   || null,
    };
  }

  /* ── Refresh semua KPI & Metabase setelah data tersimpan ── */
  function refreshDashboard() {
    /* 1. KPI Cards — fetch ulang dari Flask API */
    if (typeof updateKPI        === 'function') updateKPI();
    if (typeof updateKpiOps     === 'function') updateKpiOps();
    if (typeof updateKpiPCQ     === 'function') updateKpiPCQ();
    if (typeof updateKpiBalance === 'function') updateKpiBalance();
    if (typeof updateKpiMargin  === 'function') updateKpiMargin();

    /* FIX: updateKfiKpi didefinisikan setelah IIFE ini selesai dieksekusi.
       Panggil lewat window agar selalu mengambil versi yang sudah terdefinisi.
       setTimeout(0) memastikan eksekusi setelah seluruh script selesai di-parse. */
    setTimeout(() => {
      if (typeof window.updateKfiKpi === 'function') window.updateKfiKpi();
    }, 0);

    /* 2. Metabase iframes — blank + re-assign lebih andal dari hanya ?_t=
       Memaksa Metabase render ulang query dari DB, bukan dari cache browser. */
    [
      /* Financial Overview */
      'keu-chart1', 'keu-chart2', 'keu-chart3',
      /* Resource Overview */
      'ops-chart1', 'ops-chart2', 'ops-chart3', 'ops-chart4',
      /* Cash Flow Health */
      'pcq-chart1',
      /* Margin Trends */
      'mg-chart-gross', 'mg-chart-ebitda', 'mg-chart-annual', 'mg-chart-table',
      /* Balance Sheet */
      'bs-chart1', 'bs-chart2', 'bs-chart3', 'bs-chart4',
      /* Key Financial Indicators — FIX: sebelumnya ada di daftar tapi perlu dipastikan */
      'kfi-chart1', 'kfi-chart2',
    ].forEach(id => {
      const iframe = document.getElementById(id);
      if (!iframe) return;

      /* Simpan base URL pertama kali (tanpa _t lama jika sudah pernah di-refresh) */
      if (!iframe.dataset.baseSrc && iframe.src && iframe.src !== 'about:blank') {
        try {
          const clean = new URL(iframe.src);
          clean.searchParams.delete('_t');
          iframe.dataset.baseSrc = clean.toString();
        } catch (_) {
          iframe.dataset.baseSrc = iframe.src;
        }
      }
      if (!iframe.dataset.baseSrc) return;

      const sep     = iframe.dataset.baseSrc.includes('?') ? '&' : '?';
      const freshUrl = iframe.dataset.baseSrc + sep + '_t=' + Date.now();

      /* Kosongkan dulu → beri jeda → assign URL baru agar konten lama benar-benar dibuang */
      iframe.src = 'about:blank';
      setTimeout(() => { iframe.src = freshUrl; }, 80);
    });

    /* 3. Populate ulang dropdown tahun jika ada data tahun baru */
    if (typeof populateTahunFilter === 'function') populateTahunFilter();
  }
  window.refreshDashboard = refreshDashboard;

  /* ── Submit ── */
  btnSubmit.addEventListener('click', async function () {
    resetStatus();

    const periodeMap = {
      labarugi: { tahun: 'lr-tahun', kuartal: 'lr-kuartal' },
      aruskas:  { tahun: 'ak-tahun', kuartal: 'ak-kuartal' },
      neraca:   { tahun: 'nc-tahun', kuartal: 'nc-kuartal' },
    };
    const periodeIds = periodeMap[tabAktif];
    const tahunEl   = document.getElementById(periodeIds.tahun);
    const kuartalEl = document.getElementById(periodeIds.kuartal);

    if (!tahunEl.value || !kuartalEl.value) {
      tampilStatus('⚠ Tahun dan Kuartal wajib diisi.', 'error');
      tahunEl.focus();
      return;
    }

    /* Build payload based on active tab — all tabs post to /keuangan */
    let payload;
    if (tabAktif === 'labarugi') {
      payload = {
        tahun:              parseInt(tahunEl.value),
        kuartal:            kuartalEl.value,
        bulan:              document.getElementById('lr-bulan')?.value || null,
        revenue:            numVal('keu-revenue'),
        cost_of_goods_sold: numVal('keu-cogs'),
        gross_profit:       numVal('keu-gross-profit'),
        operating_expenses: numVal('keu-opex'),
        operating_income:   numVal('keu-opincome'),
        laba_bersih:        numVal('keu-laba'),
        net_income:         numVal('keu-laba'),
        ebitda:             numVal('keu-ebitda'),
        da_expense:         numVal('keu-da'),
        tax_expense:        numVal('keu-tax'),
        interest_expense:   numVal('keu-interest'),
        catatan:            document.getElementById('lr-catatan')?.value || null,
      };
    } else if (tabAktif === 'aruskas') {
      payload = {
        tahun:           parseInt(tahunEl.value),
        kuartal:         kuartalEl.value,
        bulan:           document.getElementById('ak-bulan')?.value || null,
        ocf:             numVal('keu-ocf'),
        cfi:             numVal('keu-cfi'),
        cff:             numVal('keu-cff'),
        capex:           numVal('keu-capex'),
        fcf:             numVal('keu-fcf'),
        ending_cash:     numVal('keu-ending-cash'),
        net_change_cash: numVal('keu-net-change-cash'),
        catatan:         document.getElementById('ak-catatan')?.value || null,
      };
    } else {
      payload = {
        tahun:               parseInt(tahunEl.value),
        kuartal:             kuartalEl.value,
        bulan:               document.getElementById('nc-bulan')?.value || null,
        total_assets:        numVal('keu-total-assets'),
        total_equity:        numVal('keu-total-equity'),
        total_liabilities:   numVal('keu-total-liabilities'),
        accounts_receivable: numVal('keu-ar'),
        inventory:           numVal('keu-inventory'),
        accounts_payable:    numVal('keu-ap'),
        catatan:             document.getElementById('nc-catatan')?.value || null,
      };
    }
    if (!payloadHasValues(payload)) {
      tampilStatus('⚠ Isi minimal satu field angka sebelum menyimpan.', 'error');
      return;
    }

    const endpoint = '/api/keuangan';

    /* Loading state */
    const textEl   = btnSubmit.querySelector('.btn-submit-text');
    const loaderEl = btnSubmit.querySelector('.btn-submit-loader');
    if (textEl)   textEl.style.display   = 'none';
    if (loaderEl) loaderEl.style.display = 'flex';
    btnSubmit.disabled = true;

    try {
      const res  = await fetch(API_BASE + endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify(payload),
      });

      let json = {};
      try {
        json = await res.json();
      } catch (_) {
        json = {};
      }

      if (res.ok) {
        tampilStatus('✓ ' + (json.pesan || json.message || 'Data berhasil disimpan.'), 'success');

        try {
          if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
          if (typeof pollNotifikasi === 'function') await pollNotifikasi();
        } catch (_) {
          /* Simpan berhasil; refresh KPI opsional */
        }

        setTimeout(() => {
          resetForm();
          tutupModal();
        }, 1800);
      } else {
        tampilStatus('✗ ' + (json.message || json.error || 'Gagal menyimpan data.'), 'error');
      }
    } catch (err) {
      tampilStatus('✗ Tidak dapat terhubung ke server. Pastikan Flask (app.py) berjalan di port 5000.', 'error');
      console.error('Tambah data error:', err);
    } finally {
      if (textEl)   textEl.style.display   = '';
      if (loaderEl) loaderEl.style.display = 'none';
      btnSubmit.disabled = false;
    }
  });

  /* ── Reset semua input form ── */
  function resetForm() {
    const ids = [
      /* Periode Laba Rugi */
      'lr-tahun','lr-kuartal','lr-bulan',
      /* Laba Rugi fields */
      'keu-revenue','keu-cogs','keu-gross-profit','keu-opex','keu-opincome',
      'keu-laba','keu-ebitda','keu-da','keu-tax','keu-interest',
      'lr-catatan',
      /* Periode Arus Kas */
      'ak-tahun','ak-kuartal','ak-bulan',
      /* Arus Kas fields */
      'keu-ocf','keu-cfi','keu-cff','keu-capex','keu-fcf',
      'keu-ending-cash','keu-net-change-cash',
      'ak-catatan',
      /* Periode Neraca */
      'nc-tahun','nc-kuartal','nc-bulan',
      /* Neraca fields */
      'keu-total-assets','keu-total-equity','keu-total-liabilities',
      'keu-ar','keu-inventory','keu-ap',
      'nc-catatan',
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = el.tagName === 'SELECT' ? (el.options[0]?.value ?? '') : '';
    });
  }

  /* ── Escape menutup modal ── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) tutupModal();
  });
})();

/* ── ADMIN PAGE — tabs + Hapus Data form ── */
function switchAdminTab(tab) {
  const validTabs = ['hapus', 'banner', 'upload-laporan'];
  const tabName = validTabs.includes(tab) ? tab : 'hapus';
  document.querySelectorAll('.admin-tab').forEach(btn => {
    const active = btn.dataset.adminTab === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.admin-section').forEach(sec => {
    const active = sec.id === 'admin-section-' + tabName;
    sec.classList.toggle('active', active);
    sec.removeAttribute('hidden');
    sec.style.display = active ? 'block' : 'none';
  });
  if (tabName === 'banner') {
    renderBannerMgmtList();
    cancelBannerEdit();
  } else if (tabName === 'hapus' && typeof window.updateDelSummary === 'function') {
    window.updateDelSummary();
  }
}

function openAdminPage(tab) {
  if (currentRole !== 'admin') {
    alert('Akses ditolak. Halaman Admin hanya untuk role Admin.');
    return;
  }
  const lastPage = document.querySelector('.nav-sub-item.active')?.dataset?.page
    || document.querySelector('.nav-item.active')?.dataset?.page
    || 'keuangan';
  const adminPage = document.getElementById('page-admin');
  if (adminPage) adminPage.dataset.returnPage = lastPage;

  switchPage('admin');
  switchAdminTab(tab || 'hapus');
}

window.openAdminPage = openAdminPage;
window.openHapusDataModal = function() { openAdminPage('hapus'); };

(function initAdminPage() {
 document.getElementById('adminBackBtn')?.addEventListener('click', function() {
    const ret = document.getElementById('page-admin')?.dataset?.returnPage || 'keuangan';
    document.body.classList.remove('admin-active');
    switchPage(ret);
  });

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      switchAdminTab(this.dataset.adminTab);
    });
  });
})();

(function initHapusDataAdmin() {
  const btnHapus     = document.getElementById('btnHapusData');
  const statusEl     = document.getElementById('hapusModalStatus');
  const fieldSelect  = document.getElementById('del-field-select');
  const tahunSelect  = document.getElementById('del-tahun-select');
  const kuartalInput = document.getElementById('del-kuartal');
  if (!btnHapus || !fieldSelect || !tahunSelect) return;

  function getFieldLabel() {
    const opt = fieldSelect.options[fieldSelect.selectedIndex];
    return opt && opt.value ? opt.text.trim() : '';
  }

  function resetHapusStatus() {
    if (!statusEl) return;
    statusEl.textContent = '';
    statusEl.className = 'modal-status del-modal-status admin-hapus-status';
  }

  fieldSelect.addEventListener('change', updateDelSummary);
  tahunSelect.addEventListener('change', updateDelSummary);
  initQuarterBtns('del-quarterBtns', 'del-kuartal', updateDelSummary);

  /* ── Searchable Dropdown untuk Jenis Data ── */
  (function initSearchableField() {
    const trigger    = document.getElementById('delFieldTrigger');
    const triggerTxt = document.getElementById('delFieldTriggerText');
    const dropdown   = document.getElementById('delFieldDropdown');
    const searchInput= document.getElementById('del-field-search');
    const listEl     = document.getElementById('delFieldList');
    if (!trigger || !dropdown || !searchInput || !listEl) return;

    // Kumpulkan semua opsi dari hidden select beserta grup-nya
    const allItems = [];
    Array.from(fieldSelect.querySelectorAll('optgroup')).forEach(group => {
      Array.from(group.querySelectorAll('option')).forEach(opt => {
        allItems.push({ value: opt.value, label: opt.text.trim(), group: group.label });
      });
    });

    function highlight(text, query) {
      if (!query) return text;
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx < 0) return text;
      return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + query.length) + '</mark>' + text.slice(idx + query.length);
    }

    function renderList(query) {
      const q = (query || '').trim();
      const filtered = q
        ? allItems.filter(i => i.label.toLowerCase().includes(q.toLowerCase()))
        : allItems;

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="del-search-empty">Tidak ada hasil untuk "' + q + '"</div>';
        return;
      }

      // Kelompokkan berdasarkan group (hanya tampilkan header grup jika tidak ada filter atau ada item)
      let html = '';
      let lastGroup = null;
      filtered.forEach(item => {
        if (!q && item.group !== lastGroup) {
          html += `<div class="del-search-group">${item.group}</div>`;
          lastGroup = item.group;
        }
        const isActive = fieldSelect.value === item.value;
        html += `<div class="del-search-item${isActive ? ' active' : ''}" data-value="${item.value}" data-label="${item.label}">
          ${highlight(item.label, q)}
        </div>`;
      });
      listEl.innerHTML = html;

      // Event klik tiap item
      listEl.querySelectorAll('.del-search-item').forEach(el => {
        el.addEventListener('click', function () {
          const val   = this.dataset.value;
          const label = this.dataset.label;
          // Set ke hidden select
          fieldSelect.value = val;
          fieldSelect.dispatchEvent(new Event('change'));
          // Update trigger text
          triggerTxt.textContent = label;
          triggerTxt.classList.add('selected');
          closeDropdown();
        });
      });
    }

    function openDropdown() {
      trigger.classList.add('open');
      dropdown.classList.add('open');
      searchInput.value = '';
      renderList('');
      setTimeout(() => searchInput.focus(), 50);
    }

    function closeDropdown() {
      trigger.classList.remove('open');
      dropdown.classList.remove('open');
      searchInput.value = '';
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
    });

    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDropdown(); }
      if (e.key === 'Escape') closeDropdown();
    });

    searchInput.addEventListener('input', function () {
      renderList(this.value);
    });

    // Tutup saat klik di luar
    document.addEventListener('click', function (e) {
      const wrap = document.getElementById('delFieldWrap');
      if (wrap && !wrap.contains(e.target)) closeDropdown();
    });

    // Sync saat resetDelForm dipanggil
    const origReset = window.updateDelSummary;
    const origFieldSelectIndex = fieldSelect.selectedIndex;
    // Override reset untuk sync UI trigger
    const _watchReset = setInterval(() => {
      if (fieldSelect.selectedIndex === 0 && triggerTxt.classList.contains('selected')) {
        triggerTxt.textContent = '— Pilih jenis data —';
        triggerTxt.classList.remove('selected');
      }
    }, 300);
  })();

  function updateDelSummary() {
    const tagsEl       = document.getElementById('del-dipilihTags');
    const confirmBox   = document.getElementById('delConfirmBox');
    const confirmEmpty = document.getElementById('delConfirmEmpty');
    const confirmFill  = document.getElementById('delConfirmFilled');
    const badgesEl     = document.getElementById('delConfirmBadges');
    const field        = fieldSelect.value;
    const fieldLabel   = getFieldLabel();
    const tahun        = tahunSelect.value;
    const kuartal      = kuartalInput ? kuartalInput.value : '';
    const tahunLabel   = tahun   || 'Semua Tahun';
    const kuartalLabel = kuartal || 'Semua Kuartal';

    if (tagsEl) {
      if (!field) {
        tagsEl.innerHTML = '<span class="del-dipilih-empty">—</span>';
      } else {
        tagsEl.innerHTML =
          `<span class="del-tag del-tag-field">${fieldLabel}</span>` +
          `<span class="del-tag del-tag-meta">${tahunLabel}</span>` +
          `<span class="del-tag del-tag-meta">${kuartalLabel}</span>`;
      }
    }

    if (!field) {
      btnHapus.disabled = true;
      if (confirmBox) {
        confirmBox.classList.remove('del-confirm-filled');
        confirmBox.classList.add('del-confirm-empty');
      }
      if (confirmEmpty) confirmEmpty.hidden = false;
      if (confirmFill)  confirmFill.hidden  = true;
      return;
    }

    btnHapus.disabled = false;
    if (confirmBox) {
      confirmBox.classList.remove('del-confirm-empty');
      confirmBox.classList.add('del-confirm-filled');
    }
    if (confirmEmpty) confirmEmpty.hidden = true;
    if (confirmFill)  confirmFill.hidden  = false;
    if (badgesEl) {
      badgesEl.innerHTML =
        `<span class="del-badge del-badge-field">${fieldLabel}</span>` +
        `<span class="del-badge del-badge-year">${tahunLabel}</span>` +
        `<span class="del-badge del-badge-quarter">${kuartalLabel}</span>`;
    }
  }

  function resetDelForm() {
    fieldSelect.selectedIndex = 0;
    tahunSelect.selectedIndex = 0;
    const qGroup = document.getElementById('del-quarterBtns');
    if (qGroup) {
      qGroup.querySelectorAll('.q-btn').forEach((b, i) => {
        b.classList.toggle('active', i === 0);
      });
    }
    if (kuartalInput) kuartalInput.value = '';
    btnHapus.disabled = true;
    // Reset custom searchable dropdown trigger
    const triggerTxt = document.getElementById('delFieldTriggerText');
    if (triggerTxt) {
      triggerTxt.textContent = '— Pilih jenis data —';
      triggerTxt.classList.remove('selected');
    }
    updateDelSummary();
  }

  btnHapus.addEventListener('click', async function () {
    if (typeof currentRole !== 'undefined' && currentRole !== 'admin') {
      alert('Akses ditolak. Hanya admin yang dapat menghapus data.');
      return;
    }

    const field   = fieldSelect.value;
    const tahun   = tahunSelect.value;
    const kuartal = kuartalInput ? kuartalInput.value : '';

    if (!field) {
      alert('Harap pilih Jenis Data yang ingin dihapus.');
      fieldSelect.focus();
      return;
    }

    const fieldLabel = getFieldLabel();

    const konfirmasi = confirm(
      `⚠️ KONFIRMASI HAPUS\n\n` +
      `• Jenis Data : ${fieldLabel}\n` +
      `• Tahun      : ${tahun   || 'Semua tahun'}\n` +
      `• Kuartal    : ${kuartal || 'Semua kuartal'}\n\n` +
      `Nilai field akan di-set ke NULL.\nTindakan ini TIDAK DAPAT DIBATALKAN.\nLanjutkan?`
    );
    if (!konfirmasi) return;

    btnHapus.disabled = true;
    btnHapus.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Menghapus...`;
    resetHapusStatus();

    const params = new URLSearchParams({ field });
    if (tahun)   params.set('tahun',   tahun);
    if (kuartal) params.set('kuartal', kuartal);

    try {
      const res = await fetch(`${API_BASE}/api/data/field?${params}`, { method: 'DELETE', headers: authHeaders() });

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        if (statusEl) {
          statusEl.textContent = '✓ ' + (json.pesan || json.message || `"${fieldLabel}" berhasil dihapus.`);
          statusEl.className = 'modal-status del-modal-status admin-hapus-status success';
        }
        resetDelForm();
        if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
        if (typeof pollNotifikasi === 'function') pollNotifikasi();
      } else {
        if (statusEl) {
          statusEl.textContent = '✗ ' + (json.message || json.error || res.statusText);
          statusEl.className = 'modal-status del-modal-status admin-hapus-status error';
        }
      }
    } catch (_) {
      if (statusEl) {
        statusEl.textContent = '✗ Tidak dapat terhubung ke server. Pastikan Flask (app.py) sudah berjalan di port 5000.';
        statusEl.className = 'modal-status del-modal-status admin-hapus-status error';
      }
    } finally {
      btnHapus.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Hapus Data Ini`;
      updateDelSummary();
    }
  });

  window.updateDelSummary = updateDelSummary;
  resetDelForm();
})();


/* ── POLLING NOTIFIKASI — setiap 30 detik ── */
async function pollNotifikasi() {
  if (!getToken()) return;  // Jangan poll jika belum login
  try {
    const res  = await fetch(API_BASE + '/api/notifikasi', { headers: authHeaders() });
    if (!res.ok) return;  // 401/403 = belum login, diam saja
    const data = await res.json();

    const notifList  = document.querySelector('.notif-list');
    const notifBadge = document.querySelector('.notif-badge');
    if (!notifList) return;

    // Render ulang daftar notifikasi
    if (data.notifikasi && data.notifikasi.length > 0) {
      notifList.innerHTML = data.notifikasi.map(n => {
        const waktu = formatWaktu(n.dibuat_pada);
        const unread = n.sudah_dibaca === 0 ? ' unread' : '';
        const icon = n.tipe === 'success' ? '✓' : n.tipe === 'warning' ? '⚠' : 'ℹ';
        const scopeTag = n.user_id ? '' : '<span style="font-size:10px;opacity:.6;margin-left:4px;">[global]</span>';
        return `
          <div class="notif-item${unread}">
            <div class="notif-dot"></div>
            <div class="notif-content">
              <p>${icon} ${n.pesan}${scopeTag}</p>
              <span>${waktu}</span>
            </div>
          </div>`;
      }).join('');
    }

    // Update badge
    if (notifBadge) {
      if (data.belum_dibaca > 0) {
        notifBadge.textContent = data.belum_dibaca;
        notifBadge.style.transform = 'scale(1)';
        notifBadge.style.transition = '';
      } else {
        notifBadge.style.transform = 'scale(0)';
      }
    }
  } catch (_) {
    // Server belum aktif — diam saja, tidak error di console
  }
}

// Format waktu relatif
function formatWaktu(isoStr) {
  if (!isoStr) return '';
  // Support "YYYY-MM-DD HH:MM:SS" (MySQL) maupun ISO string
  let normalized = String(isoStr).trim();
  // Ganti spasi dengan T jika belum ada T
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(' ', 'T');
  }
  // Jika belum ada timezone offset dan tidak diakhiri Z, asumsikan WIB (UTC+7)
  if (!/[Zz]$/.test(normalized) && !/[+\-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized += '+07:00';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return isoStr; // fallback: tampilkan string aslinya
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 0)    return 'Baru saja';
  if (diff < 60)   return 'Baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit yang lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam yang lalu';
  return Math.floor(diff / 86400) + ' hari yang lalu';
}

// Tandai sudah dibaca saat panel dibuka
const _origNotifBtn = document.getElementById('notifBtn');
if (_origNotifBtn) {
  _origNotifBtn.addEventListener('click', function () {
    fetch(API_BASE + '/api/notifikasi/baca-semua', { method: 'POST', headers: authHeaders() }).catch(() => {});
  });
}

// Mulai polling
pollNotifikasi();
setInterval(pollNotifikasi, 30_000);

/*   KPI DINAMIS — update saat filter berubah
   Data: 2016–2025, semua kuartal */

// Map: id elemen → key dari API response
const KPI_MAP = [
  { valId: 'kpi-ocf',       badgeId: 'kpi-ocf-badge',       key: 'ocf',  prefix: 'Rp ' },
  { valId: 'kpi-net-income', badgeId: 'kpi-net-income-badge', key: 'net',  prefix: 'Rp ' },
  { valId: 'kpi-fcf',       badgeId: 'kpi-fcf-badge',       key: 'fcf',  prefix: 'Rp ' },
];

// Auto-populate semua <select> filter tahun dari database
async function populateTahunFilter() {
  try {
    const res  = await fetch(`${API_BASE}/api/tahun-tersedia`);
    const data = await res.json();
    const tahunList = data.tahun; 

    document.querySelectorAll(
      '#keu-yearFilter, #ops-yearFilter, #pcq-yearFilter, #fcf-yearFilter, #bs-yearFilter, #mg-yearFilter, #kfi-yearFilter'
    ).forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">All Years</option>';
      tahunList.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (String(t) === String(currentVal)) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  } catch (_) {
  }
}

function setKpiLoading() {
  KPI_MAP.forEach(({ valId }) => {
    const el = document.getElementById(valId);
    if (el) el.innerHTML = '<span class="kpi-loading">· · ·</span>';
  });
}

function renderKpiCard({ valId, badgeId, key, prefix }, data) {
  const valEl   = document.getElementById(valId);
  const badgeEl = document.getElementById(badgeId);
  if (!valEl || !badgeEl) return;

  // Cek ada_data dan key ada di response
  if (!data.ada_data || !data[key] || data[key].nilai === undefined || data[key].nilai === null) {
    valEl.innerHTML     = '<span class="kpi-loading">—</span>';
    badgeEl.textContent = '—';
    badgeEl.className   = 'kpi-badge';
    return;
  }

  const d = data[key];

  // Animasi fade out → update → fade in
  valEl.classList.add('kpi-updating');
  setTimeout(() => {
    // Nilai bisa negatif (OCF minus), tampilkan apa adanya
    const nilaiText = d.nilai !== null ? d.nilai : '—';
    valEl.innerHTML = prefix + nilaiText;
    valEl.classList.remove('kpi-updating');
  }, 180);

  // Badge YoY %
  if (d.pct !== null && d.pct !== undefined) {
    const naik = d.pct >= 0;
    badgeEl.innerHTML = `${naik ? '↑ +' : '↓ '}${Math.abs(d.pct)}%`;
    badgeEl.className = 'kpi-badge ' + (naik ? 'up' : 'down');
  } else {
    badgeEl.textContent = 'base year';
    badgeEl.className   = 'kpi-badge';
  }

  // Update trend icon di card
  const card = valEl.closest('.kpi-card');
  if (card && d.naik !== null) {
    const trendIcon = card.querySelector('.kpi-trend-icon');
    if (trendIcon) trendIcon.className = 'kpi-trend-icon ' + (d.naik ? 'up' : 'down');
  }
}

function renderKpi(data) {
  KPI_MAP.forEach(item => renderKpiCard(item, data));

  // Update label periode di bawah badge
  const tahun   = data.filter?.tahun;
  const kuartal = data.filter?.kuartal;
  const label   = tahun
    ? (kuartal ? `${kuartal} ${tahun} vs ${kuartal} ${tahun - 1}` : `Full Year ${tahun} vs ${tahun - 1}`)
    : 'All Years';

  document.querySelectorAll('.kpi-period').forEach(el => {
    el.textContent = tahun ? label : 'vs last year';
  });
}

async function updateKPI() {
  const tahun   = document.getElementById('keu-yearFilter')?.value;
  const kuartal = document.getElementById('keu-quarterFilter')?.value;

  const params = new URLSearchParams();
  if (tahun)   params.set('tahun',   tahun);
  if (kuartal) params.set('kuartal', kuartal);

  setKpiLoading();

  try {
    const res  = await fetch(`${API_BASE}/api/kpi/keuangan?${params}`);
    const data = await res.json();
    renderKpi(data);
  } catch (_) {
    // Flask belum jalan — tampilkan dash
    renderKpi({ ada_data: false, filter: { tahun, kuartal } });
  }
}

// Hook ke filter tahun
const _keuYearEl = document.getElementById('keu-yearFilter');
if (_keuYearEl) {
  _keuYearEl.addEventListener('change', updateKPI);
}

// Hook ke quarter pill buttons
const _keuQGroup = document.getElementById('keu-quarterBtns');
if (_keuQGroup) {
  _keuQGroup.querySelectorAll('.q-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(updateKPI, 50));
  });
}

// Inisialisasi: mulai dari homepage, filter default All Years
(async function init() {
  // Mulai di homepage
  switchPage('home');

  await populateTahunFilter();

  // Default filter = All Years (index 0), tidak pilih tahun tertentu
  const yearSel = document.getElementById('keu-yearFilter');
  if (yearSel) yearSel.selectedIndex = 0;

  // Fire semua KPI sekaligus
  updateKPI();
  updateKpiOps();
  updateKpiPCQ();
  updateKpiBalance();
  updateKpiMargin();
  updateBalanceCharts();
})();
/* ── KFI FILTER HOOKS ── */
function updateKfiShowingLabel() {
  const year    = document.getElementById('kfi-yearFilter')?.value;
  const quarter = document.getElementById('kfi-quarterFilter')?.value;
  const showEl  = document.getElementById('kfi-showingYear');
  if (!showEl) return;
  if (year && quarter) showEl.textContent = `${quarter} ${year}`;
  else if (year)        showEl.textContent = `FY ${year}`;
  else                  showEl.textContent = 'All Years';
}

const _kfiYearEl = document.getElementById('kfi-yearFilter');
if (_kfiYearEl) _kfiYearEl.addEventListener('change', updateKfiShowingLabel);

initQuarterBtns('kfi-quarterBtns', 'kfi-quarterFilter', updateKfiShowingLabel);
/* ════════════════════════════════════════════════════════
   KFI — KEY FINANCIAL INDICATORS  (dynamic KPI fetch)
   ════════════════════════════════════════════════════════ */

// Peta KPI: key API → elemen DOM + metadata tampilan
const KFI_KPI_MAP = [
  {
    key:    'debt_equity',
    valId:  'kfi-de-val',
    badgeId:'kfi-de-badge',
    periodId:'kfi-de-period',
    trendId:'kfi-de-trend-icon',
    unit:   'x',
    higherGood: false,   // lower D/E = good → turun = baik
    periodLabel: 'vs prev year',
  },
  {
    key:    'net_debt_ebitda',
    valId:  'kfi-nd-val',
    badgeId:'kfi-nd-badge',
    periodId:'kfi-nd-period',
    trendId:'kfi-nd-trend-icon',
    unit:   'x',
    higherGood: false,   // lower ND/EBITDA = good
    periodLabel: 'vs prev year',
  },
  {
    key:    'working_capital',
    valId:  'kfi-wc-val',
    badgeId:'kfi-wc-badge',
    periodId:'kfi-wc-period',
    trendId:'kfi-wc-trend-icon',
    unit:   'x',
    higherGood: true,
    periodLabel: 'Working Capital Ratio',
  },
  {
    key:    'roa',
    valId:  'kfi-roa-val',
    badgeId:'kfi-roa-badge',
    periodId:'kfi-roa-period',
    trendId:'kfi-roa-trend-icon',
    unit:   '%',
    higherGood: true,
    periodLabel: 'Return on Assets',
  },
  {
    key:    'roe',
    valId:  'kfi-roe-val',
    badgeId:'kfi-roe-badge',
    periodId:'kfi-roe-period',
    trendId:'kfi-roe-trend-icon',
    unit:   '%',
    higherGood: true,
    periodLabel: 'Return on Equity',
  },
  {
    key:    'roce',
    valId:  'kfi-roce-val',
    badgeId:'kfi-roce-badge',
    periodId:'kfi-roce-period',
    trendId:'kfi-roce-trend-icon',
    unit:   '%',
    higherGood: true,
    periodLabel: 'Return on Capital Employed',
  },
];

// SVG panah naik & turun
const SVG_UP   = `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`;
const SVG_DOWN = `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`;

function renderKfiKpiCard(item, data) {
  const d       = data[item.key];
  const valEl   = document.getElementById(item.valId);
  const badgeEl = document.getElementById(item.badgeId);
  const periodEl= document.getElementById(item.periodId);
  const trendEl = document.getElementById(item.trendId);
  if (!d || !valEl) return;

  // ── Nilai utama ──
  valEl.classList.add('kpi-updating');
  setTimeout(() => {
    valEl.innerHTML = `${d.nilai}<span class="kpi-unit">${item.unit}</span>`;
    valEl.classList.remove('kpi-updating');
  }, 150);

  // ── Badge delta YoY ──
  if (badgeEl) {
    if (d.delta !== null && d.delta !== undefined) {
      const isGood = item.higherGood ? (d.naik) : (!d.naik);
      const arrow  = d.naik ? '↑' : '↓';
      badgeEl.textContent = `${arrow} ${d.delta_fmt}`;
      badgeEl.className   = 'kpi-badge ' + (isGood ? 'up' : 'down');
    } else {
      badgeEl.textContent = 'base year';
      badgeEl.className   = 'kpi-badge';
    }
  }

  // ── Period label ──
  if (periodEl) periodEl.textContent = item.periodLabel;

  // ── Trend icon & warna ──
  if (trendEl && d.naik !== null && d.naik !== undefined) {
    const isGood   = item.higherGood ? d.naik : !d.naik;
    const goodCls  = isGood ? 'kfi-arrow-up-good'  : 'kfi-arrow-down-bad';
    const svgPoly  = d.naik ? SVG_UP : SVG_DOWN;
    trendEl.className = `kfi-arrow ${isGood ? (d.naik ? 'kfi-arrow-up-good' : 'kfi-arrow-down-good') : (d.naik ? 'kfi-arrow-up-bad' : 'kfi-arrow-down-bad')}`;
    trendEl.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">${svgPoly}</svg>`;
  }
}

async function updateKfiKpi() {
  const tahun   = document.getElementById('kfi-yearFilter')?.value;
  const kuartal = document.getElementById('kfi-quarterFilter')?.value;

  const params = new URLSearchParams();
  if (tahun)   params.set('tahun',   tahun);
  if (kuartal) params.set('kuartal', kuartal);

  // Update "Showing" label
  const showEl = document.getElementById('kfi-showingYear');
  if (showEl) {
    if (tahun && kuartal) showEl.textContent = `${kuartal} ${tahun}`;
    else if (tahun)        showEl.textContent = `FY ${tahun}`;
    else                   showEl.textContent = 'All Years';
  }

  try {
    const res  = await fetch(`${API_BASE}/api/kpi/kfi?${params}`);
    const data = await res.json();
    KFI_KPI_MAP.forEach(item => renderKfiKpiCard(item, data));
  } catch (err) {
    console.warn('KFI KPI fetch error:', err);
  }
}

// Expose ke window agar bisa dipanggil dari refreshDashboard (yang didefinisikan di IIFE lebih awal)
window.updateKfiKpi = updateKfiKpi;

// ── Re-wire filter hooks ──
const _kfiYearElV2 = document.getElementById('kfi-yearFilter');
if (_kfiYearElV2) _kfiYearElV2.addEventListener('change', updateKfiKpi);

initQuarterBtns('kfi-quarterBtns', 'kfi-quarterFilter', updateKfiKpi);

// ── Load on page switch ke 'kfi' ──
(function patchSwitchPageForKfi() {
  const _origSwitch = window.switchPage;
  if (typeof _origSwitch === 'function') {
    window.switchPage = function(page) {
      _origSwitch(page);
      if (page === 'kfi') updateKfiKpi();
      // Update insight panel subtitle & refresh notes when page changes
      insightUpdateForPage(page);
    };
  }
})();

/* ══════════════════════════════════════════════════════
   INSIGHT NOTES — Admin Only Feature
   Storage: localStorage key = 'insight_notes'
   Structure: Array of { id, page, category, text, createdAt, updatedAt }
   ══════════════════════════════════════════════════════ */

const INSIGHT_STORAGE_KEY = 'insight_notes_indocement';
let insightCurrentPage = null;
let insightEditingId    = null;

const PAGE_LABELS = {
  keuangan:    'Executive Summary',
  operasional: 'Resource Overview',
  penjualan:   'Cash Flow',
  margin:      'Margin Trends',
  balance:     'Balance Sheet Trends',
  kfi:         'Key Financial Indicators',
};

const CAT_LABELS = {
  info:     '💡 Informasi Umum',
  warning:  '⚠️ Perhatian',
  positive: '✅ Positif',
  negative: '🔴 Negatif',
  action:   '🎯 Action Item',
};

/* ── Storage helpers ── */
function insightGetAll() {
  try {
    return JSON.parse(localStorage.getItem(INSIGHT_STORAGE_KEY) || '[]');
  } catch { return []; }
}
function insightSaveAll(notes) {
  localStorage.setItem(INSIGHT_STORAGE_KEY, JSON.stringify(notes));
}
function insightGetByPage(page) {
  return insightGetAll().filter(n => n.page === page);
}

/* ── FAB badge update ── */
function insightUpdateBadge(page) {
  const fab   = document.getElementById('insightFab');
  const badge = document.getElementById('insightFabBadge');
  if (!fab || !badge) return;

  const count = insightGetByPage(page).length;
  if (count > 0) {
    badge.textContent    = count;
    badge.style.display  = 'flex';
  } else {
    badge.style.display  = 'none';
  }
}

/* ── Halaman dashboard yang boleh menampilkan Insight FAB ── */
const INSIGHT_ALLOWED_PAGES = new Set([
  'keuangan', 'operasional', 'penjualan', 'margin', 'balance', 'kfi'
]);

/* ── Show/hide FAB based on role & page ── */
function insightUpdateForPage(page) {
  insightCurrentPage = page;
  const fab = document.getElementById('insightFab');
  if (!fab) return;

  // Tampil HANYA di halaman dashboard & hanya untuk admin
  if (currentRole === 'admin' && INSIGHT_ALLOWED_PAGES.has(page)) {
    fab.style.display = 'flex';
  } else {
    fab.style.display = 'none';
    // Tutup panel jika sedang terbuka saat pindah ke halaman non-dashboard
    const panel    = document.getElementById('insightPanel');
    const backdrop = document.getElementById('insightPanelBackdrop');
    if (panel)    panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  // Update subtitle label
  const subtitle = document.getElementById('insightPanelSubtitle');
  if (subtitle) {
    subtitle.textContent = PAGE_LABELS[page] || page;
  }

  insightUpdateBadge(page);

  // If panel is open, refresh the list
  const panel = document.getElementById('insightPanel');
  if (panel && panel.classList.contains('open')) {
    insightRenderNotes();
  }
}

/* ── Toggle panel ── */
function toggleInsightPanel() {
  const panel    = document.getElementById('insightPanel');
  const backdrop = document.getElementById('insightPanelBackdrop');
  if (!panel) return;

  if (panel.classList.contains('open')) {
    closeInsightPanel();
  } else {
    panel.classList.add('open');
    backdrop.classList.add('open');
    insightRenderNotes();
    // Reset form
    cancelInsightEdit();
    document.getElementById('insightTextarea').focus();
  }
}

function closeInsightPanel() {
  document.getElementById('insightPanel')?.classList.remove('open');
  document.getElementById('insightPanelBackdrop')?.classList.remove('open');
  cancelInsightEdit();
}

/* ── Render notes list ── */
function insightRenderNotes() {
  const list      = document.getElementById('insightNotesList');
  const emptyState= document.getElementById('insightEmptyState');
  if (!list || !insightCurrentPage) return;

  const notes = insightGetByPage(insightCurrentPage)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  list.innerHTML = '';

  if (notes.length === 0) {
    emptyState.style.display = 'flex';
    list.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    list.style.display = 'flex';

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'insight-note-card';
      card.dataset.cat = note.category;

      const catLabel = CAT_LABELS[note.category] || note.category;
      const catClass = 'cat-' + note.category;
      const date     = new Date(note.updatedAt || note.createdAt);
      const timeStr  = date.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const edited   = note.updatedAt && note.updatedAt !== note.createdAt ? ' · diedit' : '';

      card.innerHTML = `
        <div class="insight-note-top">
          <span class="insight-note-category ${catClass}">${catLabel}</span>
          <div class="insight-note-actions">
            <button class="insight-action-btn edit" title="Edit" onclick="insightStartEdit('${note.id}')">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="insight-action-btn del" title="Hapus" onclick="insightDeleteNote('${note.id}')">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="insight-note-text">${escapeHtml(note.text)}</div>
        <div class="insight-note-meta">
          <span class="insight-note-time">${timeStr}${edited}</span>
        </div>
      `;
      list.appendChild(card);
    });
  }

  insightUpdateBadge(insightCurrentPage);
}

/* ── Save / update note ── */
function saveInsightNote() {
  const text     = document.getElementById('insightTextarea').value.trim();
  const category = document.getElementById('insightCategory').value;

  if (!text) {
    document.getElementById('insightTextarea').focus();
    document.getElementById('insightTextarea').style.borderColor = '#EF4444';
    setTimeout(() => {
      document.getElementById('insightTextarea').style.borderColor = '';
    }, 1500);
    return;
  }
  if (text.length > 500) return;

  const notes = insightGetAll();

  if (insightEditingId) {
    // Edit mode
    const idx = notes.findIndex(n => n.id === insightEditingId);
    if (idx !== -1) {
      notes[idx].text      = text;
      notes[idx].category  = category;
      notes[idx].updatedAt = new Date().toISOString();
    }
    insightEditingId = null;
  } else {
    // New note
    notes.push({
      id:        'note_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      page:      insightCurrentPage,
      category,
      text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  insightSaveAll(notes);
  insightRenderNotes();
  cancelInsightEdit();

  // Brief success flash on button
  const btn = document.getElementById('insightSaveBtn');
  btn.style.background = '#16A34A';
  btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Tersimpan!`;
  setTimeout(() => {
    btn.style.background = '';
    btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Simpan`;
  }, 1400);
}

/* ── Start editing a note ── */
function insightStartEdit(id) {
  const note = insightGetAll().find(n => n.id === id);
  if (!note) return;

  insightEditingId = id;
  document.getElementById('insightTextarea').value   = note.text;
  document.getElementById('insightCategory').value   = note.category;
  document.getElementById('insightFormTitle').textContent = 'Edit Catatan';
  document.getElementById('insightFormCancelBtn').style.display = 'inline-block';
  document.getElementById('insightCharCount').textContent = note.text.length + ' / 500';
  document.getElementById('insightTextarea').focus();
  document.getElementById('insightTextarea').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Cancel edit ── */
function cancelInsightEdit() {
  insightEditingId = null;
  document.getElementById('insightTextarea').value   = '';
  document.getElementById('insightCategory').value   = 'info';
  document.getElementById('insightFormTitle').textContent = 'Tambah Catatan Baru';
  document.getElementById('insightFormCancelBtn').style.display = 'none';
  document.getElementById('insightCharCount').textContent = '0 / 500';
}

/* ── Delete note ── */
function insightDeleteNote(id) {
  if (!confirm('Hapus catatan ini?')) return;
  const notes = insightGetAll().filter(n => n.id !== id);
  insightSaveAll(notes);
  insightRenderNotes();
}

/* ── Char counter ── */
document.addEventListener('DOMContentLoaded', () => {
  const ta = document.getElementById('insightTextarea');
  if (ta) {
    ta.addEventListener('input', () => {
      const len = ta.value.length;
      const el  = document.getElementById('insightCharCount');
      if (el) el.textContent = len + ' / 500';
      if (len > 500) ta.value = ta.value.slice(0, 500);
    });
  }
});

/* ── HTML escape helper ── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

/* ── Patch applyRole to show/hide FAB ── */
(function patchApplyRoleForInsight() {
  const _origApplyRole = window.applyRole;
  window.applyRole = function(role) {
    if (typeof _origApplyRole === 'function') _origApplyRole(role);
    // After role applied, refresh insight FAB visibility
    setTimeout(() => insightUpdateForPage(insightCurrentPage), 50);
  };
})();
/* ══════════════════════════════════════════════════════════
   BANNER PENGUMUMAN — Sistem Kelola Banner (Admin Only)
   Storage key: 'announcement_banners_indocement'
   Structure: [{ id, type, target, title, message, active,
                 createdAt, createdBy, dismissedBy:[] }]
   ══════════════════════════════════════════════════════════ */

const BANNER_STORAGE_KEY = 'announcement_banners_indocement';
let bannerEditingId = null;
let pendingSaveInfo = null; // info data terakhir disimpan admin

const BANNER_ICONS = {
  info:    '📢',
  success: '✅',
  warning: '⚠️',
  update:  '🔔',
};

const BANNER_TYPE_LABELS = {
  info:    'Informasi',
  success: 'Data Baru',
  warning: 'Perhatian',
  update:  'Pembaruan',
};

const BANNER_TARGET_LABELS = {
  all:         'Semua Halaman',
  keuangan:    'Executive Summary',
  operasional: 'Resource Overview',
  penjualan:   'Cash Flow',
  margin:      'Margin Trends',
  balance:     'Balance Sheet Trends',
  kfi:         'Key Financial Indicators',
};

/* ── Storage helpers ── */
function bannerGetAll() {
  try { return JSON.parse(localStorage.getItem(BANNER_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function bannerSaveAll(list) {
  localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(list));
}

/* ── Get active banners for a page ── */
function bannerGetForPage(page) {
  const dismissedKey = 'banner_dismissed_' + (currentRole || 'guest');
  let dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]'); } catch {}

  return bannerGetAll().filter(b =>
    b.active &&
    (b.target === 'all' || b.target === page) &&
    !dismissed.includes(b.id)
  );
}

/* ── Render banners in #bannerArea ── */
function renderBannerArea(page) {
  const area = document.getElementById('bannerArea');
  if (!area || !page || page === 'home') {
    if (area) area.style.display = 'none';
    return;
  }

  const banners = bannerGetForPage(page);
  if (banners.length === 0) {
    area.style.display = 'none';
    return;
  }

  area.style.display = 'block';
  area.innerHTML = banners.map(b => {
    const icon = BANNER_ICONS[b.type] || '📢';
    const date = new Date(b.createdAt).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="banner-announcement type-${b.type}" id="banner-display-${b.id}">
        <div class="banner-announcement-icon">${icon}</div>
        <div class="banner-announcement-body">
          ${b.title ? `<div class="banner-announcement-title">${escapeHtml(b.title)}</div>` : ''}
          <div class="banner-announcement-text">${escapeHtml(b.message)}</div>
          <div class="banner-announcement-meta">
            <span>${date}</span>
            <span>·</span>
            <span class="meta-by">Admin</span>
            ${b.target !== 'all' ? `<span>·</span><span>${BANNER_TARGET_LABELS[b.target] || b.target}</span>` : ''}
          </div>
        </div>
        <button class="banner-dismiss-btn" onclick="dismissBanner('${b.id}')" title="Tutup">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

/* ── Dismiss banner (per user) ── */
function dismissBanner(id) {
  const dismissedKey = 'banner_dismissed_' + (currentRole || 'guest');
  let dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]'); } catch {}
  if (!dismissed.includes(id)) dismissed.push(id);
  localStorage.setItem(dismissedKey, JSON.stringify(dismissed));

  // Animate out
  const el = document.getElementById('banner-display-' + id);
  if (el) {
    el.style.transition = 'opacity 0.25s, max-height 0.35s, padding 0.35s';
    el.style.opacity    = '0';
    el.style.maxHeight  = el.offsetHeight + 'px';
    setTimeout(() => {
      el.style.maxHeight = '0';
      el.style.padding   = '0';
      el.style.border    = 'none';
    }, 50);
    setTimeout(() => {
      el.remove();
      const area = document.getElementById('bannerArea');
      if (area && !area.children.length) area.style.display = 'none';
    }, 400);
  }
}

/* ── Kelola Banner — di halaman Admin Panel ── */
function toggleBannerPanel() {
  openAdminPage('banner');
}
function closeBannerPanel() {
  cancelBannerEdit();
}

/* ── Render management list ── */
function renderBannerMgmtList() {
  const list      = document.getElementById('bannerList');
  const emptyEl   = document.getElementById('bannerEmptyState');
  if (!list) return;

  const banners = bannerGetAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  list.innerHTML = '';

  if (banners.length === 0) {
    list.style.display = 'none';
    emptyEl.style.display = 'flex';
  } else {
    list.style.display = 'flex';
    emptyEl.style.display = 'none';

    banners.forEach(b => {
      const card = document.createElement('div');
      card.className = 'banner-mgmt-card' + (b.active ? '' : ' inactive');

      const date = new Date(b.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      card.innerHTML = `
        <div class="banner-mgmt-top">
          <div class="banner-mgmt-badges">
            <span class="banner-type-badge btype-${b.type}">${BANNER_TYPE_LABELS[b.type]}</span>
            <span class="banner-target-badge">${BANNER_TARGET_LABELS[b.target] || b.target}</span>
            <span class="${b.active ? 'banner-active-badge' : 'banner-inactive-badge'}">${b.active ? 'Aktif' : 'Nonaktif'}</span>
          </div>
          <div class="banner-mgmt-actions">
            <button class="banner-action-btn toggle" title="${b.active ? 'Nonaktifkan' : 'Aktifkan'}" onclick="toggleBannerActive('${b.id}')">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                ${b.active
                  ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                  : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'}
              </svg>
            </button>
            <button class="banner-action-btn edit" title="Edit" onclick="bannerStartEdit('${b.id}')">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="banner-action-btn del" title="Hapus" onclick="deleteBanner('${b.id}')">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
        ${b.title ? `<div class="banner-mgmt-title">${escapeHtml(b.title)}</div>` : ''}
        <div class="banner-mgmt-text">${escapeHtml(b.message)}</div>
        <div class="banner-mgmt-meta">Dibuat: ${date}</div>`;

      list.appendChild(card);
    });
  }

  // Update admin badge
  updateBannerAdminBadge();
}

/* ── Save new / update banner ── */
function saveBanner() {
  const message = document.getElementById('bannerMessageInput').value.trim();
  const title   = document.getElementById('bannerTitleInput').value.trim();
  const type    = document.getElementById('bannerType').value;
  const target  = document.getElementById('bannerTarget').value;

  if (!message) {
    const el = document.getElementById('bannerMessageInput');
    el.style.borderColor = '#EF4444';
    el.focus();
    setTimeout(() => el.style.borderColor = '', 1500);
    return;
  }

  const banners = bannerGetAll();

  if (bannerEditingId) {
    const idx = banners.findIndex(b => b.id === bannerEditingId);
    if (idx !== -1) {
      banners[idx] = { ...banners[idx], type, target, title, message, updatedAt: new Date().toISOString() };
    }
    bannerEditingId = null;
  } else {
    banners.push({
      id:        'bnr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type, target, title, message,
      active:    true,
      createdAt: new Date().toISOString(),
      createdBy: 'Admin',
    });
  }

  bannerSaveAll(banners);
  renderBannerMgmtList();
  cancelBannerEdit();
  updateBannerAdminBadge();

  // Refresh banner area for current page
  renderBannerArea(insightCurrentPage);

  // Success flash
  const btn = document.getElementById('bannerSaveBtn');
  const origText = btn.innerHTML;
  btn.style.background = '#16A34A';
  btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Diterbitkan!`;
  setTimeout(() => {
    btn.style.background = '';
    btn.innerHTML = origText;
  }, 1500);
}

/* ── Toggle active/inactive ── */
function toggleBannerActive(id) {
  const banners = bannerGetAll();
  const idx = banners.findIndex(b => b.id === id);
  if (idx !== -1) banners[idx].active = !banners[idx].active;
  bannerSaveAll(banners);
  renderBannerMgmtList();
  renderBannerArea(insightCurrentPage);
}

/* ── Start edit ── */
function bannerStartEdit(id) {
  const b = bannerGetAll().find(b => b.id === id);
  if (!b) return;
  bannerEditingId = id;
  document.getElementById('bannerType').value         = b.type;
  document.getElementById('bannerTarget').value       = b.target;
  document.getElementById('bannerTitleInput').value   = b.title || '';
  document.getElementById('bannerMessageInput').value = b.message;
  document.getElementById('bannerCharCount').textContent = b.message.length + ' / 300';
  document.getElementById('bannerFormLabel').textContent = 'Edit Banner';
  document.getElementById('bannerFormCancelBtn').style.display = 'inline-block';
  document.getElementById('bannerSaveBtn').innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Simpan Perubahan`;
  document.getElementById('bannerMessageInput').focus();
}

function cancelBannerEdit() {
  bannerEditingId = null;
  document.getElementById('bannerMessageInput').value = '';
  document.getElementById('bannerTitleInput').value   = '';
  document.getElementById('bannerType').value         = 'info';
  document.getElementById('bannerTarget').value       = 'all';
  document.getElementById('bannerCharCount').textContent = '0 / 300';
  document.getElementById('bannerFormLabel').textContent = 'Buat Banner Baru';
  document.getElementById('bannerFormCancelBtn').style.display = 'none';
  const btn = document.getElementById('bannerSaveBtn');
  if (btn) btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Terbitkan Banner`;
}

/* ── Delete banner ── */
function deleteBanner(id) {
  if (!confirm('Hapus banner ini?')) return;
  bannerSaveAll(bannerGetAll().filter(b => b.id !== id));
  renderBannerMgmtList();
  renderBannerArea(insightCurrentPage);
}

/* ── Update admin badge count ── */
function updateBannerAdminBadge() {
  const badge = document.getElementById('bannerAdminBadge');
  const btn   = document.getElementById('btnKelolaBanner');
  if (!badge || !btn) return;
  const count = bannerGetAll().filter(b => b.active).length;
  if (count > 0) {
    badge.textContent   = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ── Char counter for banner message ── */
document.addEventListener('DOMContentLoaded', () => {
  const msgEl = document.getElementById('bannerMessageInput');
  if (msgEl) {
    msgEl.addEventListener('input', () => {
      const len = msgEl.value.length;
      const el  = document.getElementById('bannerCharCount');
      if (el) el.textContent = len + ' / 300';
      if (len > 300) msgEl.value = msgEl.value.slice(0, 300);
    });
  }
});

/* ══════════════════════════════════════════════════════════
   POST-SAVE ANNOUNCEMENT FLOW
   Triggered after admin successfully saves data
   ══════════════════════════════════════════════════════════ */

function showAnnouncementPrompt(dataInfo) {
  pendingSaveInfo = dataInfo;
  const infoEl = document.getElementById('announceDataInfo');
  if (infoEl) infoEl.textContent = '📋 ' + (dataInfo || 'Data keuangan baru telah ditambahkan');
  const backdrop = document.getElementById('announceModalBackdrop');
  if (backdrop) backdrop.classList.add('open');
}

function skipAnnouncement() {
  pendingSaveInfo = null;
  const backdrop = document.getElementById('announceModalBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function openAnnouncementFromSave() {
  const backdrop = document.getElementById('announceModalBackdrop');
  if (backdrop) backdrop.classList.remove('open');

  openAdminPage('banner');
  renderBannerMgmtList();

  setTimeout(() => {
    const typeEl = document.getElementById('bannerType');
    const targetEl = document.getElementById('bannerTarget');
    if (typeEl)   typeEl.value   = 'success';
    if (targetEl) targetEl.value = 'all';
    if (pendingSaveInfo) {
      const titleEl = document.getElementById('bannerTitleInput');
      const msgEl   = document.getElementById('bannerMessageInput');
      const countEl = document.getElementById('bannerCharCount');
      if (titleEl) titleEl.value = 'Data Baru Telah Ditambahkan';
      if (msgEl)   msgEl.value   = pendingSaveInfo;
      if (countEl) countEl.textContent = pendingSaveInfo.length + ' / 300';
      msgEl?.focus();
    }
  }, 150);

  pendingSaveInfo = null;
}

/* ══════════════════════════════════════════════════════════
   PATCH btnSubmit to show announcement prompt after save
   ══════════════════════════════════════════════════════════ */
(function patchBtnSubmitForBanner() {
  // We patch the form submission success by overriding refreshDashboard
  // and hooking into the post-save flow via MutationObserver on modalStatus
  const statusEl = document.getElementById('modalStatus');
  if (!statusEl) return;

  const observer = new MutationObserver(() => {
    const text = statusEl.textContent || '';
    if (text.startsWith('✓') && currentRole === 'admin') {
      // Success save detected — build a friendly info string
      const activeTab = document.querySelector('.modal-tab.active')?.textContent?.trim() || 'Data';

      // Try to extract year/quarter from visible selects
      let period = '';
      const activeTabId = document.querySelector('.modal-tab.active')?.dataset?.tab;
      if (activeTabId === 'labarugi') {
        const y = document.getElementById('lr-tahun')?.value;
        const q = document.getElementById('lr-kuartal')?.value;
        if (y || q) period = [q, y].filter(Boolean).join(' ');
      } else if (activeTabId === 'aruskas') {
        const y = document.getElementById('ak-tahun')?.value;
        const q = document.getElementById('ak-kuartal')?.value;
        if (y || q) period = [q, y].filter(Boolean).join(' ');
      } else if (activeTabId === 'neraca') {
        const y = document.getElementById('nc-tahun')?.value;
        const q = document.getElementById('nc-kuartal')?.value;
        if (y || q) period = [q, y].filter(Boolean).join(' ');
      }

      const info = `Data ${activeTab}${period ? ' periode ' + period : ''} telah berhasil ditambahkan ke dashboard.`;

      // Show prompt after modal closes (1800ms timeout in original code)
      setTimeout(() => {
        if (currentRole === 'admin') showAnnouncementPrompt(info);
      }, 2000);

      observer.disconnect();
      // Re-attach after a moment (in case user submits again)
      setTimeout(() => observer.observe(statusEl, { childList: true, characterData: true, subtree: true }), 3000);
    }
  });

  observer.observe(statusEl, { childList: true, characterData: true, subtree: true });
})();

/* ══════════════════════════════════════════════════════════
   PATCH applyRole & switchPage for banner visibility
   ══════════════════════════════════════════════════════════ */
(function patchForBanner() {
  // Patch applyRole
  const _origApplyRole2 = window.applyRole;
  window.applyRole = function(role) {
    if (typeof _origApplyRole2 === 'function') _origApplyRole2(role);
    updateBannerAdminBadge();
  };

  // Patch switchPage — refresh banner area when navigating
  const _origSwitch2 = window.switchPage;
  window.switchPage = function(page) {
    if (typeof _origSwitch2 === 'function') _origSwitch2(page);
    renderBannerArea(page);
  };
})();
/* ══════════════════════════════════════════════════════════
   PAGE: LAPORAN KEUANGAN — Accordion
   ══════════════════════════════════════════════════════════ */
(function initLaporanKeuangan() {
  const calSvg = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

 function getReports(year) {
    if (year === 2026) {
      return [
        {
          name: `Laporan Keuangan Kuartal 1 Tahun ${year} Indocement`,
          date: `Rabu, 30 April ${year}`,
          file: `files/laporan-keuangan-q1-${year}.pdf`
        }
      ];
    }
    return [
      {
        name: `Laporan Audit Indocement Tahun Buku ${year}`,
        date: `Selasa, 31 Maret ${year + 1}`,
        file: `files/laporan-audit-${year}.pdf`
      },
      {
        name: `Laporan Keuangan Kuartal 3 Tahun ${year} Indocement`,
        date: `Jumat, 31 Oktober ${year}`,
        file: `files/laporan-keuangan-q3-${year}.pdf`
      },
      {
        name: `Laporan Keuangan Kuartal 2 Tahun ${year} Indocement`,
        date: `Kamis, 31 Juli ${year}`,
        file: `files/laporan-keuangan-q2-${year}.pdf`
      },
      {
        name: `Laporan Keuangan Kuartal 1 Tahun ${year} Indocement`,
        date: `Rabu, 30 April ${year}`,
        file: `files/laporan-keuangan-q1-${year}.pdf`
      },
    ];
  }

  function renderAccordions() {
    const container = document.getElementById('lkAccordionList');
    if (!container || container.dataset.rendered) return;
    container.dataset.rendered = '1';

    for (let year = 2026; year >= 2016; year--) {
      const reports = getReports(year);

      // Cek apakah accordion tahun ini sudah dibuat oleh injectIntoAccordion (upload sebelum buka halaman)
      let acc = null;
      container.querySelectorAll('.lk-accordion').forEach(el => {
        const t = (el.querySelector('.lk-accordion-title')?.textContent || '').trim();
        if (t.includes(String(year))) acc = el;
      });

      if (acc) {
        // Merge: tambahkan laporan default ke accordion yang sudah ada
        const reportList = acc.querySelector('.lk-accordion-body > .lk-report-list')
                        || acc.querySelector('.lk-report-list');
        if (reportList) {
          reports.forEach(r => {
            const itemEl = document.createElement('div');
            itemEl.className = 'lk-report-item';
            itemEl.innerHTML = `
              <div class="lk-report-doc-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div class="lk-report-info">
                <div class="lk-report-name">${r.name}</div>
                <div class="lk-report-date">${calSvg} Dipublikasikan pada ${r.date}</div>
              </div>
              <a class="lk-report-dl-btn" href="${r.file}" download title="Unduh Laporan">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>`;
            reportList.appendChild(itemEl);
          });
          const badge = acc.querySelector('.lk-accordion-badge');
          if (badge) badge.textContent = reportList.querySelectorAll('.lk-report-item').length + ' Laporan';
        }
      } else {
        // Buat accordion baru
        acc = document.createElement('div');
        acc.className = 'lk-accordion';
        acc.innerHTML =
          '<div class="lk-accordion-head">' +
            '<div class="lk-accordion-bar"></div>' +
            '<div class="lk-accordion-cal-icon">' + calSvg + '</div>' +
            '<div class="lk-accordion-title">LAPORAN KEUANGAN ' + year + '</div>' +
            '<div class="lk-accordion-badge">' + reports.length + ' Laporan</div>' +
            '<div class="lk-accordion-chevron"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div>' +
          '</div>' +
          '<div class="lk-accordion-body"><div class="lk-report-list">' +
          reports.map(r =>
            '<div class="lk-report-item">' +
              '<div class="lk-report-doc-icon"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>' +
              '<div class="lk-report-info"><div class="lk-report-name">' + r.name + '</div><div class="lk-report-date">' + calSvg + ' Dipublikasikan pada ' + r.date + '</div></div>' +
              '<a class="lk-report-dl-btn" href="' + r.file + '" download title="Unduh Laporan"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>' +
            '</div>'
          ).join('') +
          '</div></div>';

        acc.querySelector('.lk-accordion-head').addEventListener('click', () => {
          const isOpen = acc.classList.contains('open');
          document.querySelectorAll('.lk-accordion.open').forEach(a => a.classList.remove('open'));
          if (!isOpen) acc.classList.add('open');
        });

        container.appendChild(acc);
      }
    }
  }

  // Render saat switchPage
  const _origSwitch3 = window.switchPage;
  window.switchPage = function(page) {
    if (typeof _origSwitch3 === 'function') _origSwitch3(page);
    if (page === 'laporan-keuangan') renderAccordions();
  };

  // Fallback: render saat DOMContentLoaded jika page sudah aktif
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('page-laporan-keuangan')?.classList.contains('active-page')) {
      renderAccordions();
    }
  });
})();
/* ── Laporan Keuangan: sidebar toggle button ── */
function toggleSidebar() {
  const body = document.body;
  const lkBtn = document.getElementById('lkSidebarToggle');
  const mainBtn = document.getElementById('sidebarToggle');
  const isMobile = window.innerWidth <= 768;

  // Ripple effect
  [lkBtn, mainBtn].forEach(btn => {
    if (btn) {
      btn.classList.add('ripple-active');
      setTimeout(() => btn.classList.remove('ripple-active'), 420);
    }
  });

  let isHidden;
  if (isMobile) {
    const isOpen = body.classList.toggle('mobile-sidebar-open');
    body.classList.toggle('sidebar-hidden', !isOpen);
    isHidden = !isOpen;
  } else {
    isHidden = body.classList.toggle('sidebar-hidden');
    body.classList.remove('mobile-sidebar-open');
    localStorage.setItem('sidebarHidden', isHidden);
  }

  const tooltip = isHidden ? 'Tampilkan menu' : 'Sembunyikan menu';
  if (mainBtn) mainBtn.setAttribute('data-tooltip', tooltip);
  if (lkBtn)  lkBtn.setAttribute('data-tooltip', tooltip);
}
/* ══════════════════════════════════════════════════════════
   ADMIN PANEL — TAB: UPLOAD LAPORAN KEUANGAN
   ══════════════════════════════════════════════════════════ */
(function initUploadLaporan() {
  let uploadedReports = [];

  const badgeClass = { q1:'q1', q2:'q2', q3:'q3', audit:'audit' };
  const typeLabel  = { q1:'Q1', q2:'Q2', q3:'Q3', audit:'Audit' };

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
  }

  function formatDateID(iso) {
    if (!iso) return '—';
    // Parse tanggal manual agar tidak terpengaruh timezone
    const parts = iso.split('-');
    const d = new Date(+parts[0], +parts[1]-1, +parts[2]);
    const days   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function setStatus(type, msg) {
    const el = document.getElementById('ulStatus');
    if (!el) return;
    el.className = 'upload-status ' + type;
    el.textContent = msg;
    if (type === 'success') setTimeout(() => { el.textContent = ''; el.className = 'upload-status'; }, 5000);
  }

  // ── Dropzone & file selection ──
  let selectedFile = null;

  function getEls() {
    return {
      dropzone  : document.getElementById('ulDropzone'),
      fileInput : document.getElementById('ul-file'),
      preview   : document.getElementById('ulFilePreview'),
      inner     : document.getElementById('ulDropzoneInner'),
      fileNameEl: document.getElementById('ulFileName'),
      fileSizeEl: document.getElementById('ulFileSize'),
      removeBtn : document.getElementById('ulFileRemove'),
    };
  }

  function showPreview(file) {
    selectedFile = file;
    const { preview, inner, fileNameEl, fileSizeEl } = getEls();
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
    if (preview) preview.style.display = 'flex';
    if (inner)   inner.style.display   = 'none';
  }

  function clearPreview() {
    selectedFile = null;
    const { fileInput, preview, inner } = getEls();
    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
    if (inner)   inner.style.display   = 'flex';
  }

  // Pasang event listener dengan event delegation agar bekerja meski elemen
  // sempat tersembunyi saat script pertama kali dijalankan
  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'ul-file') {
      const file = e.target.files[0];
      if (file) showPreview(file);
    }
  });

  document.addEventListener('click', function(e) {
    if (e.target && e.target.closest('#ulFileRemove')) {
      e.stopPropagation();
      clearPreview();
    }
  });

  document.addEventListener('dragover', function(e) {
    if (e.target && e.target.closest('#ulDropzone')) {
      e.preventDefault();
      e.target.closest('#ulDropzone').classList.add('drag-over');
    }
  });
  document.addEventListener('dragleave', function(e) {
    const dz = e.target && e.target.closest('#ulDropzone');
    if (dz) dz.classList.remove('drag-over');
  });
  document.addEventListener('drop', function(e) {
    const dz = e.target && e.target.closest('#ulDropzone');
    if (!dz) return;
    e.preventDefault();
    dz.classList.remove('drag-over');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') showPreview(file);
    else setStatus('error', 'Hanya file PDF yang diterima.');
  });

  // ── Render daftar laporan ──
  function renderList() {
    const listEl  = document.getElementById('ulReportList');
    const emptyEl = document.getElementById('ulEmptyState');
    const countEl = document.getElementById('ulListCount');
    if (!listEl) return;

    if (countEl) countEl.textContent = uploadedReports.length;

    if (uploadedReports.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = uploadedReports.slice().reverse().map(r => `
      <div class="upload-report-item" data-id="${r.id}">
        <div class="upload-report-pdf-icon">
          <svg width="18" height="18" fill="none" stroke="#C0392B" stroke-width="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div class="upload-report-info">
          <div class="upload-report-name">${r.name}</div>
          <div class="upload-report-meta">
            <span class="upload-report-badge ${badgeClass[r.type]||''}">${r.year} · ${typeLabel[r.type]||r.type}</span>
            <span class="upload-report-date">${r.dateStr} · ${r.fileSize}</span>
          </div>
        </div>
        <div class="upload-report-actions">
          <button class="upload-report-btn view" title="Buka laporan" onclick="ulViewReport('${r.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button class="upload-report-btn" title="Hapus laporan" onclick="ulDeleteReport('${r.id}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>`).join('');
  }

  // ── Inject ke accordion halaman Laporan Keuangan ──
  const calSvg = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  function injectIntoAccordion(report) {
    const container = document.getElementById('lkAccordionList');
    if (!container) return;

    let acc = null;
    container.querySelectorAll('.lk-accordion').forEach(el => {
      const titleText = (el.querySelector('.lk-accordion-title')?.textContent || '').trim();
      if (titleText.includes(String(report.year))) acc = el;
    });

    if (!acc) {
      acc = document.createElement('div');
      acc.className = 'lk-accordion';
      acc.innerHTML = `
        <div class="lk-accordion-head">
          <div class="lk-accordion-bar"></div>
          <div class="lk-accordion-cal-icon">${calSvg}</div>
          <div class="lk-accordion-title">LAPORAN KEUANGAN ${report.year}</div>
          <div class="lk-accordion-badge">0 Laporan</div>
          <div class="lk-accordion-chevron">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="lk-accordion-body"><div class="lk-report-list"></div></div>`;
      acc.querySelector('.lk-accordion-head').addEventListener('click', () => {
        const isOpen = acc.classList.contains('open');
        container.querySelectorAll('.lk-accordion.open').forEach(a => a.classList.remove('open'));
        if (!isOpen) acc.classList.add('open');
      });
      let inserted = false;
      container.querySelectorAll('.lk-accordion').forEach(existing => {
        const yr = parseInt((existing.querySelector('.lk-accordion-title')?.textContent || '').match(/\d{4}/)?.[0] || '0');
        if (!inserted && report.year > yr) { container.insertBefore(acc, existing); inserted = true; }
      });
      if (!inserted) container.appendChild(acc);
    }

    const reportList = acc.querySelector('.lk-accordion-body > .lk-report-list') 
                    || acc.querySelector('.lk-report-list');
    if (!reportList) return;
    const itemEl = document.createElement('div');
    itemEl.className = 'lk-report-item';
    itemEl.dataset.uploadId = report.id;
    itemEl.innerHTML = `
      <div class="lk-report-doc-icon">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div class="lk-report-info">
        <div class="lk-report-name">${report.name}</div>
        <div class="lk-report-date">${calSvg} Dipublikasikan pada ${report.dateStr}</div>
      </div>
      <a class="lk-report-dl-btn" href="${report.fileDataUrl}" download="${report.fileName}" title="Unduh Laporan">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>`;
    reportList.prepend(itemEl);

    const badge = acc.querySelector('.lk-accordion-badge');
    if (badge) badge.textContent = `${reportList.querySelectorAll('.lk-report-item').length} Laporan`;
  }

  function removeFromAccordion(reportId) {
    const item = document.querySelector(`.lk-report-item[data-upload-id="${reportId}"]`);
    if (!item) return;
    const acc = item.closest('.lk-accordion');
    item.remove();
    if (acc) {
      const count = acc.querySelectorAll('.lk-report-item').length;
      const badge = acc.querySelector('.lk-accordion-badge');
      if (badge) badge.textContent = `${count} Laporan`;
    }
  }

  // ── Submit via event delegation ──
  document.addEventListener('click', function(e) {
    const btn = e.target && e.target.closest('#btnUploadLaporan');
    if (!btn) return;

    const nama    = (document.getElementById('ul-nama')?.value || '').trim();
    const tahun   = document.getElementById('ul-tahun')?.value || '';
    const jenis   = document.getElementById('ul-jenis')?.value || '';
    const tanggal = document.getElementById('ul-tanggal')?.value || '';

    if (!nama)         return setStatus('error', 'Nama laporan wajib diisi.');
    if (!tahun)        return setStatus('error', 'Tahun wajib dipilih.');
    if (!jenis)        return setStatus('error', 'Jenis laporan wajib dipilih.');
    if (!tanggal)      return setStatus('error', 'Tanggal publikasi wajib diisi.');
    if (!selectedFile) return setStatus('error', 'File PDF wajib dipilih.');
    if (selectedFile.size > 52428800) return setStatus('error', 'Ukuran file melebihi 50 MB.');

    const txtEl = btn.querySelector('.btn-upload-text');
    const ldrEl = btn.querySelector('.btn-upload-loader');
    if (txtEl) txtEl.style.display = 'none';
    if (ldrEl) ldrEl.style.display = 'inline-flex';
    btn.disabled = true;

    const reader = new FileReader();
    reader.onload = function(ev) {
      const report = {
        id         : 'ul_' + Date.now(),
        name       : nama,
        year       : parseInt(tahun),
        type       : jenis,
        dateStr    : formatDateID(tanggal),
        fileName   : selectedFile.name,
        fileSize   : formatBytes(selectedFile.size),
        fileDataUrl: ev.target.result
      };
      uploadedReports.push(report);
      renderList();
      injectIntoAccordion(report);

      // Reset form
      const fields = ['ul-nama','ul-tahun','ul-jenis','ul-tanggal'];
      fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      clearPreview();

      if (txtEl) txtEl.style.display = 'inline';
      if (ldrEl) ldrEl.style.display = 'none';
      btn.disabled = false;
      setStatus('success', '✓ Laporan berhasil ditambahkan ke halaman Laporan Keuangan!');
    };
    reader.onerror = function() {
      if (txtEl) txtEl.style.display = 'inline';
      if (ldrEl) ldrEl.style.display = 'none';
      btn.disabled = false;
      setStatus('error', 'Gagal membaca file. Coba lagi.');
    };
    reader.readAsDataURL(selectedFile);
  });

  // ── Global actions ──
  window.ulViewReport = function(id) {
    const r = uploadedReports.find(x => x.id === id);
    if (!r) return;
    const win = window.open('', '_blank');
    if (win) win.document.write(`<!DOCTYPE html><html><body style="margin:0"><iframe src="${r.fileDataUrl}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
  };
  window.ulDeleteReport = function(id) {
    if (!confirm('Hapus laporan ini? Laporan juga akan dihapus dari halaman Laporan Keuangan.')) return;
    removeFromAccordion(id);
    uploadedReports = uploadedReports.filter(r => r.id !== id);
    renderList();
  };
})();

/* ══════════════════════════════════════════════
   PAGE: PROFIL ADMIN
   ══════════════════════════════════════════════ */
(function initProfilePage() {

  // State simpan di memori (direset saat logout)
  const profileData = { name: '', email: '', position: '' };

  function formatNow(date) {
    const d = date instanceof Date ? date : new Date();
    const pad = n => String(n).padStart(2,'0');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Isi form saat halaman profil dibuka
  function populateProfile() {
    if (!currentRole || !currentUser) return; // belum login, tidak perlu isi

    const user     = currentUser;
    const name     = profileData.name || user.nama || user.username || '';
    const initials = user.initials || (user.nama || user.username || 'AU').slice(0, 2).toUpperCase();

    // Avatar & sidebar
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('profileAvatarCircle',    initials);
    setTxt('profileDisplayName',     name);
    setTxt('profileUsernameDisplay', user.username || '—');
    setTxt('profileRoleBadge',       user.role === 'admin' ? 'ADMINISTRATOR' : 'USER');
    setTxt('profileAccessLevel',     user.role === 'admin' ? 'Full Access' : 'Read Only');

    // Ambil waktu login terakhir dari localStorage (disimpan saat doLogin berhasil)
    const stored = localStorage.getItem('last_login_time');
    const loginTime = stored ? new Date(stored) : null;
    setTxt('profileLastLogin', loginTime ? formatNow(loginTime) : '—');

    // Form fields
    document.getElementById('pfName').value     = profileData.name || name;
    document.getElementById('pfUsername').value = user.username || '';
    document.getElementById('pfEmail').value    = profileData.email || user.email || '';
    document.getElementById('pfPosition').value = profileData.position || user.divisi || '';

    // Clear password fields & status
    ['pfOldPass','pfNewPass','pfConfPass'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    setStatus('pfInfoStatus', '', '');
    setStatus('pfPassStatus', '', '');
    const sw = document.getElementById('pfPassStrengthWrap');
    if (sw) sw.style.display = 'none';
  }

  function setStatus(elId, type, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = 'profile-save-status' + (type ? ' ' + type : '');
    el.textContent = msg;
    if (type === 'success') setTimeout(() => { el.textContent = ''; el.className = 'profile-save-status'; }, 4000);
  }

  // Buka halaman profil
  window.openProfilePage = function() {
    closeProfileDropdown();
    switchPage('profile');
    // Panggil langsung setelah DOM halaman aktif
    setTimeout(populateProfile, 0);
  };

  // Switch tab profil (Informasi Pribadi / Sistem / Keamanan)
  window.switchPfTab = function(tabKey, btnEl) {
    // Activate clicked button
    document.querySelectorAll('.pf2-tab').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    // Show correct panel
    document.querySelectorAll('.pf2-panel').forEach(panel => panel.classList.remove('active'));
    const panel = document.getElementById('pf2-panel-' + tabKey);
    if (panel) panel.classList.add('active');
  };

  // Tombol kembali
  document.addEventListener('click', function(e) {
    if (e.target && e.target.closest('#profileBackBtn')) {
      history.back ? window.history.go(-1) : switchPage('keuangan');
      switchPage('keuangan');
    }
  });

  // Patch switchPage agar populateProfile dipanggil saat buka halaman profile
  const _origSwitchProfile = window.switchPage;
  window.switchPage = function(page) {
    if (typeof _origSwitchProfile === 'function') _origSwitchProfile(page);
    if (page === 'profile') setTimeout(populateProfile, 0);
  };

  // Simpan info pribadi
  window.saveProfileInfo = function() {
    const name     = (document.getElementById('pfName')?.value || '').trim();
    const email    = (document.getElementById('pfEmail')?.value || '').trim();
    const position = (document.getElementById('pfPosition')?.value || '').trim();

    if (!name) return setStatus('pfInfoStatus', 'error', 'Nama lengkap wajib diisi.');

    // Simpan ke state
    profileData.name     = name;
    profileData.email    = email;
    profileData.position = position;

    // Update display
    document.getElementById('profileDisplayName').textContent = name;
    if (document.getElementById('headerUserName')) document.getElementById('headerUserName').textContent = name;
    if (position && document.getElementById('headerUserRole')) document.getElementById('headerUserRole').textContent = position;

    setStatus('pfInfoStatus', 'success', '✓ Informasi berhasil disimpan!');
  };

  // Password strength checker
  window.checkPassStrength = function(val) {
    const wrap  = document.getElementById('pfPassStrengthWrap');
    const label = document.getElementById('pfPassStrengthLabel');
    const fill  = document.getElementById('pfPassStrengthFill');
    if (!wrap) return;
    if (!val) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';

    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { label: 'Sangat Lemah', color: '#ef4444', w: '20%' },
      { label: 'Lemah',        color: '#f97316', w: '40%' },
      { label: 'Cukup',        color: '#eab308', w: '60%' },
      { label: 'Kuat',         color: '#22c55e', w: '80%' },
      { label: 'Sangat Kuat',  color: '#16a34a', w: '100%' },
    ];
    const lvl = levels[Math.min(score, 4)];
    label.textContent       = lvl.label;
    label.style.color       = lvl.color;
    fill.style.width        = lvl.w;
    fill.style.background   = lvl.color;
  };

  // Simpan password — verifikasi via API Flask
  window.saveProfilePassword = async function() {
    const oldPass  = document.getElementById('pfOldPass')?.value || '';
    const newPass  = document.getElementById('pfNewPass')?.value || '';
    const confPass = document.getElementById('pfConfPass')?.value || '';

    if (!oldPass) return setStatus('pfPassStatus', 'error', 'Password saat ini wajib diisi.');
    if (newPass.length < 6) return setStatus('pfPassStatus', 'error', 'Password baru minimal 6 karakter.');
    if (newPass !== confPass) return setStatus('pfPassStatus', 'error', 'Konfirmasi password tidak cocok.');

    try {
      const res  = await fetch(`${API_BASE}/api/auth/change-password`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken() || ''}` },
        body   : JSON.stringify({ old_password: oldPass, new_password: newPass })
      });
      const data = await res.json();
      if (!res.ok) return setStatus('pfPassStatus', 'error', data.error || 'Gagal mengubah password.');
    } catch (_) {
      return setStatus('pfPassStatus', 'error', 'Tidak dapat terhubung ke server.');
    }

    // Clear fields
    ['pfOldPass','pfNewPass','pfConfPass'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const sw = document.getElementById('pfPassStrengthWrap');
    if (sw) sw.style.display = 'none';

    setStatus('pfPassStatus', 'success', '\u2713 Password berhasil diperbarui!');
  };

  // Toggle show/hide password
  window.togglePfPass = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText
      ? `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  };

})();

/* ══════════════════════════════════════════════
   REGISTER MODAL
   ══════════════════════════════════════════════ */
(function initRegister() {
  let currentStep = 1;

  function getEl(id) { return document.getElementById(id); }

  function showError(errId, msgId, msg) {
    const errEl = getEl(errId); const msgEl = getEl(msgId);
    if (errEl) errEl.style.display = 'flex';
    if (msgEl) msgEl.textContent = msg;
  }
  function hideError(errId) {
    const el = getEl(errId); if (el) el.style.display = 'none';
  }

  function goToStep(step) {
    currentStep = step;
    getEl('regFormStep1').style.display = step === 1 ? 'block' : 'none';
    getEl('regFormStep2').style.display = step === 2 ? 'block' : 'none';

    // Update step dots
    const s1 = getEl('regStep1Dot'), s2 = getEl('regStep2Dot'), line = getEl('regStepLine');
    if (step === 1) {
      s1.className = 'reg-step active'; s2.className = 'reg-step';
      if (line) line.classList.remove('active');
    } else {
      s1.className = 'reg-step done'; s2.className = 'reg-step active';
      if (line) line.classList.add('active');
    }
  }

  window.openRegisterModal = function() {
    closeLoginModal();
    // Reset form
    ['regUsername','regPassword','regConfirmPassword','regFirstName','regLastName','regEmail'].forEach(id => {
      const el = getEl(id); if (el) el.value = '';
    });
    // Set role otomatis dari tab yang dipilih di modal login
    const roleEl = getEl('regRole');
    if (roleEl) roleEl.value = selectedLoginRole || 'user';
    hideError('regError1'); hideError('regError2');
    getEl('regSuccess').style.display = 'none';
    goToStep(1);
    const sw = getEl('regPassStrengthWrap'); if (sw) sw.style.display = 'none';
    getEl('registerModalBackdrop').classList.add('open');
  };

  window.closeRegisterModal = function() {
    const el = getEl('registerModalBackdrop');
    if (el) el.classList.remove('open');
  };

  // Close on backdrop click
  document.addEventListener('click', function(e) {
    const backdrop = getEl('registerModalBackdrop');
    if (e.target === backdrop) closeRegisterModal();
  });

  // Step 1 → Step 2
  window.regNextStep = function() {
    hideError('regError1');
    const username = (getEl('regUsername')?.value || '').trim();
    const password = getEl('regPassword')?.value || '';
    const confirm  = getEl('regConfirmPassword')?.value || '';

    if (!username)        return showError('regError1','regError1Msg','Username wajib diisi.');
    if (username.length < 3) return showError('regError1','regError1Msg','Username minimal 3 karakter.');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return showError('regError1','regError1Msg','Username hanya boleh huruf, angka, dan underscore.');
    if (password.length < 6) return showError('regError1','regError1Msg','Password minimal 6 karakter.');
    if (password !== confirm)  return showError('regError1','regError1Msg','Konfirmasi password tidak cocok.');

    goToStep(2);
  };

  // Step 2 → Step 1
  window.regPrevStep = function() { goToStep(1); hideError('regError2'); };

  // Submit
  window.submitRegister = async function() {
    hideError('regError2');
    const firstName = (getEl('regFirstName')?.value || '').trim();
    const lastName  = (getEl('regLastName')?.value  || '').trim();
    const email     = (getEl('regEmail')?.value     || '').trim();
    // Role diambil dari hidden input yang sudah di-set otomatis saat modal dibuka
    const role      = getEl('regRole')?.value || selectedLoginRole || 'user';

    if (!firstName) return showError('regError2','regError2Msg','Nama depan wajib diisi.');

    const username = getEl('regUsername').value.trim();
    const password = getEl('regPassword').value;

    const btnText = getEl('regBtnText'); const btnLoader = getEl('regBtnLoader');
    btnText.style.display = 'none'; btnLoader.style.display = 'inline-flex';

    try {
      const res  = await fetch(`${API_BASE}/api/register`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          username,
          password,
          nama_depan   : firstName,
          nama_belakang: lastName,
          email,
          role
        })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        // Auto-login setelah register
        saveToken(data.token);
        currentRole = data.user.role;
        currentUser  = data.user;
        // Tampilkan sukses
        getEl('regFormStep2').style.display = 'none';
        getEl('regSuccess').style.display   = 'block';
        getEl('regSuccessUsername').textContent = username;
      } else {
        showError('regError2', 'regError2Msg', data.error || 'Registrasi gagal. Coba lagi.');
      }
    } catch (_) {
      showError('regError2', 'regError2Msg', 'Tidak dapat terhubung ke server.');
    } finally {
      btnText.style.display = 'inline'; btnLoader.style.display = 'none';
    }
  };

  // Dari sukses ke login (atau langsung masuk kalau sudah auto-login saat register)
  window.regGoToLogin = function() {
    closeRegisterModal();
    if (currentUser) {
      applyRole(currentUser);
      switchPage('keuangan');
    } else {
      const uEl = getEl('loginUsername');
      if (uEl) uEl.value = getEl('regUsername')?.value || '';
      openLoginModal();
    }
  };

  // Password strength
  window.checkRegPassStrength = function(val) {
    const wrap  = getEl('regPassStrengthWrap');
    const fill  = getEl('regPassStrengthFill');
    const label = getEl('regPassStrengthLabel');
    if (!wrap) return;
    if (!val)  { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';

    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { label:'Sangat Lemah', color:'#ef4444', w:'20%' },
      { label:'Lemah',        color:'#f97316', w:'40%' },
      { label:'Cukup',        color:'#eab308', w:'60%' },
      { label:'Kuat',         color:'#22c55e', w:'80%' },
      { label:'Sangat Kuat',  color:'#16a34a', w:'100%'},
    ];
    const lvl = levels[Math.min(score, 4)];
    label.textContent     = lvl.label;
    label.style.color     = lvl.color;
    fill.style.width      = lvl.w;
    fill.style.background = lvl.color;
  };

  // Toggle show/hide password
  window.toggleRegPass = function(inputId, btn) {
    const input = getEl(inputId); if (!input) return;
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText
      ? `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
      : `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  };
})();
