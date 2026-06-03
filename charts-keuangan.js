/* ══════════════════════════════════════════════════════════════
   CHART.JS — FINANCIAL OVERVIEW (Pengganti Metabase)
   Fetch data dari Flask API, render 3 chart:
   1. keu-chart1 → OCF 10-Year Trend (line)
   2. keu-chart2 → Net Income vs OCF (dual line)
   3. keu-chart3 → Financial Summary Table (HTML table)
   ══════════════════════════════════════════════════════════════ */

// ── Warna palette konsisten ──
const CHART_COLORS = {
  ocf:        '#3B82F6',  // biru
  net_income: '#F59E0B',  // amber
  revenue:    '#10B981',  // hijau
  capex:      '#EF4444',  // merah
  fcf:        '#8B5CF6',  // ungu
  grid:       'rgba(0,0,0,0.06)',
  gridDark:   'rgba(255,255,255,0.08)',
};

// ── Deteksi dark mode ──
function isDark() {
  return document.documentElement.classList.contains('dark') ||
         document.body.classList.contains('dark-mode') ||
         window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function chartTextColor() { return isDark() ? '#CBD5E1' : '#475569'; }
function chartGridColor() { return isDark() ? CHART_COLORS.gridDark : CHART_COLORS.grid; }

// ── Format angka Rupiah ──
function fmtRp(val) {
  if (val === null || val === undefined) return '—';
  const v = parseFloat(val);
  if (isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `Rp${(v/1_000_000).toFixed(2)}T`;
  if (abs >= 1_000)     return `Rp${(v/1_000).toFixed(2)}M`;
  return `Rp${v.toFixed(0)}jt`;
}

// ── Simpan instance chart agar bisa di-destroy saat update ──
const _keuCharts = {};

function destroyKeuChart(id) {
  if (_keuCharts[id]) {
    _keuCharts[id].destroy();
    delete _keuCharts[id];
  }
}

// ── Ganti iframe dengan canvas ──
function replaceIframeWithCanvas(iframeId) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return null;

  // Kalau sudah ada canvas, return canvas
  const existing = document.getElementById(iframeId + '-canvas');
  if (existing) return existing.getContext('2d');

  // Buat wrapper
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative; width:100%; height:320px; padding:0 8px 8px;';

  const canvas = document.createElement('canvas');
  canvas.id = iframeId + '-canvas';
  canvas.style.cssText = 'width:100%!important; height:100%!important;';
  wrapper.appendChild(canvas);

  // Sembunyikan iframe, sisipkan canvas setelah iframe
  iframe.style.display = 'none';
  iframe.parentNode.insertBefore(wrapper, iframe.nextSibling);

  return canvas.getContext('2d');
}

// ── Loading state ──
function showChartLoading(iframeId, msg = 'Memuat data...') {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return;
  let loader = document.getElementById(iframeId + '-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = iframeId + '-loader';
    loader.style.cssText = `
      display:flex; align-items:center; justify-content:center;
      height:320px; color:#94A3B8; font-size:13px; gap:8px;
    `;
    iframe.style.display = 'none';
    iframe.parentNode.insertBefore(loader, iframe.nextSibling);
  }
  loader.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> ${msg}`;
  loader.style.display = 'flex';
}

function hideChartLoading(iframeId) {
  const loader = document.getElementById(iframeId + '-loader');
  if (loader) loader.style.display = 'none';
}

// Tambah CSS spin animation sekali
if (!document.getElementById('chartjs-spin-style')) {
  const s = document.createElement('style');
  s.id = 'chartjs-spin-style';
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════
   CHART 1 — OCF 10-Year Trend
   Endpoint: /api/keuangan-detail?groupby=quarter (semua data)
   Fallback: pakai /api/kpi/keuangan per tahun
   ══════════════════════════════════════════════════════════ */
async function renderKeuChart1(tahun, kuartal) {
  showChartLoading('keu-chart1', 'Memuat tren arus kas...');

  try {
    // Ambil data semua periode dari endpoint detail
    const params = new URLSearchParams();
    if (tahun)   params.set('tahun',   tahun);
    if (kuartal) params.set('kuartal', kuartal);

    const res  = await fetch(`${API_BASE}/api/kpi/chart/ocf-trend?${params}`);
    let data;

    if (res.ok) {
      data = await res.json();
    } else {
      // Fallback: buat data dari endpoint yang ada
      data = await buildOcfTrendFromKpi(tahun, kuartal);
    }

    hideChartLoading('keu-chart1');
    destroyKeuChart('keu-chart1');
    const ctx = replaceIframeWithCanvas('keu-chart1');
    if (!ctx) return;

    const labels = data.labels || [];
    const ocfData = data.ocf || [];
    const fcfData = data.fcf || [];

    _keuCharts['keu-chart1'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Operating Cash Flow',
            data: ocfData,
            borderColor: CHART_COLORS.ocf,
            backgroundColor: CHART_COLORS.ocf + '18',
            borderWidth: 2.5,
            pointRadius: labels.length > 20 ? 2 : 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Free Cash Flow',
            data: fcfData,
            borderColor: CHART_COLORS.fcf,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: labels.length > 20 ? 2 : 3,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: chartTextColor(), font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmtRp(ctx.raw * 1000)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: chartTextColor(), font: { size: 11 }, maxRotation: 45 },
            grid:  { color: chartGridColor() }
          },
          y: {
            ticks: {
              color: chartTextColor(),
              font:  { size: 11 },
              callback: v => fmtRp(v * 1000)
            },
            grid: { color: chartGridColor() }
          }
        }
      }
    });

  } catch (err) {
    hideChartLoading('keu-chart1');
    showChartError('keu-chart1', 'Gagal memuat data tren OCF');
    console.error('Chart1 error:', err);
  }
}

/* ══════════════════════════════════════════════════════════
   CHART 2 — Net Income vs OCF Comparison
   ══════════════════════════════════════════════════════════ */
async function renderKeuChart2(tahun, kuartal) {
  showChartLoading('keu-chart2', 'Memuat perbandingan Net Income vs OCF...');

  try {
    const params = new URLSearchParams();
    if (tahun)   params.set('tahun',   tahun);
    if (kuartal) params.set('kuartal', kuartal);

    const res  = await fetch(`${API_BASE}/api/kpi/chart/income-ocf?${params}`);
    let data;

    if (res.ok) {
      data = await res.json();
    } else {
      data = await buildIncomeOcfFromKpi(tahun, kuartal);
    }

    hideChartLoading('keu-chart2');
    destroyKeuChart('keu-chart2');
    const ctx = replaceIframeWithCanvas('keu-chart2');
    if (!ctx) return;

    const labels   = data.labels || [];
    const niData   = data.net_income || [];
    const ocfData  = data.ocf || [];

    _keuCharts['keu-chart2'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Net Income',
            data: niData,
            borderColor: CHART_COLORS.net_income,
            backgroundColor: CHART_COLORS.net_income + '18',
            borderWidth: 2.5,
            pointRadius: labels.length > 20 ? 2 : 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Operating Cash Flow',
            data: ocfData,
            borderColor: CHART_COLORS.ocf,
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: labels.length > 20 ? 2 : 4,
            pointHoverRadius: 6,
            fill: false,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: chartTextColor(), font: { size: 12 }, usePointStyle: true, pointStyleWidth: 10 }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmtRp(ctx.raw * 1000)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: chartTextColor(), font: { size: 11 }, maxRotation: 45 },
            grid:  { color: chartGridColor() }
          },
          y: {
            ticks: {
              color: chartTextColor(),
              font:  { size: 11 },
              callback: v => fmtRp(v * 1000)
            },
            grid: { color: chartGridColor() }
          }
        }
      }
    });

  } catch (err) {
    hideChartLoading('keu-chart2');
    showChartError('keu-chart2', 'Gagal memuat data perbandingan');
    console.error('Chart2 error:', err);
  }
}

/* ══════════════════════════════════════════════════════════
   CHART 3 — Financial Summary Table
   ══════════════════════════════════════════════════════════ */
async function renderKeuChart3(tahun, kuartal) {
  showChartLoading('keu-chart3', 'Memuat tabel ringkasan...');

  try {
    const params = new URLSearchParams();
    if (tahun)   params.set('tahun',   tahun);
    if (kuartal) params.set('kuartal', kuartal);

    const res  = await fetch(`${API_BASE}/api/kpi/chart/summary-table?${params}`);
    let rows;

    if (res.ok) {
      const d = await res.json();
      rows = d.rows || [];
    } else {
      rows = await buildSummaryTableFromKpi(tahun, kuartal);
    }

    hideChartLoading('keu-chart3');

    const iframe = document.getElementById('keu-chart3');
    if (!iframe) return;

    // Hapus tabel lama jika ada
    const oldTable = document.getElementById('keu-chart3-table');
    if (oldTable) oldTable.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'keu-chart3-table';
    wrapper.style.cssText = `
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid ${isDark() ? '#334155' : '#E2E8F0'};
      margin: 0 0 8px 0;
    `;

    wrapper.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:${isDark() ? '#1E293B' : '#F8FAFC'}; border-bottom:2px solid ${isDark() ? '#334155' : '#E2E8F0'}">
            <th style="padding:10px 14px; text-align:left; color:${chartTextColor()}; font-weight:600;">Year</th>
            <th style="padding:10px 14px; text-align:left; color:${chartTextColor()}; font-weight:600;">Quarter</th>
            <th style="padding:10px 14px; text-align:right; color:${CHART_COLORS.ocf}; font-weight:600;">OCF</th>
            <th style="padding:10px 14px; text-align:right; color:${CHART_COLORS.net_income}; font-weight:600;">Net Income</th>
            <th style="padding:10px 14px; text-align:right; color:${CHART_COLORS.fcf}; font-weight:600;">FCF</th>
            <th style="padding:10px 14px; text-align:right; color:${CHART_COLORS.revenue}; font-weight:600;">Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? `<tr><td colspan="6" style="padding:24px; text-align:center; color:#94A3B8;">Tidak ada data untuk periode ini</td></tr>`
            : rows.map((r, i) => `
              <tr style="border-bottom:1px solid ${isDark() ? '#1E293B' : '#F1F5F9'}; background:${i%2===0 ? (isDark()?'#0F172A':'#FFFFFF') : (isDark()?'#1E293B':'#F8FAFC')}">
                <td style="padding:9px 14px; color:${chartTextColor()}; font-weight:600;">${r.year}</td>
                <td style="padding:9px 14px; color:${chartTextColor()};">
                  <span style="background:${isDark()?'#1E3A5F':'#EFF6FF'}; color:${CHART_COLORS.ocf}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">${r.quarter}</span>
                </td>
                <td style="padding:9px 14px; text-align:right; color:${chartTextColor()}; font-family:monospace;">${fmtRp(r.ocf * 1000)}</td>
                <td style="padding:9px 14px; text-align:right; color:${chartTextColor()}; font-family:monospace;">${fmtRp(r.net_income * 1000)}</td>
                <td style="padding:9px 14px; text-align:right; color:${chartTextColor()}; font-family:monospace;">${r.fcf !== null ? fmtRp(r.fcf * 1000) : '—'}</td>
                <td style="padding:9px 14px; text-align:right; color:${chartTextColor()}; font-family:monospace;">${fmtRp(r.revenue * 1000)}</td>
              </tr>`).join('')
          }
        </tbody>
      </table>
    `;

    iframe.style.display = 'none';
    iframe.parentNode.insertBefore(wrapper, iframe.nextSibling);

  } catch (err) {
    hideChartLoading('keu-chart3');
    showChartError('keu-chart3', 'Gagal memuat tabel ringkasan');
    console.error('Chart3 error:', err);
  }
}

/* ══════════════════════════════════════════════════════════
   FALLBACK: Build data dari endpoint /api/kpi/keuangan
   (dipakai jika endpoint /api/kpi/chart/* belum ada)
   ══════════════════════════════════════════════════════════ */
async function buildOcfTrendFromKpi(tahun, kuartal) {
  // Ambil semua tahun tersedia
  const tahunRes = await fetch(`${API_BASE}/api/tahun-tersedia`);
  const tahunData = await tahunRes.json();
  const years = tahun ? [parseInt(tahun)] : (tahunData.tahun || []).slice(0, 10).reverse();

  const quarters = kuartal ? [kuartal] : ['Q1','Q2','Q3','Q4'];
  const labels = [], ocfArr = [], fcfArr = [];

  for (const y of years) {
    for (const q of quarters) {
      const r = await fetch(`${API_BASE}/api/kpi/keuangan?tahun=${y}&kuartal=${q}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (!d.ada_data) continue;
      labels.push(`${q} ${y}`);
      ocfArr.push(d.ocf?.nilai_raw / 1000 || 0);
      fcfArr.push(d.fcf?.nilai_raw / 1000 || 0);
    }
  }
  return { labels, ocf: ocfArr, fcf: fcfArr };
}

async function buildIncomeOcfFromKpi(tahun, kuartal) {
  const tahunRes = await fetch(`${API_BASE}/api/tahun-tersedia`);
  const tahunData = await tahunRes.json();
  const years = tahun ? [parseInt(tahun)] : (tahunData.tahun || []).slice(0, 10).reverse();
  const quarters = kuartal ? [kuartal] : ['Q1','Q2','Q3','Q4'];
  const labels = [], niArr = [], ocfArr = [];

  for (const y of years) {
    for (const q of quarters) {
      const r = await fetch(`${API_BASE}/api/kpi/keuangan?tahun=${y}&kuartal=${q}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (!d.ada_data) continue;
      labels.push(`${q} ${y}`);
      niArr.push(d.net?.nilai_raw / 1000 || 0);
      ocfArr.push(d.ocf?.nilai_raw / 1000 || 0);
    }
  }
  return { labels, net_income: niArr, ocf: ocfArr };
}

async function buildSummaryTableFromKpi(tahun, kuartal) {
  const tahunRes = await fetch(`${API_BASE}/api/tahun-tersedia`);
  const tahunData = await tahunRes.json();
  const years = tahun ? [parseInt(tahun)] : (tahunData.tahun || []).slice(0, 5).reverse();
  const quarters = kuartal ? [kuartal] : ['Q4','Q3','Q2','Q1'];
  const rows = [];

  for (const y of years) {
    for (const q of quarters) {
      const r = await fetch(`${API_BASE}/api/kpi/keuangan?tahun=${y}&kuartal=${q}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (!d.ada_data) continue;
      rows.push({
        year:       y,
        quarter:    q,
        ocf:        (d.ocf?.nilai_raw || 0) / 1000,
        net_income: (d.net?.nilai_raw || 0) / 1000,
        fcf:        (d.fcf?.nilai_raw || 0) / 1000,
        revenue:    (d.revenue?.nilai_raw || 0) / 1000,
      });
      if (rows.length >= 40) break;
    }
    if (rows.length >= 40) break;
  }
  return rows;
}

/* ══════════════════════════════════════════════════════════
   ERROR STATE
   ══════════════════════════════════════════════════════════ */
function showChartError(iframeId, msg) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return;
  let errEl = document.getElementById(iframeId + '-error');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = iframeId + '-error';
    errEl.style.cssText = `
      display:flex; align-items:center; justify-content:center; flex-direction:column;
      height:200px; color:#94A3B8; font-size:13px; gap:8px;
    `;
    iframe.style.display = 'none';
    iframe.parentNode.insertBefore(errEl, iframe.nextSibling);
  }
  errEl.innerHTML = `
    <svg width="32" height="32" fill="none" stroke="#CBD5E1" stroke-width="1.5" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>${msg}</span>
  `;
}

/* ══════════════════════════════════════════════════════════
   MAIN: updateKeuanganCharts — dipanggil saat filter berubah
   ══════════════════════════════════════════════════════════ */
async function updateKeuanganCharts() {
  const tahun   = document.getElementById('keu-yearFilter')?.value || '';
  const kuartal = document.getElementById('keu-quarterFilter')?.value || '';

  // Render ketiga chart secara paralel
  await Promise.all([
    renderKeuChart1(tahun, kuartal),
    renderKeuChart2(tahun, kuartal),
    renderKeuChart3(tahun, kuartal),
  ]);
}

/* ══════════════════════════════════════════════════════════
   HOOK ke filter yang sudah ada di script.js
   ══════════════════════════════════════════════════════════ */
(function hookKeuanganCharts() {
  // Tunggu DOM siap
  document.addEventListener('DOMContentLoaded', () => {
    // Patch updateKeuangan agar juga update charts
    const origUpdateKeuangan = window.updateKeuangan;
    window.updateKeuangan = function() {
      if (typeof origUpdateKeuangan === 'function') origUpdateKeuangan();
      updateKeuanganCharts();
    };

    // Patch switchPage agar load chart saat buka halaman keuangan
    const origSwitch = window.switchPage;
    window.switchPage = function(page) {
      if (typeof origSwitch === 'function') origSwitch(page);
      if (page === 'keuangan') {
        setTimeout(updateKeuanganCharts, 100);
      }
    };
  });
})();
