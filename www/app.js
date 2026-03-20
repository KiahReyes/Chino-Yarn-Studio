// ═══════════════════════════════════════════════════
//  CHINO YARN STUDIO — app.js
//  Single-user, PIN-protected. Data lives in IndexedDB.
//  Syncs to MySQL on demand via ☁️ button.
// ═══════════════════════════════════════════════════

// ── CONFIG ────────────────────────────────────────
const SUPABASE_URL  = 'https://mqinnlxkmhpxuzmkjner.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaW5ubHhrbWhweHV6bWtqbmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDQyNDgsImV4cCI6MjA4ODUyMDI0OH0.bNAWp84lIIairXSaJ13xh3C0JC1y1MVyEoIdyRwDZHQ';

// ── DB SETUP ──────────────────────────────────────
const DB_NAME    = 'chinoYarnDB';
const DB_VERSION = 2;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('brands')) {
        db.createObjectStore('brands', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('yarns')) {
        const ys = db.createObjectStore('yarns', { keyPath: 'id', autoIncrement: true });
        ys.createIndex('brandId', 'brandId', { unique: false });
      }
      if (!db.objectStoreNames.contains('colourways')) {
        const cs = db.createObjectStore('colourways', { keyPath: 'id', autoIncrement: true });
        cs.createIndex('yarnId', 'yarnId', { unique: false });
      }
      if (!db.objectStoreNames.contains('inventory')) {
        const inv = db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
        inv.createIndex('colourwayId', 'colourwayId', { unique: false });
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('usage')) {
        const us = db.createObjectStore('usage', { keyPath: 'id', autoIncrement: true });
        us.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbGet(store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbAdd(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
function dbGetByIndex(store, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(store, 'readonly');
    const index = tx.objectStore(store).index(indexName);
    const req   = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── CLEAR AND RESTORE DB ──────────────────────────
async function clearDB() {
  const stores = ['brands','yarns','colourways','inventory','projects','usage'];
  for (const store of stores) {
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
}

async function restoreFromData(data) {
  await clearDB();
  for (const b of data.brands     || []) await dbPut('brands',     { id: parseInt(b.id), name: b.name, country: b.country || null });
  for (const y of data.yarns      || []) await dbPut('yarns',      { id: parseInt(y.id), brandId: parseInt(y.brandId), name: y.name, fiber: y.fiber || null, weight: y.weight !== null ? y.weight : null, metersPerSkein: y.metersPerSkein || null, gramsPerSkein: y.gramsPerSkein || null });
  for (const c of data.colourways || []) await dbPut('colourways', { id: parseInt(c.id), yarnId: parseInt(c.yarnId), colourName: c.colourName, lotNumber: c.lotNumber || null });
  for (const i of data.inventory  || []) await dbPut('inventory',  { id: parseInt(i.id), colourwayId: parseInt(i.colourwayId), qty: parseFloat(i.qty), locationBin: i.locationBin || null, purchasedDate: i.purchasedDate || null, costPerSkein: i.costPerSkein || null });
  for (const p of data.projects   || []) await dbPut('projects',   { id: parseInt(p.id), name: p.name, status: p.status, dateStarted: p.dateStarted || null, dateEnded: p.dateEnded || null, notes: p.notes || null });
  for (const u of data.usage      || []) await dbPut('usage',      { id: parseInt(u.id), projectId: parseInt(u.projectId), inventoryId: parseInt(u.inventoryId), skeinsUsed: u.skeinsUsed || null, metersUsed: u.metersUsed || null, gramsUsed: u.gramsUsed || null });
}

// ── SYNC ENGINE ───────────────────────────────────
const LAST_SYNC_KEY = 'chinoLastSync';
let isSyncing = false;

function getLastSync() { return localStorage.getItem(LAST_SYNC_KEY) || null; }
function setLastSync() { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); }

function formatLastSync() {
  const t = getLastSync();
  if (!t) return 'Never synced';
  const diff = Math.floor((Date.now() - new Date(t)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(t).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function updateSyncStatus() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (!navigator.onLine) {
    el.innerHTML = `<span class="sync-dot offline"></span>Offline`;
    return;
  }
  el.innerHTML = `<span class="sync-dot online"></span>${formatLastSync()}`;
}

function setSyncSpinner(on) {
  const btn    = document.getElementById('floatSyncBtn');
  const icon   = document.getElementById('floatSyncIcon');
  const status = document.getElementById('syncStatus');
  if (on) {
    if (btn)    btn.classList.add('syncing');
    if (icon)   icon.textContent = '🔄';
    if (status) status.innerHTML = `<span class="sync-spinner"></span>Syncing…`;
  } else {
    if (btn)  btn.classList.remove('syncing');
    if (icon) icon.textContent = '☁️';
    updateSyncStatus();
  }
}

// ── SUPABASE HELPERS ──────────────────────────────
const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function sbGet(table) {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    const { CapacitorHttp } = cap.Plugins;
    if (CapacitorHttp) {
      const res = await CapacitorHttp.get({
        url: `${SUPABASE_URL}/rest/v1/${table}?select=*`,
        headers: SB_HEADERS
      });
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    }
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: SB_HEADERS });
  return res.json();
}

async function sbDeleteAll(table) {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    const { CapacitorHttp } = cap.Plugins;
    if (CapacitorHttp) {
      await CapacitorHttp.request({
        method: 'DELETE',
        url: `${SUPABASE_URL}/rest/v1/${table}?id=gte.0`,
        headers: SB_HEADERS
      });
      return;
    }
  }
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gte.0`, { method: 'DELETE', headers: SB_HEADERS });
}

async function sbInsert(table, rows) {
  if (!rows.length) return;
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    const { CapacitorHttp } = cap.Plugins;
    if (CapacitorHttp) {
      await CapacitorHttp.post({
        url: `${SUPABASE_URL}/rest/v1/${table}`,
        headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
        data: rows
      });
      return;
    }
  }
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(rows)
  });
}

async function syncNow(silent = false) {
  if (isSyncing) return;
  if (!navigator.onLine) {
    if (!silent) showFlash('No internet connection.', 'error');
    return;
  }

  isSyncing = true;
  setSyncSpinner(true);

  try {
    // Check if local DB has any data
    const localBrands = await dbGetAll('brands');
    const isEmpty = localBrands.length === 0;

    if (!isEmpty) {
      // Push phone → Supabase (delete all then insert)
      // Order matters due to foreign keys: delete children first, insert parents first
      await sbDeleteAll('usage');
      await sbDeleteAll('inventory');
      await sbDeleteAll('colourways');
      await sbDeleteAll('projects');
      await sbDeleteAll('yarns');
      await sbDeleteAll('brands');

      await sbInsert('brands',     await dbGetAll('brands'));
      await sbInsert('yarns',      await dbGetAll('yarns'));
      await sbInsert('colourways', await dbGetAll('colourways'));
      await sbInsert('inventory',  await dbGetAll('inventory'));
      await sbInsert('projects',   await dbGetAll('projects'));
      await sbInsert('usage',      await dbGetAll('usage'));
    }

    // 2. Pull Supabase → phone
    const [brands, yarns, colourways, inventory, projects, usage] = await Promise.all([
      sbGet('brands'), sbGet('yarns'), sbGet('colourways'),
      sbGet('inventory'), sbGet('projects'), sbGet('usage')
    ]);

    await restoreFromData({ brands, yarns, colourways, inventory, projects, usage, success: true });
    setLastSync();
    updateSyncStatus();
    if (!silent) showFlash('Synced! ☁️', 'success');
    await renderApp();

  } catch (err) {
    if (!silent) showFlash('Sync failed: ' + err.message, 'error');
    console.error('Sync error:', err);
  } finally {
    isSyncing = false;
    setSyncSpinner(false);
  }
}

// ── PIN AUTH ──────────────────────────────────────
const PIN_KEY     = 'chinoYarnPIN';
const SESSION_KEY = 'chinoYarnAuth';

function hashPIN(pin) {
  let hash = 0;
  const str = pin + 'chino_yarn_salt_2024';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function isPINSet()   { return !!localStorage.getItem(PIN_KEY); }
function isUnlocked() { return sessionStorage.getItem(SESSION_KEY) === 'unlocked'; }
function lockApp()    { sessionStorage.removeItem(SESSION_KEY); showPINScreen('unlock'); }
function unlockApp()  { sessionStorage.setItem(SESSION_KEY, 'unlocked'); }
function verifyPIN(pin) { return hashPIN(pin) === localStorage.getItem(PIN_KEY); }
function savePIN(pin)   { localStorage.setItem(PIN_KEY, hashPIN(pin)); }

function showPINScreen(mode) {
  document.getElementById('mainNav').style.display   = 'none';
  document.getElementById('mainContent').innerHTML   = '';
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('floatSyncBtn').style.display = 'none';

  document.getElementById('pinTitle').textContent =
    mode === 'setup'  ? 'Set Your PIN' :
    mode === 'change' ? 'Change PIN'   : 'Welcome back, Kiah 🧶';

  document.getElementById('pinSubtitle').textContent =
    mode === 'setup'  ? 'Choose a 4-digit PIN to protect your stash' :
    mode === 'change' ? 'Enter your new 4-digit PIN' : 'Enter your PIN to continue';

  document.getElementById('pinStep').textContent = (mode === 'setup' || mode === 'change') ? 'New PIN' : '';

  document.getElementById('pinInput').value = '';
  updatePINDots('');

  document.getElementById('pinScreen').dataset.mode  = mode;
  document.getElementById('pinScreen').dataset.step  = 'first';
  document.getElementById('pinScreen').dataset.first = '';
  document.getElementById('pinInput').focus();
}

function updatePINDots(val) {
  document.querySelectorAll('.pin-dot').forEach((d, i) => {
    d.classList.toggle('filled', i < val.length);
  });
}

function onPINInput(input) {
  const val = input.value.replace(/\D/g, '').slice(0, 4);
  input.value = val;
  updatePINDots(val);
  if (val.length === 4) setTimeout(() => handlePINSubmit(val), 150);
}

function handlePINSubmit(pin) {
  const screen = document.getElementById('pinScreen');
  const mode   = screen.dataset.mode;
  const step   = screen.dataset.step;

  if (mode === 'unlock') {
    if (verifyPIN(pin)) {
      unlockApp();
      hidePINScreen();
      renderApp();
      syncNow(true);
    } else {
      shakePIN();
      document.getElementById('pinInput').value = '';
      updatePINDots('');
      showFlash('Wrong PIN. Try again.', 'error');
    }
    return;
  }

  if (step === 'first') {
    screen.dataset.first = pin;
    screen.dataset.step  = 'confirm';
    document.getElementById('pinStep').textContent = 'Confirm PIN';
    document.getElementById('pinInput').value = '';
    updatePINDots('');
  } else {
    if (pin === screen.dataset.first) {
      savePIN(pin);
      unlockApp();
      hidePINScreen();
      showFlash("PIN set! You're all set, Kiah 🧶", 'success');
      renderApp();
    } else {
      shakePIN();
      screen.dataset.step  = 'first';
      screen.dataset.first = '';
      document.getElementById('pinStep').textContent = 'New PIN';
      document.getElementById('pinInput').value = '';
      updatePINDots('');
      showFlash("PINs didn't match. Try again.", 'error');
    }
  }
}

function shakePIN() {
  const dots = document.getElementById('pinDots');
  dots.classList.add('shake');
  setTimeout(() => dots.classList.remove('shake'), 500);
}

function hidePINScreen() {
  document.getElementById('pinScreen').style.display = 'none';
  document.getElementById('floatSyncBtn').style.display = 'flex';
}

// ── APP STATE ─────────────────────────────────────
let activeTab = 'dashboard';

const WEIGHT_LABELS = {
  0:'Lace', 1:'Fingering', 2:'Sport', 3:'DK',
  4:'Worsted', 5:'Bulky', 6:'Super Bulky', 7:'Roving'
};
const STATUS_COLORS = {
  'Planned':'#6366f1', 'In Progress':'#10b981',
  'On Hold':'#f59e0b', 'Finished':'#3b82f6', 'Frogged':'#ef4444'
};

// ── BOOT ──────────────────────────────────────────
async function boot() {
  await openDB();
  if (!isPINSet())   { showPINScreen('setup');  return; }
  if (!isUnlocked()) { showPINScreen('unlock'); return; }
  hidePINScreen();
  await renderApp();
  updateSyncStatus();
  syncNow(true);
  setInterval(updateSyncStatus, 60000);
  window.addEventListener('online',  () => { updateSyncStatus(); syncNow(true); });
  window.addEventListener('offline', () => updateSyncStatus());
}

// ── MAIN RENDER ───────────────────────────────────
async function renderApp() {
  renderNav();
  if      (activeTab === 'dashboard') await renderDashboard();
  else if (activeTab === 'inventory') await renderInventory();
  else if (activeTab === 'projects')  await renderProjects();
  else if (activeTab === 'manage')    await renderManage();
}

function renderNav() {
  document.getElementById('mainNav').style.display = 'flex';
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === activeTab);
  });
}

// ── DASHBOARD TAB ─────────────────────────────────
async function renderDashboard() {
  const allInventory  = await dbGetAll('inventory');
  const allColourways = await dbGetAll('colourways');
  const allYarns      = await dbGetAll('yarns');
  const allBrands     = await dbGetAll('brands');
  const allProjects   = await dbGetAll('projects');
  const allUsage      = await dbGetAll('usage');

  // Stash stats
  const totalSkeins = allInventory.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
  const totalMeters = allInventory.reduce((s, i) => {
    const cw   = allColourways.find(c => c.id === i.colourwayId) || {};
    const yarn = allYarns.find(y => y.id === cw.yarnId) || {};
    return s + ((parseFloat(i.qty) || 0) * (parseFloat(yarn.metersPerSkein) || 0));
  }, 0);
  const totalGrams = allInventory.reduce((s, i) => {
    const cw   = allColourways.find(c => c.id === i.colourwayId) || {};
    const yarn = allYarns.find(y => y.id === cw.yarnId) || {};
    return s + ((parseFloat(i.qty) || 0) * (parseFloat(yarn.gramsPerSkein) || 0));
  }, 0);
  const totalValue = allInventory.reduce((s, i) => s + ((parseFloat(i.qty) || 0) * (parseFloat(i.costPerSkein) || 0)), 0);

  // Most stocked yarn
  const skeinsByYarn = {};
  allInventory.forEach(i => {
    const cw    = allColourways.find(c => c.id === i.colourwayId) || {};
    const yarn  = allYarns.find(y => y.id === cw.yarnId) || {};
    const brand = allBrands.find(b => b.id === yarn.brandId) || {};
    if (!yarn.id) return;
    if (!skeinsByYarn[yarn.id]) skeinsByYarn[yarn.id] = { name: yarn.name, brand: brand.name || '—', qty: 0 };
    skeinsByYarn[yarn.id].qty += parseFloat(i.qty) || 0;
  });
  const mostStocked = Object.values(skeinsByYarn).sort((a, b) => b.qty - a.qty)[0] || null;

  // Recently added (last 3 by id)
  const recentInv = [...allInventory].sort((a, b) => b.id - a.id).slice(0, 3).map(i => {
    const cw    = allColourways.find(c => c.id === i.colourwayId) || {};
    const yarn  = allYarns.find(y => y.id === cw.yarnId) || {};
    const brand = allBrands.find(b => b.id === yarn.brandId) || {};
    return { ...i, cw, yarn, brand };
  });

  // Project stats
  const totalMetersUsed  = allUsage.reduce((s, u) => s + (parseFloat(u.metersUsed) || 0), 0);
  const totalSkeinsUsed  = allUsage.reduce((s, u) => s + (parseFloat(u.skeinsUsed) || 0), 0);

  // Most used yarn
  const skeinsByYarnUsed = {};
  allUsage.forEach(u => {
    const inv   = allInventory.find(i => i.id === u.inventoryId) || {};
    const cw    = allColourways.find(c => c.id === inv.colourwayId) || {};
    const yarn  = allYarns.find(y => y.id === cw.yarnId) || {};
    const brand = allBrands.find(b => b.id === yarn.brandId) || {};
    if (!yarn.id) return;
    if (!skeinsByYarnUsed[yarn.id]) skeinsByYarnUsed[yarn.id] = { name: yarn.name, brand: brand.name || '—', skeins: 0 };
    skeinsByYarnUsed[yarn.id].skeins += parseFloat(u.skeinsUsed) || 0;
  });
  const mostUsed = Object.values(skeinsByYarnUsed).sort((a, b) => b.skeins - a.skeins)[0] || null;

  // Spent per project
  const projectSpend = allProjects.map(p => {
    const spent = allUsage.filter(u => u.projectId === p.id).reduce((s, u) => {
      const inv = allInventory.find(i => i.id === u.inventoryId) || {};
      return s + ((parseFloat(u.skeinsUsed) || 0) * (parseFloat(inv.costPerSkein) || 0));
    }, 0);
    return { ...p, spent };
  }).filter(p => p.spent > 0).sort((a, b) => b.spent - a.spent);

  // Stash vs usage ratio
  const totalEver  = totalSkeins + totalSkeinsUsed;
  const usageRatio = totalEver > 0 ? Math.round((totalSkeinsUsed / totalEver) * 100) : 0;

  document.getElementById('mainContent').innerHTML = `
    <div style="padding-bottom:80px">

      <div class="dashboard-section-title">🧶 Your Stash</div>
      <div class="dashboard-grid">
        <div class="dashboard-card">
          <div class="dashboard-card-icon">🧶</div>
          <div class="dashboard-card-val">${parseFloat(totalSkeins).toFixed(1)}</div>
          <div class="dashboard-card-label">Total Skeins</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">📏</div>
          <div class="dashboard-card-val">${totalMeters >= 1000 ? (totalMeters/1000).toFixed(1)+'km' : Math.round(totalMeters)+'m'}</div>
          <div class="dashboard-card-label">Total Meters</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">⚖️</div>
          <div class="dashboard-card-val">${totalGrams >= 1000 ? (totalGrams/1000).toFixed(1)+'kg' : Math.round(totalGrams)+'g'}</div>
          <div class="dashboard-card-label">Total Grams</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">💰</div>
          <div class="dashboard-card-val">₱${totalValue.toLocaleString('en-PH', {minimumFractionDigits:0,maximumFractionDigits:0})}</div>
          <div class="dashboard-card-label">Stash Value</div>
        </div>
      </div>

      ${mostStocked ? `
      <div class="dashboard-highlight">
        <div class="dashboard-highlight-label">🏆 Most Stocked</div>
        <div class="dashboard-highlight-val">${esc(mostStocked.brand)} — ${esc(mostStocked.name)}</div>
        <div class="dashboard-highlight-sub">${parseFloat(mostStocked.qty).toFixed(1)} skeins in stash</div>
      </div>` : ''}

      ${recentInv.length ? `
      <div class="dashboard-list-card">
        <div class="dashboard-list-title">🕐 Recently Added</div>
        ${recentInv.map(i => `
          <div class="dashboard-list-row">
            <div>
              <div style="font-weight:600;font-size:.88rem">${esc(i.brand.name||'—')} — ${esc(i.yarn.name||'—')}</div>
              <div style="font-size:.78rem;color:var(--muted)">${esc(i.cw.colourName||'—')}</div>
            </div>
            <div style="font-weight:700;color:var(--clay)">${parseFloat(i.qty).toFixed(1)} skeins</div>
          </div>`).join('')}
      </div>` : ''}

      <div class="dashboard-section-title" style="margin-top:28px">🪡 Your Projects</div>
      <div class="dashboard-grid">
        <div class="dashboard-card">
          <div class="dashboard-card-icon">🪡</div>
          <div class="dashboard-card-val">${allProjects.length}</div>
          <div class="dashboard-card-label">Total Projects</div>
        </div>
        <div class="dashboard-card">
          <div class="dashboard-card-icon">📐</div>
          <div class="dashboard-card-val">${totalMetersUsed >= 1000 ? (totalMetersUsed/1000).toFixed(1)+'km' : Math.round(totalMetersUsed)+'m'}</div>
          <div class="dashboard-card-label">Meters Used</div>
        </div>
      </div>

      ${mostUsed ? `
      <div class="dashboard-highlight">
        <div class="dashboard-highlight-label">⭐ Most Used Yarn</div>
        <div class="dashboard-highlight-val">${esc(mostUsed.brand)} — ${esc(mostUsed.name)}</div>
        <div class="dashboard-highlight-sub">${parseFloat(mostUsed.skeins).toFixed(1)} skeins used across all projects</div>
      </div>` : ''}


      <div class="dashboard-section-title" style="margin-top:28px">📊 Yarn Used vs Remaining</div>
      <div class="dashboard-list-card">
        <div class="usage-bar-track">
          <div class="usage-bar-used"  style="width:${usageRatio}%"></div>
          <div class="usage-bar-stock" style="width:${100 - usageRatio}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:.8rem;font-weight:600">
          <span style="display:flex;align-items:center;gap:5px">
            <span style="width:10px;height:10px;border-radius:2px;background:#c47c5a;display:inline-block"></span>
            <span style="color:#c47c5a">Used — ${parseFloat(totalSkeinsUsed).toFixed(1)} skeins</span>
          </span>
          <span style="display:flex;align-items:center;gap:5px">
            <span style="color:#6a9e6a">Stock — ${parseFloat(totalSkeins).toFixed(1)} skeins</span>
            <span style="width:10px;height:10px;border-radius:2px;background:#6a9e6a;display:inline-block"></span>
          </span>
        </div>
        ${totalEver > 0 ? `<div style="text-align:center;margin-top:8px;font-size:.78rem;color:var(--muted)">${usageRatio}% of all yarn you've ever had has been used</div>` : ''}
      </div>

    </div>`;
}

// ── INVENTORY TAB ─────────────────────────────────
async function renderInventory() {
  const allInventory  = await dbGetAll('inventory');
  const allColourways = await dbGetAll('colourways');
  const allYarns      = await dbGetAll('yarns');
  const allBrands     = await dbGetAll('brands');

  const enriched = allInventory.map(inv => {
    const cw    = allColourways.find(c => c.id === inv.colourwayId) || {};
    const yarn  = allYarns.find(y => y.id === cw.yarnId) || {};
    const brand = allBrands.find(b => b.id === yarn.brandId) || {};
    return { ...inv, cw, yarn, brand };
  });

  const grouped = {};
  enriched.forEach(inv => {
    const key = inv.yarn.id || 'unknown';
    if (!grouped[key]) grouped[key] = { yarn: inv.yarn, brand: inv.brand, rows: [] };
    grouped[key].rows.push(inv);
  });

  document.getElementById('mainContent').innerHTML = `
    <div class="card">
      <div class="section-title">
        <div class="section-title-left">📦 My Yarn Stash</div>
        <button class="btn-icon btn-add" onclick="openAddInventoryOverlay()">＋</button>
      </div>
      ${Object.keys(grouped).length === 0
        ? `<div class="empty-state"><div class="empty-icon">📦</div><p>No yarn in your stash yet. Hit ＋ to add some!</p></div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>Brand</th><th>Yarn Name</th><th>Weight</th><th>Colours</th><th>Skeins</th><th>m/skein</th><th>g/skein</th></tr></thead>
            <tbody>
            ${Object.values(grouped).map(g => {
              const totalQ  = g.rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
              const colours = [...new Set(g.rows.map(r => r.cw.id))].length;
              const wl      = g.yarn.weight !== undefined && g.yarn.weight !== ''
                ? (WEIGHT_LABELS[parseInt(g.yarn.weight)] || '—') : '—';
              return `<tr class="inv-row" onclick="openInvDetail(${g.yarn.id})">
                <td>${esc(g.brand.name || '—')}</td>
                <td><strong>${esc(g.yarn.name || '—')}</strong></td>
                <td><span class="weight-badge">${wl}</span></td>
                <td>${colours} colour${colours !== 1 ? 's' : ''}</td>
                <td><strong>${totalQ % 1 === 0 ? totalQ : totalQ.toFixed(1)}</strong></td>
                <td>${g.yarn.metersPerSkein || '—'}</td>
                <td>${g.yarn.gramsPerSkein  || '—'}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table></div>
          <p style="font-size:.78rem;color:var(--muted);margin-top:10px">👆 Click any row to see colour breakdown</p>`
      }
    </div>`;
}

async function openInvDetail(yarnId) {
  const allInventory  = await dbGetAll('inventory');
  const allColourways = await dbGetAll('colourways');
  const allYarns      = await dbGetAll('yarns');
  const allBrands     = await dbGetAll('brands');

  const yarn  = await dbGet('yarns', yarnId);
  const brand = allBrands.find(b => b.id === yarn.brandId) || {};

  const rows = allInventory
    .map(inv => {
      const cw = allColourways.find(c => c.id === inv.colourwayId) || {};
      const y  = allYarns.find(y => y.id === cw.yarnId) || {};
      return { ...inv, cw, yarn: y };
    })
    .filter(inv => inv.yarn.id === yarnId);

  const totalSkeins = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const colourCount = [...new Set(rows.map(r => r.colourwayId))].length;

  document.getElementById('invDetailTitle').textContent = `📦 ${brand.name} — ${yarn.name}`;
  document.getElementById('invDetailContent').innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div class="stat-mini"><div class="stat-mini-label">Total Skeins</div><div class="stat-mini-val">${totalSkeins}</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Colours</div><div class="stat-mini-val">${colourCount}</div></div>
      ${yarn.metersPerSkein ? `<div class="stat-mini"><div class="stat-mini-label">m/Skein</div><div class="stat-mini-val">${yarn.metersPerSkein}m</div></div>` : ''}
      ${yarn.gramsPerSkein  ? `<div class="stat-mini"><div class="stat-mini-label">g/Skein</div><div class="stat-mini-val">${yarn.gramsPerSkein}g</div></div>`  : ''}
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Colour</th><th>Lot #</th><th>Skeins</th><th>Bin</th><th>Purchased</th><th>₱/Skein</th><th>Actions</th></tr></thead>
      <tbody>
      ${rows.map(r => `
        <tr style="border-bottom:1px solid var(--warm)">
          <td><strong>${esc(r.cw.colourName || '—')}</strong></td>
          <td style="color:var(--muted)">${esc(r.cw.lotNumber || '—')}</td>
          <td><div class="skein-counter">
            <button class="skein-btn" onclick="adjustSkeins(${r.id}, -1, this)">−</button>
            <span class="qty" id="skein-qty-${r.id}">${parseFloat(r.qty)}</span>
            <button class="skein-btn" onclick="adjustSkeins(${r.id}, 1, this)">+</button>
          </div></td>
          <td>${esc(r.locationBin || '—')}</td>
          <td>${r.purchasedDate || '—'}</td>
          <td>${r.costPerSkein ? '₱' + parseFloat(r.costPerSkein).toFixed(2) : '—'}</td>
          <td><div style="display:flex;gap:5px">
            <button class="btn-edit"   onclick="openEditInvOverlay(${r.id})">✏️</button>
            <button class="btn-delete" onclick="deleteInventory(${r.id})">🗑️</button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  openOverlay('invDetailOverlay');
}

async function adjustSkeins(invId, delta, btn) {
  const inv    = await dbGet('inventory', invId);
  const newQty = Math.max(0, (parseFloat(inv.qty) || 0) + delta);
  btn.disabled = true;
  await dbPut('inventory', { ...inv, qty: newQty });
  document.getElementById('skein-qty-' + invId).textContent = newQty;
  btn.disabled = false;
}

async function deleteInventory(invId) {
  if (!confirm('Delete this entry?')) return;
  await dbDelete('inventory', invId);
  closeOverlay('invDetailOverlay');
  await renderInventory();
  showFlash('Entry deleted.', 'success');
}

async function openAddInventoryOverlay() {
  const colourways = await dbGetAll('colourways');
  const yarns      = await dbGetAll('yarns');
  const brands     = await dbGetAll('brands');
  document.getElementById('addInvColourway').innerHTML =
    `<option value="">— Select —</option>` +
    colourways.map(cw => {
      const yarn  = yarns.find(y => y.id === cw.yarnId) || {};
      const brand = brands.find(b => b.id === yarn.brandId) || {};
      return `<option value="${cw.id}">${esc(brand.name)} – ${esc(yarn.name)} – ${esc(cw.colourName)}</option>`;
    }).join('');
  openOverlay('addInventoryOverlay');
}

async function submitAddInventory() {
  const colourwayId = parseInt(document.getElementById('addInvColourway').value);
  const qty         = document.getElementById('addInvQty').value;
  if (!colourwayId || !qty) { showFlash('Please fill in required fields.', 'error'); return; }
  await dbAdd('inventory', {
    colourwayId, qty: parseFloat(qty),
    locationBin:   document.getElementById('addInvBin').value  || null,
    purchasedDate: document.getElementById('addInvDate').value || null,
    costPerSkein:  document.getElementById('addInvCost').value ? parseFloat(document.getElementById('addInvCost').value) : null
  });
  closeOverlay('addInventoryOverlay');
  ['addInvColourway','addInvQty','addInvBin','addInvDate','addInvCost'].forEach(id => document.getElementById(id).value = '');
  await renderInventory();
  showFlash('Added to stash!', 'success');
}

async function openEditInvOverlay(invId) {
  const inv        = await dbGet('inventory', invId);
  const colourways = await dbGetAll('colourways');
  const yarns      = await dbGetAll('yarns');
  const brands     = await dbGetAll('brands');
  document.getElementById('editInvId').value = invId;
  document.getElementById('editInvColourway').innerHTML =
    `<option value="">— Select —</option>` +
    colourways.map(cw => {
      const yarn  = yarns.find(y => y.id === cw.yarnId) || {};
      const brand = brands.find(b => b.id === yarn.brandId) || {};
      return `<option value="${cw.id}" ${cw.id === inv.colourwayId ? 'selected' : ''}>${esc(brand.name)} – ${esc(yarn.name)} – ${esc(cw.colourName)}</option>`;
    }).join('');
  document.getElementById('editInvQty').value  = inv.qty;
  document.getElementById('editInvBin').value  = inv.locationBin   || '';
  document.getElementById('editInvDate').value = inv.purchasedDate || '';
  document.getElementById('editInvCost').value = inv.costPerSkein  || '';
  closeOverlay('invDetailOverlay');
  openOverlay('editInventoryOverlay');
}

async function submitEditInventory() {
  const invId       = parseInt(document.getElementById('editInvId').value);
  const inv         = await dbGet('inventory', invId);
  const colourwayId = parseInt(document.getElementById('editInvColourway').value);
  const qty         = document.getElementById('editInvQty').value;
  if (!colourwayId || !qty) { showFlash('Please fill in required fields.', 'error'); return; }
  await dbPut('inventory', {
    ...inv, colourwayId, qty: parseFloat(qty),
    locationBin:   document.getElementById('editInvBin').value  || null,
    purchasedDate: document.getElementById('editInvDate').value || null,
    costPerSkein:  document.getElementById('editInvCost').value ? parseFloat(document.getElementById('editInvCost').value) : null
  });
  closeOverlay('editInventoryOverlay');
  await renderInventory();
  showFlash('Stash entry updated!', 'success');
}

// ── PROJECTS TAB ──────────────────────────────────
async function renderProjects() {
  const projects  = await dbGetAll('projects');
  const allUsage  = await dbGetAll('usage');
  const allInv    = await dbGetAll('inventory');
  const allCW     = await dbGetAll('colourways');
  const allYarns  = await dbGetAll('yarns');
  const allBrands = await dbGetAll('brands');

  const groups = {
    planned:  { label:'Planned',  icon:'📋', statuses:['Planned'] },
    ongoing:  { label:'Ongoing',  icon:'⚡', statuses:['In Progress','On Hold','Frogged'] },
    finished: { label:'Finished', icon:'✅', statuses:['Finished'] }
  };

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--deep)">🪡 My Projects</h2>
      <button class="btn-icon btn-add" onclick="openOverlay('addProjectOverlay')">＋</button>
    </div>`;

  let anyProject = false;
  for (const [, group] of Object.entries(groups)) {
    const gProjects = projects.filter(p => group.statuses.includes(p.status));
    if (!gProjects.length) continue;
    anyProject = true;
    html += `<div class="project-group"><div class="project-group-title">${group.icon} ${group.label} (${gProjects.length})</div>`;
    for (const p of gProjects) {
      const pusages = allUsage.filter(u => u.projectId === p.id).map(u => {
        const inv   = allInv.find(i => i.id === u.inventoryId) || {};
        const cw    = allCW.find(c => c.id === inv.colourwayId) || {};
        const yarn  = allYarns.find(y => y.id === cw.yarnId) || {};
        const brand = allBrands.find(b => b.id === yarn.brandId) || {};
        return { ...u, inv, cw, yarn, brand };
      });
      const totalSkeins = pusages.reduce((s, u) => s + (parseFloat(u.skeinsUsed) || 0), 0);
      const totalMeters = pusages.reduce((s, u) => s + (parseFloat(u.metersUsed) || 0), 0);
      const totalGrams  = pusages.reduce((s, u) => s + (parseFloat(u.gramsUsed)  || 0), 0);
      const totalSpent  = pusages.reduce((s, u) => s + ((parseFloat(u.skeinsUsed) || 0) * (parseFloat(u.inv.costPerSkein) || 0)), 0);
      const sc = STATUS_COLORS[p.status] || '#888';
      html += `
      <div class="project-card">
        <div class="project-card-header" onclick="toggleProject(${p.id})">
          <div style="width:10px;height:10px;border-radius:50%;background:${sc};flex-shrink:0"></div>
          <div class="project-info">
            <div class="project-name">${esc(p.name)}</div>
            <div class="project-meta">
              <span class="badge" style="background:${sc};font-size:.65rem">${esc(p.status)}</span>
              ${p.dateStarted ? ` · Started ${formatDate(p.dateStarted)}` : ''}
              ${p.dateEnded   ? ` · Ended ${formatDate(p.dateEnded)}`     : ''}
              ${pusages.length ? ` · ${pusages.length} yarn${pusages.length !== 1 ? 's' : ''} used` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn-edit"   onclick="event.stopPropagation();openEditProjectOverlay(${p.id})">✏️</button>
            <button class="btn-delete" onclick="event.stopPropagation();deleteProject(${p.id})">🗑️</button>
            <span style="color:var(--muted);font-size:.8rem" id="proj-arrow-${p.id}">▶</span>
          </div>
        </div>
        <div class="project-card-body" id="proj-body-${p.id}">
          ${p.notes ? `<p style="font-size:.85rem;color:var(--muted);margin-bottom:14px;font-style:italic">${esc(p.notes)}</p>` : ''}
          ${pusages.length ? `
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
              <div class="stat-mini"><div class="stat-mini-label">Skeins Used</div><div class="stat-mini-val">${parseFloat(totalSkeins).toFixed(1)}</div></div>
              <div class="stat-mini"><div class="stat-mini-label">Meters Used</div><div class="stat-mini-val">${totalMeters.toFixed(1)}m</div></div>
              <div class="stat-mini"><div class="stat-mini-label">Grams Used</div><div class="stat-mini-val">${totalGrams.toFixed(1)}g</div></div>
              ${totalSpent > 0 ? `<div class="stat-mini"><div class="stat-mini-label">Total Spent</div><div class="stat-mini-val">₱${totalSpent.toLocaleString('en-PH',{minimumFractionDigits:0,maximumFractionDigits:0})}</div></div>` : ""}
            </div>
            <div class="table-wrap"><table>
              <thead><tr><th>Brand</th><th>Yarn</th><th>Colour</th><th>Skeins</th><th>Meters</th><th>Grams</th><th>Actions</th></tr></thead>
              <tbody>${pusages.map(u => `
                <tr>
                  <td>${esc(u.brand.name || '—')}</td><td>${esc(u.yarn.name || '—')}</td>
                  <td>${esc(u.cw.colourName || '—')}</td><td>${u.skeinsUsed != null ? parseFloat(u.skeinsUsed).toFixed(1) : '—'}</td>
                  <td>${u.metersUsed ? parseFloat(u.metersUsed).toFixed(1)+'m' : '—'}</td>
                  <td>${u.gramsUsed  ? parseFloat(u.gramsUsed).toFixed(1)+'g'  : '—'}</td>
                  <td><div class="action-btns">
                    <button class="btn-edit"   onclick="openEditUsageOverlay(${u.id})">✏️</button>
                    <button class="btn-delete" onclick="deleteUsage(${u.id})">🗑️</button>
                  </div></td>
                </tr>`).join('')}
              </tbody>
            </table></div>` : `<p style="color:var(--muted);font-size:.85rem">No yarn logged yet.</p>`}
          <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="openLogUsageOverlay(${p.id})">➕ Log Yarn Usage</button>
        </div>
      </div>`;
    }
    html += '</div>';
  }
  if (!anyProject) html += `<div class="empty-state"><div class="empty-icon">🪡</div><p>No projects yet. Hit ＋ to start one!</p></div>`;
  document.getElementById('mainContent').innerHTML = html;
}

function toggleProject(id) {
  const body  = document.getElementById('proj-body-'  + id);
  const arrow = document.getElementById('proj-arrow-' + id);
  const open  = body.classList.toggle('open');
  arrow.textContent = open ? '▼' : '▶';
}

async function submitAddProject() {
  const name = document.getElementById('addProjName').value.trim();
  if (!name) { showFlash('Please enter a project name.', 'error'); return; }
  await dbAdd('projects', {
    name, status: document.getElementById('addProjStatus').value,
    dateStarted: document.getElementById('addProjStart').value || null,
    dateEnded:   document.getElementById('addProjEnd').value   || null,
    notes:       document.getElementById('addProjNotes').value.trim()
  });
  closeOverlay('addProjectOverlay');
  ['addProjName','addProjNotes'].forEach(id => document.getElementById(id).value = '');
  await renderProjects();
  showFlash(`Project "${name}" created!`, 'success');
}

async function openEditProjectOverlay(projId) {
  const p = await dbGet('projects', projId);
  document.getElementById('editProjId').value     = projId;
  document.getElementById('editProjName').value   = p.name;
  document.getElementById('editProjStatus').value = p.status;
  document.getElementById('editProjStart').value  = p.dateStarted || '';
  document.getElementById('editProjEnd').value    = p.dateEnded   || '';
  document.getElementById('editProjNotes').value  = p.notes       || '';
  openOverlay('editProjectOverlay');
}

async function submitEditProject() {
  const projId = parseInt(document.getElementById('editProjId').value);
  const p      = await dbGet('projects', projId);
  await dbPut('projects', {
    ...p,
    name:        document.getElementById('editProjName').value.trim(),
    status:      document.getElementById('editProjStatus').value,
    dateStarted: document.getElementById('editProjStart').value || null,
    dateEnded:   document.getElementById('editProjEnd').value   || null,
    notes:       document.getElementById('editProjNotes').value.trim()
  });
  closeOverlay('editProjectOverlay');
  await renderProjects();
  showFlash('Project updated!', 'success');
}

async function deleteProject(projId) {
  const p = await dbGet('projects', projId);
  if (!confirm(`Delete "${p.name}"?`)) return;
  const usages = await dbGetByIndex('usage', 'projectId', projId);
  for (const u of usages) await dbDelete('usage', u.id);
  await dbDelete('projects', projId);
  await renderProjects();
  showFlash('Project deleted.', 'success');
}

async function openLogUsageOverlay(projId) {
  document.getElementById('logUsageProjId').value = projId;
  await populateInventorySelect('logUsageInvSelect');
  ['logUsageSkeins','logUsageMeters','logUsageGrams'].forEach(id => document.getElementById(id).value = '');
  openOverlay('logUsageOverlay');
}

async function openEditUsageOverlay(usageId) {
  const u = await dbGet('usage', usageId);
  document.getElementById('editUsageId').value = usageId;
  await populateInventorySelect('editUsageInvSelect', u.inventoryId);
  document.getElementById('editUsageSkeins').value = u.skeinsUsed || '';
  document.getElementById('editUsageMeters').value = u.metersUsed || '';
  document.getElementById('editUsageGrams').value  = u.gramsUsed  || '';
  openOverlay('editUsageOverlay');
}

async function populateInventorySelect(selectId, selectedId = null) {
  const allInv    = await dbGetAll('inventory');
  const allCW     = await dbGetAll('colourways');
  const allYarns  = await dbGetAll('yarns');
  const allBrands = await dbGetAll('brands');
  document.getElementById(selectId).innerHTML =
    `<option value="">— Select —</option>` +
    allInv.map(inv => {
      const cw    = allCW.find(c => c.id === inv.colourwayId) || {};
      const yarn  = allYarns.find(y => y.id === cw.yarnId) || {};
      const brand = allBrands.find(b => b.id === yarn.brandId) || {};
      return `<option value="${inv.id}" data-meters="${yarn.metersPerSkein||''}" data-grams="${yarn.gramsPerSkein||''}" ${inv.id === selectedId ? 'selected' : ''}>
        ${esc(brand.name)} – ${esc(yarn.name)} – ${esc(cw.colourName)} (${parseFloat(inv.qty).toFixed(1)} skeins)</option>`;
    }).join('');
}

function calcUsage(prefix) {
  const sel    = document.getElementById(prefix + 'InvSelect');
  const skeins = parseFloat(document.getElementById(prefix + 'Skeins').value) || 0;
  const opt    = sel.options[sel.selectedIndex];
  const mps    = parseFloat(opt?.dataset?.meters) || 0;
  const gps    = parseFloat(opt?.dataset?.grams)  || 0;
  document.getElementById(prefix + 'Meters').value = (skeins > 0 && mps > 0) ? (skeins * mps).toFixed(2) : '';
  document.getElementById(prefix + 'Grams').value  = (skeins > 0 && gps > 0) ? (skeins * gps).toFixed(2) : '';
}

async function submitLogUsage() {
  const projId      = parseInt(document.getElementById('logUsageProjId').value);
  const inventoryId = parseInt(document.getElementById('logUsageInvSelect').value);
  if (!inventoryId) { showFlash('Please select a yarn.', 'error'); return; }
  await dbAdd('usage', {
    projectId: projId, inventoryId,
    skeinsUsed: parseFloat(document.getElementById('logUsageSkeins').value) || null,
    metersUsed: parseFloat(document.getElementById('logUsageMeters').value) || null,
    gramsUsed:  parseFloat(document.getElementById('logUsageGrams').value)  || null
  });
  closeOverlay('logUsageOverlay');
  await renderProjects();
  showFlash('Yarn usage logged!', 'success');
}

async function submitEditUsage() {
  const usageId     = parseInt(document.getElementById('editUsageId').value);
  const u           = await dbGet('usage', usageId);
  const inventoryId = parseInt(document.getElementById('editUsageInvSelect').value);
  await dbPut('usage', {
    ...u, inventoryId,
    skeinsUsed: parseFloat(document.getElementById('editUsageSkeins').value) || null,
    metersUsed: parseFloat(document.getElementById('editUsageMeters').value) || null,
    gramsUsed:  parseFloat(document.getElementById('editUsageGrams').value)  || null
  });
  closeOverlay('editUsageOverlay');
  await renderProjects();
  showFlash('Usage updated!', 'success');
}

async function deleteUsage(usageId) {
  if (!confirm('Remove this yarn from the project?')) return;
  await dbDelete('usage', usageId);
  await renderProjects();
  showFlash('Entry removed.', 'success');
}

// ── MANAGE TAB ────────────────────────────────────
async function renderManage() {
  const brands     = await dbGetAll('brands');
  const yarns      = await dbGetAll('yarns');
  const colourways = await dbGetAll('colourways');

  const yarnsByBrand = {};
  yarns.forEach(y => {
    const brand = brands.find(b => b.id === y.brandId) || { name: 'Unknown' };
    if (!yarnsByBrand[brand.name]) yarnsByBrand[brand.name] = [];
    yarnsByBrand[brand.name].push({ ...y, brandName: brand.name });
  });

  document.getElementById('mainContent').innerHTML = `
    <div class="card">
      <div class="section-title"><div class="section-title-left">➕ Add Yarn to Database</div></div>
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:16px">Fill in what you know. Brand and yarn name will be reused if they already exist.</p>
      <datalist id="dl-brands">${brands.map(b => `<option value="${esc(b.name)}">`).join('')}</datalist>
      <datalist id="dl-yarns">${yarns.map(y => `<option value="${esc(y.name)}">`).join('')}</datalist>
      <datalist id="dl-colours">${colourways.map(c => `<option value="${esc(c.colourName)}">`).join('')}</datalist>
      <div class="yarn-entry-form">
        <div class="form-section-label">Brand</div>
        <div class="form-grid">
          <div class="form-group"><label>Brand Name *</label><input type="text" id="addBrandName" required list="dl-brands" placeholder="e.g. DUWEN" autocomplete="off"></div>
          <div class="form-group"><label>Country</label><input type="text" id="addBrandCountry" placeholder="e.g. China"></div>
        </div>
        <div class="form-section-label">Yarn Description</div>
        <div class="form-grid">
          <div class="form-group"><label>Yarn Name *</label><input type="text" id="addYarnName" required list="dl-yarns" placeholder="e.g. Matte Mini Chenille" autocomplete="off"></div>
          <div class="form-group"><label>Fiber Content</label><input type="text" id="addYarnFiber" placeholder="e.g. 100% Polyester"></div>
          <div class="form-group">
            <label>Weight</label>
            <select id="addYarnWeight">
              <option value="">— Select —</option>
              ${Object.entries(WEIGHT_LABELS).map(([k,v]) => `<option value="${k}">${k} – ${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Meters / Skein</label><input type="number" step="0.01" id="addYarnMeters" placeholder="e.g. 135"></div>
          <div class="form-group"><label>Grams / Skein</label><input type="number" step="0.01" id="addYarnGrams" placeholder="e.g. 50"></div>
        </div>
        <div class="form-section-label">Colourway</div>
        <div class="form-grid">
          <div class="form-group"><label>Colour Name *</label><input type="text" id="addColourName" required list="dl-colours" placeholder="e.g. Violet" autocomplete="off"></div>
          <div class="form-group"><label>Lot Number</label><input type="text" id="addLotNumber" placeholder="e.g. 15"></div>
        </div>
        <button class="btn btn-primary" onclick="submitAddYarnEntry()">💾 Save Yarn Entry</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><div class="section-title-left">🧶 Yarn Database</div></div>
      ${Object.keys(yarnsByBrand).length === 0
        ? `<div class="empty-state"><div class="empty-icon">🧶</div><p>No yarns added yet.</p></div>`
        : Object.entries(yarnsByBrand).map(([brandName, bYarns]) => `
          <div style="margin-bottom:20px">
            <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--clay);margin-bottom:8px">
              🏷️ ${esc(brandName)} <span style="font-weight:400;color:var(--muted)">(${bYarns.length} yarn${bYarns.length!==1?'s':''})</span>
            </div>
            <div class="table-wrap"><table>
              <thead><tr><th>Yarn Name</th><th>Weight</th><th>Fiber</th><th>m/skein</th><th>g/skein</th><th>Colours</th><th>Actions</th></tr></thead>
              <tbody>
              ${bYarns.map(y => {
                const yarnColours = colourways.filter(c => c.yarnId === y.id);
                const wl = y.weight !== undefined && y.weight !== '' ? (WEIGHT_LABELS[parseInt(y.weight)] || '—') : '—';
                return `
                <tr class="yarn-data-row" onclick="toggleYarnColours(${y.id})">
                  <td><strong>${esc(y.name)}</strong></td>
                  <td><span class="weight-badge">${wl}</span></td>
                  <td style="font-size:.8rem;color:var(--muted)">${esc(y.fiber||'—')}</td>
                  <td>${y.metersPerSkein||'—'}</td><td>${y.gramsPerSkein||'—'}</td>
                  <td>${yarnColours.length} colour${yarnColours.length!==1?'s':''}</td>
                  <td><div class="action-btns" onclick="event.stopPropagation()">
                    <button class="btn-edit"   onclick="event.stopPropagation();openEditYarnOverlay(${y.id})">✏️</button>
                    <button class="btn-delete" onclick="event.stopPropagation();deleteYarn(${y.id})">🗑️</button>
                  </div></td>
                </tr>
                <tr id="yarn-colours-${y.id}" style="display:none">
                  <td colspan="7" style="background:var(--cream);padding:12px 16px">
                    ${yarnColours.length === 0 ? `<p style="color:var(--muted);font-size:.82rem">No colourways yet.</p>` :
                      `<div class="colourway-detail-header"><span>Colour</span><span>Lot #</span><span></span><span></span><span>Actions</span></div>
                      ${yarnColours.map(cw => `
                        <div class="colourway-detail-row">
                          <span>${esc(cw.colourName)}</span>
                          <span style="color:var(--muted)">${esc(cw.lotNumber||'—')}</span>
                          <span></span><span></span>
                          <span><div class="action-btns">
                            <button class="btn-edit"   onclick="openEditColourwayOverlay(${cw.id})">✏️</button>
                            <button class="btn-delete" onclick="deleteColourway(${cw.id})">🗑️</button>
                          </div></span>
                        </div>`).join('')}`}
                  </td>
                </tr>`;
              }).join('')}
              </tbody>
            </table></div>
          </div>`).join('')}
    </div>

    <div class="card" style="text-align:center;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <button class="btn-edit"   style="padding:10px 20px;border-radius:8px;font-size:.9rem" onclick="showPINScreen('change')">🔑 Change PIN</button>
      <button class="btn-delete" style="padding:10px 20px;border-radius:8px;font-size:.9rem" onclick="lockApp()">🔒 Lock App</button>
    </div>`;
}

function toggleYarnColours(id) {
  const row = document.getElementById('yarn-colours-' + id);
  if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

async function submitAddYarnEntry() {
  const brandName  = document.getElementById('addBrandName').value.trim();
  const yarnName   = document.getElementById('addYarnName').value.trim();
  const colourName = document.getElementById('addColourName').value.trim();
  if (!brandName || !yarnName || !colourName) { showFlash('Brand, yarn name, and colour are required.', 'error'); return; }

  const brands  = await dbGetAll('brands');
  const country = document.getElementById('addBrandCountry').value.trim();
  let brand     = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
  let brandId;
  if (brand) { brandId = brand.id; if (country) await dbPut('brands', { ...brand, country }); }
  else        { brandId = await dbAdd('brands', { name: brandName, country: country || null }); }

  const yarns  = await dbGetAll('yarns');
  const fiber  = document.getElementById('addYarnFiber').value.trim();
  const weight = document.getElementById('addYarnWeight').value;
  const meters = document.getElementById('addYarnMeters').value;
  const grams  = document.getElementById('addYarnGrams').value;
  let yarn     = yarns.find(y => y.name.toLowerCase() === yarnName.toLowerCase() && y.brandId === brandId);
  let yarnId;
  if (yarn) {
    yarnId = yarn.id;
    await dbPut('yarns', { ...yarn, fiber, weight: weight||null, metersPerSkein: meters?parseFloat(meters):null, gramsPerSkein: grams?parseFloat(grams):null });
  } else {
    yarnId = await dbAdd('yarns', { brandId, name: yarnName, fiber, weight: weight||null, metersPerSkein: meters?parseFloat(meters):null, gramsPerSkein: grams?parseFloat(grams):null });
  }

  const colourways = await dbGetAll('colourways');
  const lotNumber  = document.getElementById('addLotNumber').value.trim();
  if (!colourways.find(c => c.yarnId === yarnId && c.colourName.toLowerCase() === colourName.toLowerCase())) {
    await dbAdd('colourways', { yarnId, colourName, lotNumber: lotNumber||null });
  }

  ['addBrandName','addBrandCountry','addYarnName','addYarnFiber','addColourName','addLotNumber','addYarnMeters','addYarnGrams']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('addYarnWeight').value = '';
  await renderManage();
  showFlash('Yarn entry saved!', 'success');
}

async function openEditYarnOverlay(yarnId) {
  const yarn   = await dbGet('yarns', yarnId);
  const brands = await dbGetAll('brands');
  document.getElementById('editYarnId').value     = yarnId;
  document.getElementById('editYarnBrand').innerHTML = brands.map(b => `<option value="${b.id}" ${b.id===yarn.brandId?'selected':''}>${esc(b.name)}</option>`).join('');
  document.getElementById('editYarnName').value   = yarn.name;
  document.getElementById('editYarnFiber').value  = yarn.fiber  || '';
  document.getElementById('editYarnWeight').value = yarn.weight ?? '';
  document.getElementById('editYarnMeters').value = yarn.metersPerSkein || '';
  document.getElementById('editYarnGrams').value  = yarn.gramsPerSkein  || '';
  openOverlay('editYarnOverlay');
}

async function submitEditYarn() {
  const yarnId = parseInt(document.getElementById('editYarnId').value);
  const yarn   = await dbGet('yarns', yarnId);
  await dbPut('yarns', {
    ...yarn,
    brandId:        parseInt(document.getElementById('editYarnBrand').value),
    name:           document.getElementById('editYarnName').value.trim(),
    fiber:          document.getElementById('editYarnFiber').value.trim(),
    weight:         document.getElementById('editYarnWeight').value || null,
    metersPerSkein: document.getElementById('editYarnMeters').value ? parseFloat(document.getElementById('editYarnMeters').value) : null,
    gramsPerSkein:  document.getElementById('editYarnGrams').value  ? parseFloat(document.getElementById('editYarnGrams').value)  : null
  });
  closeOverlay('editYarnOverlay');
  await renderManage();
  showFlash('Yarn updated!', 'success');
}

async function deleteYarn(yarnId) {
  if (!confirm('Delete this yarn and all its colourways?')) return;
  const colourways = await dbGetAll('colourways');
  for (const cw of colourways.filter(c => c.yarnId === yarnId)) await dbDelete('colourways', cw.id);
  await dbDelete('yarns', yarnId);
  await renderManage();
  showFlash('Yarn deleted.', 'success');
}

async function openEditColourwayOverlay(cwId) {
  const cw = await dbGet('colourways', cwId);
  document.getElementById('editCwId').value   = cwId;
  document.getElementById('editCwName').value = cw.colourName;
  document.getElementById('editCwLot').value  = cw.lotNumber || '';
  openOverlay('editColourwayOverlay');
}

async function submitEditColourway() {
  const cwId = parseInt(document.getElementById('editCwId').value);
  const cw   = await dbGet('colourways', cwId);
  await dbPut('colourways', { ...cw, colourName: document.getElementById('editCwName').value.trim(), lotNumber: document.getElementById('editCwLot').value.trim() || null });
  closeOverlay('editColourwayOverlay');
  await renderManage();
  showFlash('Colourway updated!', 'success');
}

async function deleteColourway(cwId) {
  if (!confirm('Delete this colourway?')) return;
  await dbDelete('colourways', cwId);
  await renderManage();
  showFlash('Colourway deleted.', 'success');
}

// ── OVERLAY HELPERS ───────────────────────────────
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.overlay-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', async e => {
      e.preventDefault();
      activeTab = tab.dataset.tab;
      renderNav();
      await renderApp();
    });
  });
});

// ── FLASH MESSAGES ────────────────────────────────
function showFlash(msg, type = 'success') {
  const el = document.getElementById('flashMsg');
  el.textContent   = (type === 'success' ? '✅ ' : '❌ ') + msg;
  el.className     = 'flash ' + type;
  el.style.display = 'flex';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

boot();
