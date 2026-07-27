    // LIST OF BACKGROUND IMAGES (Pehle wali snow image remove kar di hai)
    const bgImages = [
      'WhatsApp Image 2026-07-25 at 4.35.26 PM.jpeg',       // Rainy City Street Light
      'WhatsApp Image 2026-07-25 at 4.35.26 PM (1).jpeg',   // Rainy Green Bamboo Forest
      'WhatsApp Image 2026-07-25 at 4.35.26 PM (2).jpeg',   // Green Meadow & Cloudy Sky
      'WhatsApp Image 2026-07-25 at 4.35.26 PM (3).jpeg'    // Alpine Valley & Waterfalls
    ];

    let currentBgIndex = 0;

    // BACKGROUND ROTATOR ENGINE (Switches every 2 hours)
    function rotateBackground() {
      const bgElement = document.getElementById('bg-slider');
      if (bgElement) {
        bgElement.style.backgroundImage = `url('${bgImages[currentBgIndex]}')`;
        currentBgIndex = (currentBgIndex + 1) % bgImages.length;
      }
    }

    // INITIALIZE ROTATOR
    rotateBackground();
    // 2 Hours = 2 * 60 * 60 * 1000 = 7,200,000 Milliseconds
    setInterval(rotateBackground, 7200000);

    // RESTORE SAVED DATA ON PAGE LOAD (fix: data was disappearing on reload)
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof AppUI !== 'undefined' && typeof AppUI._loadState === 'function') {
        AppUI._loadState();
      }
      if (typeof AppUI !== 'undefined' && typeof AppUI._mountCityLegends === 'function') {
        AppUI._mountCityLegends();
      }
      if (typeof AppUI !== 'undefined' && typeof AppUI._restoreNavGroups === 'function') {
        AppUI._restoreNavGroups();
      }
    });

    // Make sure a pending debounced save isn't lost if the tab closes right after an edit.
    window.addEventListener('beforeunload', () => {
      if (typeof AppUI !== 'undefined' && typeof AppUI._saveStateNow === 'function') {
        clearTimeout(AppUI._saveTimer);
        AppUI._saveStateNow();
      }
    });

    // APP UI CONTROLLER
    const AppUI = {
      chartsInitialized: false,

      switchPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) targetPage.style.display = 'block';

        const navBtn = document.getElementById(`btn-nav-${pageId}`);
        if (navBtn) navBtn.classList.add('active');

        if (pageId === 'analytics' && !this.chartsInitialized) {
          setTimeout(() => this.initCharts(), 100);
        }
        if (pageId === 'grid') {
          this.renderMasterLedger();
        }
      },

      switchSettingsTab(tabKey, element) {
        document.querySelectorAll('.settings-content').forEach(c => c.style.display = 'none');
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        
        document.getElementById(`set-tab-${tabKey}`).style.display = 'block';
        element.classList.add('active');
      },

      clearAllData() {
        const confirmAction = confirm("Kya aap sure hain ki saara data DELETE karna chahte hain? Yeh action revert nahi ho sakta!");
        if (confirmAction) {
          localStorage.clear();
          this.saleData = [];
          this.billingData = [];
          this.reviewOverrides = {};
          this.manualEdits = {};
          this.manualClears = {};
          this.manualFrees = {};
          this.billingAnalysisResults = null;
          alert("Saara System Data Safai se Delete kar diya gaya hai!");
          window.location.reload();
        }
      },

      // ── COLLAPSIBLE SIDEBAR SECTIONS — "Management" has ~10 links, so it
      // can be collapsed to a single header + arrow. Collapsed state is
      // remembered in localStorage and re-applied on every page (sidebar is
      // repeated per page, not templated).
      _NAV_COLLAPSE_KEY: 'airtouch_nav_collapsed_v1',
      toggleNavGroup(key, headerEl) {
        const group = document.getElementById(`nav-group-${key}`);
        if (!group) return;
        const collapsed = group.classList.toggle('collapsed');
        if (headerEl) headerEl.classList.toggle('collapsed', collapsed);
        try {
          const raw = localStorage.getItem(this._NAV_COLLAPSE_KEY);
          const state = raw ? JSON.parse(raw) : {};
          state[key] = collapsed;
          localStorage.setItem(this._NAV_COLLAPSE_KEY, JSON.stringify(state));
        } catch (err) { console.error('Nav collapse state save failed:', err); }
      },
      _restoreNavGroups() {
        try {
          const raw = localStorage.getItem(this._NAV_COLLAPSE_KEY);
          if (!raw) return;
          const state = JSON.parse(raw);
          Object.keys(state).forEach(key => {
            if (!state[key]) return;
            const group = document.getElementById(`nav-group-${key}`);
            const header = document.getElementById(`nav-arrow-${key}`);
            if (group) group.classList.add('collapsed');
            if (header && header.closest('.nav-section-toggle')) header.closest('.nav-section-toggle').classList.add('collapsed');
          });
        } catch (err) { console.error('Nav collapse state restore failed:', err); }
      },

      toggleTheme() {
        const body = document.documentElement;
        const current = body.getAttribute('data-theme');
        body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
      },

      openUserProfile(userId) {
        document.getElementById('modal-user-id').textContent = `User Profile: ${userId}`;
        document.getElementById('userModal').classList.add('active');
      },

      // ── GLOBAL SEARCH — reuses the existing (per-page) user modal shell,
      // rebuilding its inner content into a search box + live-filtered
      // results across every computed category (Clear, Pending, Billing Not
      // In Sale, Mismatch Less/Extra, Duplicates). Matches on User ID or
      // Name (the only identity fields the imported data actually has).
      openGlobalSearch() {
        const modal = document.getElementById('userModal');
        const card = modal && modal.querySelector('.modal-card');
        if (!modal || !card) return;
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h2 style="font-size:18px; font-weight:800;">🔎 Global Search</h2>
            <button class="btn" onclick="document.getElementById('userModal').classList.remove('active')">✕ Close</button>
          </div>
          <input type="text" id="global-search-input" class="form-control" placeholder="User ID ya Name likhein..." style="width:100%; padding:10px 12px; font-size:14px; margin-bottom:14px; box-sizing:border-box;" oninput="AppUI.runGlobalSearch(this.value)">
          <div id="global-search-results"></div>
        `;
        modal.classList.add('active');
        this.runGlobalSearch('');
        setTimeout(() => { const inp = document.getElementById('global-search-input'); if (inp) inp.focus(); }, 50);
      },

      runGlobalSearch(query) {
        const resultsEl = document.getElementById('global-search-results');
        if (!resultsEl) return;
        const q = String(query == null ? '' : query).trim().toLowerCase();
        const r = this.billingAnalysisResults;

        if (!r) {
          resultsEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Pehle <b>Dual Data Import</b> se Sale/Billing files upload karke verification chalayein.</div>`;
          return;
        }
        if (!q) {
          resultsEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">User ID ya Name type karein — sab pages (Clear, Pending, Mismatch, Billing Not In Sale, Duplicates) mein search hoga.</div>`;
          return;
        }

        const matchRow = x => String(x.userId || '').toLowerCase().includes(q) || String(x.name || '').toLowerCase().includes(q);
        const categories = [
          { label: '✅ Clear', color: 'var(--accent-green)', rows: r.clear },
          { label: '⏳ Pending', color: 'var(--warning)', rows: r.pending.filter(x => x.reason !== 'no_payment') },
          { label: '🟠 Billing Not In Sale', color: 'var(--danger)', rows: r.pending.filter(x => x.reason === 'no_payment') },
          { label: '🔴 Mismatch — Less', color: 'var(--danger)', rows: r.mismatchLess },
          { label: '🟣 Mismatch — Extra', color: 'var(--purple)', rows: r.mismatchExtra },
          { label: '🔁 Duplicate Recharges', color: 'var(--warning)', rows: r.duplicatesMonth || r.duplicates || [] }
        ];

        let html = '';
        let totalMatches = 0;
        categories.forEach(cat => {
          const matches = (cat.rows || []).filter(matchRow);
          if (!matches.length) return;
          totalMatches += matches.length;
          html += `<div style="font-weight:800; font-size:12px; color:${cat.color}; margin:14px 0 6px;">${cat.label} (${matches.length})</div>`;
          html += matches.slice(0, 50).map(x => {
            const amt = x.paidAmount ?? x.pendingAmount ?? x.billingAmount ?? x.extraAmount ?? x.differenceAmount ?? x.amount ?? 0;
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 10px; border-radius:8px; background:var(--surface); margin-bottom:4px; font-size:12.5px;">
              <span><b style="color:var(--primary);">${this._escapeHtml(x.userId)}</b> ${x.name ? '— ' + this._escapeHtml(x.name) : ''} ${this._cityBadge(x.userId)}</span>
              <span class="font-mono">Rs. ${Number(amt).toLocaleString()}${x.month ? ' · ' + this._escapeHtml(x.month) : ''}</span>
            </div>`;
          }).join('');
          if (matches.length > 50) html += `<div style="font-size:11px; color:var(--text-muted); padding:2px 4px;">...${matches.length - 50} aur match hain, search ko aur specific karein.</div>`;
        });

        resultsEl.innerHTML = totalMatches
          ? html
          : `<div style="text-align:center; padding:30px; color:var(--text-muted);">"${this._escapeHtml(query)}" se koi match nahi mila.</div>`;
      },

      // Header quick-search box (present on every page) — reuses the same
      // Global Search modal so results are consistent everywhere.
      quickSearch(val) {
        if (!val || !val.trim()) return;
        const modal = document.getElementById('userModal');
        if (!modal || !modal.classList.contains('active')) {
          this.openGlobalSearch();
        }
        const inp = document.getElementById('global-search-input');
        if (inp && inp.value !== val) inp.value = val;
        this.runGlobalSearch(val);
      },

      saleData: [],
      billingData: [],
      ledgerFilterType: 'all',
      ledgerFilterCity: 'all',

      // Per-table city filters — one entry per export-button table across
      // pending.html, billing-not-in-sale.html, clear-billing.html,
      // mismatch-less.html, mismatch-extra.html, duplicates.html, and the
      // combined verify.html (which shows several of these at once).
      cityFilters: {
        pending: 'all', nopayment: 'all', clear: 'all',
        mismatchLess: 'all', mismatchExtra: 'all', duplicates: 'all', review: 'all', freeUsers: 'all'
      },

      setCategoryCityFilter(key, city) {
        this.cityFilters[key] = city;
        if (key === 'freeUsers') this._renderFreeUsers();
        else this._renderBillingAnalysis();
      },

      _filterRowsByCity(rows, city) {
        if (!city || city === 'all') return rows;
        return rows.filter(r => this._cityName(r.userId) === city);
      },

      // ══════════ CITY CODE DIRECTORY ══════════
      // Every User ID starts with a letter-prefix that identifies its city.
      // MNR is special: exactly 3 digits after it = SWAT City, 4+ digits = GHL City.
      CITY_CODE_MAP: {
        'B': 'B City', 'BTK': 'B City', 'KHR': 'B City', 'MKD': 'B City',
        'CKD': 'CKD City', 'BKD': 'CKD City',
        'TLS': 'TLS City', 'ZRT': 'TLS City', 'NSF': 'TLS City',
        'TOK': 'TOK City', 'SLW': 'TOK City', 'TNG': 'TOK City',
        'QLG': 'TOK City', 'KML': 'TOK City', 'TDC': 'TOK City', 'MBD': 'TOK City',
        'KOT': 'KOT City',
        'SHM': 'SHM City',
        'MTA': 'MTA City',
        'TLG': 'SWAT City', 'MGL': 'SWAT City', 'SNG': 'SWAT City', 'SWT': 'SWAT City', 'ODG': 'SWAT City', 'CBH': 'SWAT City',
        'GHL': 'GHL City', 'BKT': 'GHL City',
        'OSK': 'OCH City', 'OCH': 'OCH City',
        'BDN': 'BDN City', 'KDZ': 'BDN City',
        'SKT': 'SKT City',
        'DHR': 'DHR City',
        'ALD': 'ALD City',
        'THA': 'THA City'
      },

      CITY_LIST: [
        { city: 'B City', codes: 'B, BTK, KHR, MKD' },
        { city: 'CKD City', codes: 'CKD, BKD' },
        { city: 'TLS City', codes: 'TLS, ZRT, NSF' },
        { city: 'TOK City', codes: 'TOK, SLW, TNG, QLG, KML, TDC, MBD' },
        { city: 'KOT City', codes: 'KOT' },
        { city: 'SHM City', codes: 'SHM' },
        { city: 'MTA City', codes: 'MTA' },
        { city: 'SWAT City', codes: 'TLG, MGL, SNG, SWT, ODG, CBH, MNR (1-3 digit — MNR1, MNR12, MNR123)' },
        { city: 'GHL City', codes: 'GHL, BKT, MNR (4+ digit — MNR1234)' },
        { city: 'OCH City', codes: 'OSK, OCH' },
        { city: 'BDN City', codes: 'BDN, KDZ' },
        { city: 'SKT City', codes: 'SKT' },
        { city: 'DHR City', codes: 'DHR' },
        { city: 'ALD City', codes: 'ALD' },
        { city: 'THA City', codes: 'THA' }
      ],

      // Detect a User ID's city from its letter-prefix. MNR is split by digit-count.
      _detectCity(userId) {
        const s = String(userId == null ? '' : userId).trim().toUpperCase();
        const m = s.match(/^([A-Z]+)(\d*)/);
        if (!m || !m[1]) return { code: '', city: 'Unknown', valid: false };
        const letters = m[1];
        const digits = m[2] || '';

        if (letters === 'MNR') {
          if (digits.length >= 1 && digits.length <= 3) return { code: 'MNR', city: 'SWAT City', valid: true };
          if (digits.length >= 4) return { code: 'MNR', city: 'GHL City', valid: true };
          return { code: 'MNR', city: 'Unknown', valid: false };
        }

        const city = this.CITY_CODE_MAP[letters];
        return city ? { code: letters, city, valid: true } : { code: letters, city: 'Unknown', valid: false };
      },

      _cityName(userId) {
        return this._detectCity(userId).city;
      },

      // Small coloured chip for table cells — red "❓ Unknown" for codes that
      // don't match any known city prefix, so bad/unrecognised User IDs stand out.
      _cityBadge(userId) {
        const r = this._detectCity(userId);
        return r.valid
          ? `<span class="badge badge-city">${this._escapeHtml(r.city)}</span>`
          : `<span class="badge badge-city-unknown" title="Is User ID ka prefix kisi maloom city code se match nahi hota">❓ Unknown</span>`;
      },

      // Directory block rendered above every table (collapsed by default) so
      // it's always clear which User ID prefixes belong to which city.
      // Renders who recharged a record in the natural "<name> ne" phrasing
      // (e.g. "dhr ne", "user1 ne") instead of the bare name.
      _byLabel(name) {
        const n = String(name == null ? '' : name).trim();
        return n ? `${this._escapeHtml(n)} ne` : '';
      },

      _cityLegendHtml() {
        const items = this.CITY_LIST.map(c =>
          `<span class="city-legend-item"><b>${this._escapeHtml(c.city)}:</b>${this._escapeHtml(c.codes)}</span>`
        ).join('');
        return `<details class="card city-legend">
          <summary>🏙️ City Code Directory — User ID prefix se city pehchani jaati hai</summary>
          <div class="city-legend-body">${items}</div>
        </details>`;
      },

      // Injects the city legend above every table on the current page. Called
      // once on load — safe to call on every page even if no tables exist.
      _mountCityLegends() {
        document.querySelectorAll('.table-wrap').forEach(el => {
          if (el.previousElementSibling && el.previousElementSibling.classList && el.previousElementSibling.classList.contains('city-legend')) return;
          const wrap = document.createElement('div');
          wrap.className = 'city-legend';
          wrap.innerHTML = this._cityLegendHtml();
          el.parentNode.insertBefore(wrap, el);
        });
      },

      // ══════════ MASTER LEDGER ══════════
      setLedgerFilter(type) {
        this.ledgerFilterType = type;
        document.querySelectorAll('#page-grid .filter-btn').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`ledger-filter-${type}`);
        if (btn) btn.classList.add('active');
        this.renderMasterLedger();
      },

      setLedgerCityFilter(city) {
        this.ledgerFilterCity = city;
        this.renderMasterLedger();
      },

      // Fills the city filter dropdown once with every city in the directory,
      // plus "Unknown" for User IDs that don't match a known prefix.
      _populateCityFilterDropdown(selectId) {
        const sel = document.getElementById(selectId);
        if (!sel || sel.dataset.filled) return;
        const opts = ['<option value="all">Sab Cities</option>']
          .concat(this.CITY_LIST.map(c => `<option value="${this._escapeHtml(c.city)}">${this._escapeHtml(c.city)}</option>`))
          .concat(['<option value="Unknown">❓ Unknown</option>']);
        sel.innerHTML = opts.join('');
        sel.dataset.filled = '1';
      },

      renderMasterLedger() {
        const tbody = document.getElementById('ledger-tbody');
        if (!tbody) return;

        this._populateCityFilterDropdown('ledger-city-filter');

        const searchInput = document.getElementById('ledger-search');
        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

        let rows = [];
        if (this.ledgerFilterType !== 'billing') {
          rows = rows.concat(this.saleData.map(r => ({ ...r, _type: 'Sale Payment', _typeClass: 'accent-green' })));
        }
        if (this.ledgerFilterType !== 'sale') {
          rows = rows.concat(this.billingData.map(r => ({ ...r, _type: 'Billing Bill', _typeClass: 'primary' })));
        }

        if (query) {
          rows = rows.filter(r =>
            String(r.userId || '').toLowerCase().includes(query) ||
            String(r.name || '').toLowerCase().includes(query)
          );
        }

        if (this.ledgerFilterCity && this.ledgerFilterCity !== 'all') {
          rows = rows.filter(r => this._cityName(r.userId) === this.ledgerFilterCity);
        }

        rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));

        tbody.innerHTML = rows.map(r => `
          <tr>
            <td class="font-mono">${this._escapeHtml(r.date)}</td>
            <td><span class="badge" style="background:var(--${r._typeClass}-light); color:var(--${r._typeClass});">${r._type}</span></td>
            <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(r.userId)}</td>
            <td>${this._cityBadge(r.userId)}</td>
            <td>${this._escapeHtml(r.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td class="font-mono">Rs. ${Number(r.amount).toLocaleString()}</td>
            <td>${this._byLabel(r.processedBy) || '<span style="color:var(--text-muted);">—</span>'}</td>
          </tr>`).join('');

        const totalSale = this.saleData.reduce((s, r) => s + Number(r.amount || 0), 0);
        const totalBilling = this.billingData.reduce((s, r) => s + Number(r.amount || 0), 0);
        const cntTotalEl = document.getElementById('ledger-cnt-total');
        const sumSaleEl = document.getElementById('ledger-sum-sale');
        const sumBillingEl = document.getElementById('ledger-sum-billing');
        if (cntTotalEl) cntTotalEl.textContent = rows.length.toLocaleString();
        if (sumSaleEl) sumSaleEl.textContent = `Rs. ${totalSale.toLocaleString()}`;
        if (sumBillingEl) sumBillingEl.textContent = `Rs. ${totalBilling.toLocaleString()}`;
      },

      // ── Column detection: works even if headers vary a bit between uploads ──
      _normalizeHeader(h) {
        return String(h == null ? '' : h).toLowerCase().trim();
      },

      // Splits a normalized header into alphanumeric tokens, e.g. "Amount (Rs)"
      // -> ['amount', 'rs']. Used so matching is token-boundary aware instead of
      // raw substring — raw substring matching previously let "date" match
      // inside "updatebillingsheets" (an instruction-banner row, not a header).
      _headerTokens(norm) {
        return norm.split(/[^a-z0-9]+/).filter(Boolean);
      },

      _findColumn(headers, candidates) {
        const norm = headers.map(h => ({ raw: h, norm: this._normalizeHeader(h) }));

        // Phase 1: exact whole-string match, tried in candidate priority order.
        // This always wins over a fuzzy match further down the list — e.g. a
        // sheet with both a "By" and a "Sold By" column should resolve to
        // whichever is listed first among the candidates, not whichever
        // column happens to appear first in the sheet.
        for (const cand of candidates) {
          const found = norm.find(h => h.norm === cand);
          if (found) return found.raw;
        }

        // Phase 2: token-boundary match, e.g. candidate "amount" matches
        // header "Amount (Rs)" (tokens: amount, rs) but not a header whose
        // only token is some unrelated compound word.
        for (const cand of candidates) {
          const candTokens = cand.split(/\s+/);
          const found = norm.find(h => {
            const tokens = this._headerTokens(h.norm);
            if (candTokens.length === 1) return tokens.includes(candTokens[0]);
            for (let i = 0; i <= tokens.length - candTokens.length; i++) {
              if (candTokens.every((t, j) => tokens[i + j] === t)) return true;
            }
            return false;
          });
          if (found) return found.raw;
        }
        return null;
      },

      _detectColumnMap(headers) {
        return {
          date: this._findColumn(headers, ['datetime', 'date', 'txn date', 'transaction date', 'invoice date']),
          userId: this._findColumn(headers, ['username', 'user id', 'userid', 'user']),
          name: this._findColumn(headers, ['full name', 'name', 'customer name']),
          amount: this._findColumn(headers, ['total', 'amount', 'pkg amount', 'package amount', 'total amount']),
          // "by" (who actually did the recharge) is checked before "sold by"
          // so a sheet with both columns maps Processed By to "By".
          processedBy: this._findColumn(headers, ['recharged by', 'by', 'processed by', 'sold by', 'invoice#', 'invoice #', 'invoice'])
        };
      },

      // ── Header-row detection: real exports often have a few banner/instruction
      // rows above the actual header row, so row 1 can't be assumed to be it. ──
      _HEADER_KEYWORDS: ['date', 'datetime', 'txn date', 'transaction date', 'invoice date', 'username', 'user id',
        'userid', 'user', 'full name', 'name', 'customer name', 'amount', 'total', 'pkg amount', 'package amount',
        'total amount', 'sold by', 'by', 'invoice#', 'invoice #', 'invoice', 'processed by', 'recharged by', 'city', 'package'],

      _detectHeaderRow(aoa) {
        let bestIdx = 0, bestScore = -1;
        const maxScan = Math.min(aoa.length, 15);
        for (let i = 0; i < maxScan; i++) {
          const row = aoa[i] || [];
          let score = 0, nonEmpty = 0;
          for (const cell of row) {
            const norm = this._normalizeHeader(cell);
            if (!norm) continue;
            nonEmpty++;
            const tokens = this._headerTokens(norm);
            for (const kw of this._HEADER_KEYWORDS) {
              const kwTokens = kw.split(/\s+/);
              const hit = kwTokens.length === 1 ? tokens.includes(kwTokens[0]) : norm.includes(kw);
              if (hit) { score++; break; }
            }
          }
          // Require several non-empty cells so a single-cell banner/title row
          // (e.g. "AIRTOUCH WIRELESS — MONTHLY BILLING") can never win even if
          // one of its words happens to match a keyword.
          if (nonEmpty >= 3 && score > bestScore) { bestScore = score; bestIdx = i; }
        }
        return bestIdx;
      },

      // ── Fallback date-column detection by content, for sheets where the real
      // date column has a non-descriptive header like "#" instead of "Date". ──
      _looksLikeDateValue(v) {
        if (v instanceof Date && !isNaN(v.getTime())) return true;
        if (typeof v === 'number') return v > 20000 && v < 60000; // plausible Excel date serial
        if (typeof v !== 'string') return false;
        const s = v.trim();
        if (!s) return false;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
        if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(s)) return true;
        if (/^\d{1,2}\/\d{1,2}(?:[, ]|$)/.test(s)) return true;
        if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s)) return true;
        return false;
      },

      _detectDateColumnByContent(headers, rows, colMap) {
        const used = new Set([colMap.userId, colMap.name, colMap.amount, colMap.processedBy].filter(Boolean));
        let best = null, bestRatio = 0;
        for (const h of headers) {
          if (used.has(h)) continue;
          let hit = 0, total = 0;
          for (let i = 0; i < rows.length && total < 30; i++) {
            const v = rows[i][h];
            if (v === null || v === undefined || v === '') continue;
            total++;
            if (this._looksLikeDateValue(v)) hit++;
          }
          if (total >= 3) {
            const ratio = hit / total;
            if (ratio > bestRatio && ratio >= 0.4) { bestRatio = ratio; best = h; }
          }
        }
        return best;
      },

      // Real exports sometimes only record a batch month ("JULY") or a
      // day/month with no year at all. Sample whatever years do appear in the
      // date column so those partial values can be completed sensibly instead
      // of falling back to "today"'s year, which would be wrong for imports of
      // past months.
      _inferReferenceYear(rows, dateCol) {
        if (!dateCol) return new Date().getFullYear();
        const counts = {};
        for (let i = 0; i < rows.length && i < 200; i++) {
          const v = rows[i][dateCol];
          if (v instanceof Date && !isNaN(v.getTime())) {
            const y = v.getFullYear();
            counts[y] = (counts[y] || 0) + 1;
            continue;
          }
          const s = String(v == null ? '' : v);
          const m = s.match(/(\d{4})/);
          if (m) {
            const y = parseInt(m[1], 10);
            if (y > 2000 && y < 2100) counts[y] = (counts[y] || 0) + 1;
          }
        }
        let bestYear = null, bestCount = 0;
        for (const y in counts) {
          if (counts[y] > bestCount) { bestCount = counts[y]; bestYear = parseInt(y, 10); }
        }
        return bestYear || new Date().getFullYear();
      },

      _MONTH_SHORT: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },

      // referenceYear is used to complete values that don't carry a year of
      // their own (a bare month name like "JULY", or "M/D" with no year) — it
      // should be the most common year actually seen in that column, not
      // necessarily today's year, so imports of past months resolve correctly.
      _parseDateValue(val, referenceYear) {
        const refYear = referenceYear || new Date().getFullYear();
        if (val === null || val === undefined || val === '') return '';
        if (val instanceof Date && !isNaN(val.getTime())) {
          return val.toISOString().slice(0, 10);
        }
        if (typeof val === 'number') {
          const epoch = new Date(Date.UTC(1899, 11, 30));
          const d = new Date(epoch.getTime() + val * 86400000);
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        const s = String(val).trim();

        // Already ISO (YYYY-MM-DD, optionally with a time suffix)
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

        // DD/MM/YYYY, DD-MM-YYYY or DD.MM.YYYY — the standard date format used in
        // Pakistan's Sale/Billing exports. JS's built-in `new Date(string)` parser
        // guesses this as US-style MM/DD/YYYY (or fails outright when day > 12),
        // which silently shifts or drops the date — making an already-paid bill
        // fall outside the matching window and show up as Pending. Parse it
        // explicitly instead of guessing.
        const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
        if (dmy) {
          let day = parseInt(dmy[1], 10);
          let month = parseInt(dmy[2], 10);
          const year = parseInt(dmy[3], 10);
          // If the second field can't be a month (>12) but the first can be, the
          // fields are reversed for this row — swap so we still get a valid date.
          if (month > 12 && day <= 12) { const t = day; day = month; month = t; }
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }

        // M/D with no year at all, e.g. "7/17, 10:28 PM" — some billing
        // exports log a timestamp without the year. Unlike the D/M/Y case
        // above (which always carries a 4-digit year), this short form uses
        // month-first ordering, matching how these sheets write it.
        const md = s.match(/^(\d{1,2})\/(\d{1,2})(?:[, ]|$)/);
        if (md) {
          const month = parseInt(md[1], 10);
          const day = parseInt(md[2], 10);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${refYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }

        // A bare month name with no day at all ("JULY") — some billing rows
        // only record which month's batch a recharge belongs to. Best effort:
        // record it as the 1st of that month so it still sorts and groups
        // correctly, rather than dropping the row's date entirely.
        const monthOnly = s.match(/^([a-zA-Z]+)\.?$/);
        if (monthOnly) {
          const key = monthOnly[1].toLowerCase().slice(0, 3);
          if (this._MONTH_SHORT[key]) {
            return `${refYear}-${String(this._MONTH_SHORT[key]).padStart(2, '0')}-01`;
          }
        }

        // Last resort: things like "24 July 2026" or "Jul 24, 2026" that aren't
        // ambiguous between day/month, so the native parser is safe to use.
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
        return s;
      },

      // Words real billing sheets use in the Amount column to explicitly mean
      // "no charge" — these are intentional labels, not data-entry errors, so
      // they're parsed as 0 without being flagged for review.
      _ZERO_LIKE_AMOUNT_WORDS: ['free', 'expired', 'no data', 'nodata', 'void', 'na', 'n/a', 'clear', 'cancelled', 'canceled', 'waived'],

      _cleanAmountString(raw) {
        return raw.replace(/^(rs\.?|pkr)\s*/i, '').replace(/[,\s]/g, '').replace(/\/-$/, '');
      },

      _parseAmountValue(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val;
        const raw = String(val).trim();
        const stripped = this._cleanAmountString(raw);
        if (/^-?\d+(\.\d+)?$/.test(stripped)) return parseFloat(stripped);
        const lower = raw.toLowerCase();
        if (this._ZERO_LIKE_AMOUNT_WORDS.some(w => lower === w || lower.includes(w))) return 0;
        // Garbled entry (e.g. a stray User ID or note typed into the Amount
        // cell, like "T58S" or "odg80") — don't guess a number from whatever
        // digits happen to be in it; that number would be meaningless.
        // _isAmountAmbiguous flags this row for the user to fix by hand.
        const cleaned = raw.replace(/[^0-9.\-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      },

      // True when the raw Amount cell is neither a clean number nor a
      // recognized zero-like label (free/expired/etc) — i.e. it looks like a
      // typo or the wrong thing was typed into that cell, and the parsed
      // amount shouldn't be trusted without a manual check.
      _isAmountAmbiguous(val) {
        if (val === null || val === undefined || val === '') return false;
        if (typeof val === 'number') return false;
        const raw = String(val).trim();
        if (!raw) return false;
        if (/^-?\d+(\.\d+)?$/.test(this._cleanAmountString(raw))) return false;
        const lower = raw.toLowerCase();
        if (this._ZERO_LIKE_AMOUNT_WORDS.some(w => lower === w || lower.includes(w))) return false;
        return true;
      },

      _mapRowsToStandard(rows, colMap) {
        const referenceYear = this._inferReferenceYear(rows, colMap.date);
        const records = [];
        for (const row of rows) {
          const userIdRaw = colMap.userId ? row[colMap.userId] : null;
          const userId = userIdRaw == null ? '' : String(userIdRaw).trim();
          if (!userId) continue; // skip blank rows with no user id

          const nameRaw = colMap.name ? row[colMap.name] : null;
          const byRaw = colMap.processedBy ? row[colMap.processedBy] : null;

          const amountRaw = colMap.amount ? row[colMap.amount] : null;
          records.push({
            date: this._parseDateValue(colMap.date ? row[colMap.date] : null, referenceYear),
            userId: userId,
            name: (nameRaw == null || String(nameRaw).trim() === '') ? '' : String(nameRaw).trim(),
            amount: this._parseAmountValue(amountRaw),
            amountReview: this._isAmountAmbiguous(amountRaw),
            processedBy: byRaw == null ? '' : String(byRaw).trim()
          });
        }
        return records;
      },

      _escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      },

      _renderResultsTable(type, records) {
        const tbody = document.getElementById(`${type}-results-tbody`);
        const card = document.getElementById(`${type}-results-card`);
        const summary = document.getElementById(`${type}-summary`);
        if (!tbody || !card) return;

        const rows = records.map((r, idx) => `
          <tr>
            <td class="font-mono editable-cell" contenteditable="true" spellcheck="false" data-idx="${idx}" data-field="date" onblur="AppUI.updateImportRecord('${type}', this)">${this._escapeHtml(r.date)}</td>
            <td style="font-weight:800; color:var(--primary);" class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${idx}" data-field="userId" onblur="AppUI.updateImportRecord('${type}', this)">${this._escapeHtml(r.userId)}</td>
            <td>${this._cityBadge(r.userId)}</td>
            <td class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${idx}" data-field="name" onblur="AppUI.updateImportRecord('${type}', this)">${this._escapeHtml(r.name)}</td>
            <td class="font-mono"${r.amountReview ? ' style="background:var(--accent-red-light, #fde2e2);" title="Original cell was not a plain number (e.g. a typo or a stray note) — please check this amount"' : ''}>Rs. <span class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${idx}" data-field="amount" onblur="AppUI.updateImportRecord('${type}', this)">${Number(r.amount)}</span>${r.amountReview ? ' ⚠️' : ''}</td>
            <td><span class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${idx}" data-field="processedBy" onblur="AppUI.updateImportRecord('${type}', this)">${this._escapeHtml(r.processedBy)}</span>${r.processedBy ? ' ne' : ''}</td>
          </tr>`).join('');
        tbody.innerHTML = rows;

        const missingName = records.filter(r => !r.name).length;
        const unknownCity = records.filter(r => !this._detectCity(r.userId).valid).length;
        const amountReviewCnt = records.filter(r => r.amountReview).length;
        summary.textContent = `${records.length.toLocaleString()} records loaded${missingName ? ` · ${missingName} missing name` : ''}${unknownCity ? ` · ⚠️ ${unknownCity} record${unknownCity === 1 ? '' : 's'} ka city code pehchana nahi gaya (User ID check karein)` : ''}${amountReviewCnt ? ` · ⚠️ ${amountReviewCnt} amount${amountReviewCnt === 1 ? '' : 's'} original cell mein number nahi thi (typo ho sakta hai — row check karein)` : ''} · ✏️ table par click karke seedha edit karein`;
        card.style.display = 'block';
      },

      // Inline-edit a Sale or Billing record. Called on blur of an editable cell.
      updateImportRecord(type, el) {
        const idx = Number(el.getAttribute('data-idx'));
        const field = el.getAttribute('data-field');
        const arr = type === 'sale' ? this.saleData : this.billingData;
        if (!arr || !arr[idx]) return;

        let raw = el.textContent.trim();

        if (field === 'amount') {
          const num = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
          if (isNaN(num) || num < 0) {
            alert('Amount ek valid number honi chahiye.');
            el.textContent = Number(arr[idx].amount);
            return;
          }
          arr[idx].amount = num;
          arr[idx].amountReview = false;
          el.textContent = num;
          const flagCell = el.closest('td');
          if (flagCell) { flagCell.removeAttribute('style'); flagCell.removeAttribute('title'); }
        } else if (field === 'date') {
          const d = this._toDateObj(raw);
          if (!d) {
            alert('Date format YYYY-MM-DD mein likhein (jaise 2026-07-25).');
            el.textContent = arr[idx].date;
            return;
          }
          arr[idx].date = this._fmtDate(d);
          el.textContent = arr[idx].date;
        } else if (field === 'userId') {
          if (!raw) {
            alert('User ID khali nahi ho sakti.');
            el.textContent = arr[idx].userId;
            return;
          }
          arr[idx].userId = raw;
          const cityCell = el.nextElementSibling;
          if (cityCell) cityCell.innerHTML = this._cityBadge(raw);
        } else {
          arr[idx][field] = raw;
        }

        this._saveState();
        this._renderFreeUsers();

        const statusEl = document.getElementById('import-status');
        if (statusEl) {
          statusEl.textContent = '✏️ Record update ho gaya aur save ho gaya. Agar Billing Analysis pehle chal chuki hai to "Run Billing Analysis" / "Run FIFO Verification" dobara chalayein taky results is update ke sath refresh ho jayen.';
        }

        // If Master Ledger is currently open, keep it in sync too
        const ledgerTbody = document.getElementById('ledger-tbody');
        if (ledgerTbody) this.renderMasterLedger();
      },

      handleFileSelect(event, type) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('import-status');
        if (statusEl) statusEl.textContent = `Reading ${file.name}...`;

        if (typeof XLSX === 'undefined') {
          alert('Excel engine (SheetJS) failed to load — check your internet connection and reload the page.');
          if (statusEl) statusEl.textContent = '';
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
          alert(`Could not read ${file.name}.`);
          if (statusEl) statusEl.textContent = '';
        };
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];

            // Read as a raw grid first (no assumed header row) so we can find
            // the real header ourselves — real exports often have a few
            // banner/instruction rows above it (title, shortcut hints, etc.),
            // and always treating row 1 as the header silently produced zero
            // matched columns for those files.
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
            if (!aoa.length) {
              alert(`${file.name} has no data rows.`);
              if (statusEl) statusEl.textContent = '';
              return;
            }

            const headerRowIdx = this._detectHeaderRow(aoa);
            const rawHeaders = aoa[headerRowIdx] || [];
            const headers = rawHeaders.map((h, i) => {
              const norm = this._normalizeHeader(h);
              return norm === '' ? `col_${i}` : h;
            });

            const rows = [];
            for (let r = headerRowIdx + 1; r < aoa.length; r++) {
              const raw = aoa[r] || [];
              const obj = {};
              for (let c = 0; c < headers.length; c++) obj[headers[c]] = raw[c] === undefined ? null : raw[c];
              rows.push(obj);
            }

            if (!rows.length) {
              alert(`${file.name} has no data rows below the header.`);
              if (statusEl) statusEl.textContent = '';
              return;
            }

            const colMap = this._detectColumnMap(headers);

            // Some exports don't label the date column at all (e.g. a bare
            // "#" instead of "Date") — if header-name matching came up empty,
            // sniff the actual cell contents for date-shaped values instead.
            if (!colMap.date) colMap.date = this._detectDateColumnByContent(headers, rows, colMap);

            // Some sheets don't label the "who processed this" column with any
            // recognisable name at all — it's simply the last column in the
            // sheet (e.g. a bare "User1"/"User2" heading, or none). If name
            // matching found nothing, fall back to the right-most column that
            // isn't already used for Date/User ID/Name/Amount.
            if (!colMap.processedBy) {
              const usedCols = new Set([colMap.date, colMap.userId, colMap.name, colMap.amount].filter(Boolean));
              for (let i = headers.length - 1; i >= 0; i--) {
                if (!usedCols.has(headers[i])) { colMap.processedBy = headers[i]; break; }
              }
            }

            const missingRequired = [];
            if (!colMap.date) missingRequired.push('Date');
            if (!colMap.userId) missingRequired.push('User ID');
            if (!colMap.amount) missingRequired.push('Amount');
            if (missingRequired.length) {
              alert(`${file.name}: could not find column(s) for ${missingRequired.join(', ')}. Found headers: ${rawHeaders.join(', ')}`);
              if (statusEl) statusEl.textContent = '';
              return;
            }

            const records = this._mapRowsToStandard(rows, colMap);
            if (type === 'sale') {
              this.saleData = records;
            } else {
              this.billingData = records;
            }
            this._renderResultsTable(type, records);
            const unknownCityCnt = records.filter(r => !this._detectCity(r.userId).valid).length;
            if (statusEl) statusEl.textContent = `✅ ${file.name} imported — ${records.length.toLocaleString()} rows.` + (unknownCityCnt ? ` ⚠️ ${unknownCityCnt} User ID ka city code pehchana nahi gaya.` : '');

            const triggerCard = document.getElementById('analysis-trigger-card');
            if (triggerCard) triggerCard.style.display = (this.saleData.length && this.billingData.length) ? 'block' : 'none';

            this._computeTopStats();
            this._saveState();
          } catch (err) {
            console.error(err);
            alert(`Failed to parse ${file.name}: ${err.message}`);
            if (statusEl) statusEl.textContent = '';
          }
        };
        reader.readAsArrayBuffer(file);
      },

      // ══════════ BILLING ANALYSIS ENGINE ══════════
      // Rules: 30-day package cycles, Pending Bills, Amount Mismatch (Less/Extra),
      // Double Payment (new bill + an old pending bill, both covered by one
      // payment) auto-clears both by default — see candidateIdx handling
      // inside _computeBillingAnalysis. Only overridden to 'advance' or
      // 'review' via reviewOverrides does it need manual attention.
      reviewOverrides: {},
      // Manually corrected Mismatch rows — { cycleId: { billingAmount, paidAmount } }.
      // Applied on top of every computed result by _applyManualCorrections(); if the
      // corrected amounts now match, the row moves into Clear automatically.
      manualEdits: {},
      // Manually cleared Pending bills — { cycleId: true }. Applied by
      // _applyManualCorrections(): the row is pulled out of Pending and pushed
      // straight into Clear.
      manualClears: {},
      // Manually marked "Free" Pending bills — { cycleId: true }. Applied by
      // _applyManualCorrections(): pulled out of Pending and pushed into Clear
      // with paidAmount 0 and a "Free User" note (separate from a normal
      // manual Clear, which assumes the pending amount actually got paid).
      manualFrees: {},
      billingAnalysisResults: null,

      // ══════════ PERSISTENCE (fix: data disappearing on reload) ══════════
      _STORAGE_KEY: 'airtouch_state_v1',

      // PERF FIX: this used to run synchronously on every single keystroke/edit,
      // JSON-stringifying the entire dataset + analysis results and writing it to
      // localStorage each time — with a few thousand rows this blocks the main
      // thread and is exactly what made editing/typing feel slow. Now it's
      // debounced: rapid edits get batched into one save, 400ms after the last one.
      _saveTimer: null,
      _saveState() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._saveStateNow(), 400);
      },
      _saveStateNow() {
        try {
          const payload = {
            saleData: this.saleData,
            billingData: this.billingData,
            reviewOverrides: this.reviewOverrides,
            manualEdits: this.manualEdits,
            manualClears: this.manualClears,
            manualFrees: this.manualFrees,
            billingAnalysisResults: this.billingAnalysisResults
          };
          localStorage.setItem(this._STORAGE_KEY, JSON.stringify(payload));
        } catch (err) {
          console.error('State save failed:', err);
        }
      },

      // PERF FIX: ledger search box was calling renderMasterLedger() (full
      // filter+sort+innerHTML rebuild) on every single keystroke. Debounced to
      // 200ms so typing stays smooth even with a large ledger.
      _ledgerDebounceTimer: null,
      debouncedRenderLedger() {
        clearTimeout(this._ledgerDebounceTimer);
        this._ledgerDebounceTimer = setTimeout(() => this.renderMasterLedger(), 200);
      },

      _loadState() {
        try {
          const raw = localStorage.getItem(this._STORAGE_KEY);
          if (!raw) return;
          const payload = JSON.parse(raw);
          this.saleData = payload.saleData || [];
          this.billingData = payload.billingData || [];
          this.reviewOverrides = payload.reviewOverrides || {};
          this.manualEdits = payload.manualEdits || {};
          this.manualClears = payload.manualClears || {};
          this.manualFrees = payload.manualFrees || {};
          this.billingAnalysisResults = payload.billingAnalysisResults || null;

          if (this.saleData.length) this._renderResultsTable('sale', this.saleData);
          if (this.billingData.length) this._renderResultsTable('billing', this.billingData);

          const triggerCard = document.getElementById('analysis-trigger-card');
          if (triggerCard) triggerCard.style.display = (this.saleData.length && this.billingData.length) ? 'block' : 'none';

          this._computeTopStats();
          if (this.billingAnalysisResults) this._renderBillingAnalysis();

          const statusEl = document.getElementById('import-status');
          if (statusEl && (this.saleData.length || this.billingData.length)) {
            statusEl.textContent = '✅ Pehle se saved data restore ho gaya hai.';
          }

          // Multi-page setup: each HTML file only ever shows one page, so instead
          // of a JS switchPage() step, every page just bootstraps whatever it has.
          if (document.getElementById('ledger-tbody')) this.renderMasterLedger();
          if (document.getElementById('chartRevenueTrend') && !this.chartsInitialized) {
            setTimeout(() => this.initCharts(), 100);
          }
        } catch (err) {
          console.error('State restore failed:', err);
        }
      },


      // ══════════ EXPORTS (Excel + PDF) — every table on Import & Verify pages ══════════
      // Both produce a branded "AIRTOUCH WIRELESS" report: title banner, generated-on
      // line, coloured header row, zebra striping, right-aligned/formatted amounts,
      // and (Excel) a frozen header + autofilter so it's easy to scan and sort.
      // Per-report colour themes shared by Excel + PDF exports, matched to the
      // same badge/accent colours already used on-screen for each report type
      // (e.g. Pending = amber like its stat-card, Mismatch Extra = purple).
      _EXPORT_THEMES: {
        blue:   { hex:'0B51B7', dark:'083C8A', light:'EAF1FE', rgb:[11,81,183],  darkRgb:[8,60,138],   lightRgb:[234,241,254], icon:'📊' },
        green:  { hex:'119445', dark:'0D7038', light:'E9FBF1', rgb:[17,148,69],  darkRgb:[13,112,56],  lightRgb:[233,251,241], icon:'✅' },
        red:    { hex:'DC2626', dark:'A61B1B', light:'FDECEC', rgb:[220,38,38],  darkRgb:[166,27,27],  lightRgb:[253,236,236], icon:'🔴' },
        amber:  { hex:'D97706', dark:'A85A04', light:'FFF6E5', rgb:[217,119,6],  darkRgb:[168,90,4],   lightRgb:[255,246,229], icon:'⏳' },
        purple: { hex:'7C3AED', dark:'5B21B6', light:'F3EEFE', rgb:[124,58,237], darkRgb:[91,33,182],  lightRgb:[243,238,254], icon:'🟣' },
        slate:  { hex:'334155', dark:'1E293B', light:'EEF1F5', rgb:[51,65,85],   darkRgb:[30,41,59],   lightRgb:[238,241,245], icon:'📁' }
      },
      _exportTheme(key) { return this._EXPORT_THEMES[key] || this._EXPORT_THEMES.blue; },

      _exportExcel(rows, columns, filename, title, themeKey) {
        if (!rows || !rows.length) { alert('Export karne ke liye is table mein koi data nahi hai.'); return; }
        if (typeof XLSX === 'undefined') { alert('Excel engine load nahi ho saka — internet connection check karke page reload karein.'); return; }

        const theme = this._exportTheme(themeKey);
        const headerLabels = columns.map(c => c.label);
        const now = new Date();
        const generatedOn = now.toLocaleString('en-GB', { hour12: true });
        const reportTitle = (title || 'Data Report').toUpperCase();

        const amountColIdx = [];
        columns.forEach((c, i) => { if (c.label.toLowerCase().includes('amount')) amountColIdx.push(i); });

        const aoa = [
          [`${theme.icon}  AIRTOUCH WIRELESS — ${reportTitle}`],
          [`Generated on ${generatedOn}  •  ${rows.length} record${rows.length === 1 ? '' : 's'}`],
          [],
          headerLabels
        ];

        rows.forEach(r => {
          const row = columns.map((c, i) => {
            const raw = typeof c.value === 'function' ? c.value(r) : (r[c.value] ?? '');
            if (amountColIdx.includes(i)) {
              const n = Number(raw);
              return isNaN(n) ? (raw === undefined || raw === null ? '' : raw) : n;
            }
            return raw === undefined || raw === null ? '' : raw;
          });
          aoa.push(row);
        });

        // Totals row — sums every "Amount"-type column, labelled in the first
        // column, so a report is never missing the one number people always
        // reach for first (total pending, total paid, total mismatch, etc.).
        const hasTotals = amountColIdx.length > 0;
        if (hasTotals) {
          const totalsRow = columns.map((c, i) => {
            if (i === 0) return 'TOTAL';
            if (amountColIdx.includes(i)) {
              return rows.reduce((s, r) => {
                const raw = typeof c.value === 'function' ? c.value(r) : (r[c.value] ?? '');
                const n = Number(raw);
                return s + (isNaN(n) ? 0 : n);
              }, 0);
            }
            return '';
          });
          aoa.push(totalsRow);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const headerRowIdx = 3;
        const totalsRowIdx = hasTotals ? aoa.length - 1 : -1;
        const lastRowIdx = hasTotals ? aoa.length - 2 : aoa.length - 1;
        const lastColIdx = Math.max(columns.length - 1, 0);

        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } }
        ];
        if (hasTotals && lastColIdx > 0) {
          ws['!merges'].push({ s: { r: totalsRowIdx, c: 0 }, e: { r: totalsRowIdx, c: Math.max(lastColIdx - amountColIdx.length, 0) } });
        }

        ws['!cols'] = columns.map((c, i) => {
          let maxLen = c.label.length;
          rows.forEach(r => {
            const v = typeof c.value === 'function' ? c.value(r) : (r[c.value] ?? '');
            const len = String(v ?? '').length;
            if (len > maxLen) maxLen = len;
          });
          return { wch: Math.min(Math.max(maxLen + 2, 12), 42) };
        });
        ws['!rows'] = [{ hpt: 30 }, { hpt: 18 }, { hpt: 6 }, { hpt: 24 }];

        const WHITE = 'FFFFFF', ZEBRA = theme.light, BORDER = 'D9E2EC';
        const thinBorder = {
          top: { style: 'thin', color: { rgb: BORDER } }, bottom: { style: 'thin', color: { rgb: BORDER } },
          left: { style: 'thin', color: { rgb: BORDER } }, right: { style: 'thin', color: { rgb: BORDER } }
        };
        const setStyle = (r, c, style) => {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws[addr]) ws[addr].s = style;
        };

        for (let c = 0; c <= lastColIdx; c++) {
          setStyle(0, c, {
            font: { bold: true, sz: 15, color: { rgb: WHITE } },
            fill: { fgColor: { rgb: theme.hex } },
            alignment: { horizontal: 'center', vertical: 'center' }
          });
          setStyle(1, c, {
            font: { italic: true, sz: 10, color: { rgb: WHITE } },
            fill: { fgColor: { rgb: theme.dark } },
            alignment: { horizontal: 'center', vertical: 'center' }
          });
          setStyle(headerRowIdx, c, {
            font: { bold: true, sz: 11, color: { rgb: WHITE } },
            fill: { fgColor: { rgb: theme.hex } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: thinBorder
          });
        }

        amountColIdx.forEach(ci => {
          for (let ri = headerRowIdx + 1; ri <= lastRowIdx; ri++) {
            const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
            if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = '#,##0';
          }
          if (hasTotals) {
            const totalAddr = XLSX.utils.encode_cell({ r: totalsRowIdx, c: ci });
            if (ws[totalAddr] && typeof ws[totalAddr].v === 'number') ws[totalAddr].z = '#,##0';
          }
        });

        for (let ri = headerRowIdx + 1; ri <= lastRowIdx; ri++) {
          const isAlt = (ri - (headerRowIdx + 1)) % 2 === 1;
          for (let ci = 0; ci <= lastColIdx; ci++) {
            const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
            if (!ws[addr]) continue;
            const isAmount = amountColIdx.includes(ci);
            ws[addr].s = {
              font: { sz: 10, bold: isAmount, color: isAmount ? { rgb: theme.dark } : undefined },
              fill: { fgColor: { rgb: isAlt ? ZEBRA : WHITE } },
              alignment: { horizontal: isAmount ? 'right' : 'left', vertical: 'center' },
              border: thinBorder
            };
          }
        }

        if (hasTotals) {
          for (let ci = 0; ci <= lastColIdx; ci++) {
            const isAmount = amountColIdx.includes(ci);
            setStyle(totalsRowIdx, ci, {
              font: { bold: true, sz: 11, color: { rgb: WHITE } },
              fill: { fgColor: { rgb: theme.dark } },
              alignment: { horizontal: isAmount ? 'right' : 'center', vertical: 'center' },
              border: thinBorder
            });
          }
        }

        ws['!freeze'] = { xSplit: 0, ySplit: headerRowIdx + 1, topLeftCell: XLSX.utils.encode_cell({ r: headerRowIdx + 1, c: 0 }), activePane: 'bottomLeft' };
        ws['!view'] = [{ state: 'frozen', ySplit: headerRowIdx + 1 }];
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ r: headerRowIdx, c: 0 }, { r: lastRowIdx, c: lastColIdx }) };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        if (wb.Workbook) wb.Workbook.Sheets = [{ Hidden: 0, TabColor: { rgb: theme.hex } }];
        else wb.Workbook = { Sheets: [{ Hidden: 0, TabColor: { rgb: theme.hex } }] };
        XLSX.writeFile(wb, filename);
      },

      // Turns the current city-filter value into a display label + a
      // filename-safe tag, so a report downloaded while filtered to one city
      // is named after that city (e.g. "CKD-pending-bills.xlsx") instead of
      // always the same generic name — and "All City" when no filter is set.
      _cityExportInfo(city) {
        const label = (!city || city === 'all') ? 'All City' : (String(city).replace(/\s*City$/i, '').trim() || String(city));
        const fileTag = label.replace(/\s+/g, '-');
        return { label, fileTag };
      },

      _exportPDF(rows, columns, filename, title, themeKey) {
        if (!rows || !rows.length) { alert('Export karne ke liye is table mein koi data nahi hai.'); return; }
        if (typeof window.jspdf === 'undefined') { alert('PDF engine load nahi ho saka — internet connection check karke page reload karein.'); return; }
        const theme = this._exportTheme(themeKey);
        const { jsPDF } = window.jspdf;
        const orientation = columns.length > 5 ? 'landscape' : 'portrait';
        const doc = new jsPDF({ orientation });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const amountColIdx = [];
        columns.forEach((c, i) => { if (c.label.toLowerCase().includes('amount')) amountColIdx.push(i); });

        // Branded header banner — colour + icon change per report type so a
        // Pending export looks distinct from a Clear or Mismatch export at a
        // glance, plus a thin accent stripe under the banner for polish.
        doc.setFillColor(...theme.rgb);
        doc.rect(0, 0, pageWidth, 26, 'F');
        doc.setFillColor(...theme.darkRgb);
        doc.rect(0, 26, pageWidth, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(15);
        doc.text(`${theme.icon}  AIRTOUCH WIRELESS`, 14, 12);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10.5);
        doc.text(title || 'Data Report', 14, 19.5);

        doc.setFontSize(8.5);
        const now = new Date();
        doc.text(`Generated: ${now.toLocaleString()}`, pageWidth - 14, 11, { align: 'right' });
        doc.text(`${rows.length} record${rows.length === 1 ? '' : 's'}`, pageWidth - 14, 17, { align: 'right' });

        // Totals footer row — same amount-column sums as the Excel export.
        const foot = [];
        if (amountColIdx.length) {
          const footRow = columns.map((c, i) => {
            if (i === 0) return 'TOTAL';
            if (amountColIdx.includes(i)) {
              const sum = rows.reduce((s, r) => {
                const raw = typeof c.value === 'function' ? c.value(r) : (r[c.value] ?? '');
                const n = Number(raw);
                return s + (isNaN(n) ? 0 : n);
              }, 0);
              return sum.toLocaleString();
            }
            return '';
          });
          foot.push(footRow);
        }

        doc.autoTable({
          startY: 32,
          head: [columns.map(c => c.label)],
          body: rows.map(r => columns.map(c => String(typeof c.value === 'function' ? c.value(r) : (r[c.value] ?? '')))),
          foot: foot.length ? foot : undefined,
          styles: { fontSize: 8.5, cellPadding: 4, lineColor: [217, 226, 236], lineWidth: 0.2, textColor: [30, 41, 59] },
          headStyles: { fillColor: theme.rgb, textColor: 255, fontStyle: 'bold', halign: 'center' },
          footStyles: { fillColor: theme.darkRgb, textColor: 255, fontStyle: 'bold', halign: 'right' },
          alternateRowStyles: { fillColor: theme.lightRgb },
          columnStyles: columns.reduce((acc, c, i) => {
            if (amountColIdx.includes(i)) acc[i] = { halign: 'right', fontStyle: 'bold', textColor: theme.darkRgb };
            return acc;
          }, {}),
          margin: { left: 14, right: 14, bottom: 16 }
        });

        // Footer on every page: page numbers + brand tag
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(140);
          doc.text('AIRTOUCH Billing System', 14, pageHeight - 8);
          doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }

        doc.save(filename);
      },

      exportPending(fmt) {
        // "No Payment Found" bills have their own dedicated page/export now
        // (exportNoPaymentBilling) — this export is only the true "payment
        // received but bill never raised" (Unbilled Sale) cases.
        let rows = ((this.billingAnalysisResults && this.billingAnalysisResults.pending) || []).filter(x => x.reason !== 'no_payment');
        rows = this._filterRowsByCity(rows, this.cityFilters.pending);
        const cityInfo = this._cityExportInfo(this.cityFilters.pending);
        const cols = [
          { label:'User ID', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Pending Amount', value:'pendingAmount' }, { label:'Pending Month', value:'pendingMonth' },
          { label:'Package Date', value:'packageDate' }, { label:'Expiry Date', value:'expiryDate' },
          { label:'By', value: r => r.processedBy || '' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-pending-bills.pdf`, `Pending Bills — ${cityInfo.label}`, 'amber')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-pending-bills.xlsx`, `Pending Bills — ${cityInfo.label}`, 'amber');
      },

      // Billing entries that exist in the Billing Excel but have NO matching
      // payment anywhere in the Sale Report (reason: 'no_payment'). This is a
      // subset of Pending Bills — shown here on its own dedicated page/export.
      exportNoPaymentBilling(fmt) {
        let rows = ((this.billingAnalysisResults && this.billingAnalysisResults.pending) || []).filter(x => x.reason === 'no_payment');
        rows = this._filterRowsByCity(rows, this.cityFilters.nopayment);
        const cityInfo = this._cityExportInfo(this.cityFilters.nopayment);
        const cols = [
          { label:'User ID', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Billing Amount', value:'pendingAmount' }, { label:'Month', value:'pendingMonth' },
          { label:'Package Date', value:'packageDate' }, { label:'Expiry Date', value:'expiryDate' },
          { label:'By', value: r => r.processedBy || '' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-billing-not-in-sale-report.pdf`, `Billing Not Found in Sale Report — ${cityInfo.label}`, 'slate')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-billing-not-in-sale-report.xlsx`, `Billing Not Found in Sale Report — ${cityInfo.label}`, 'slate');
      },

      exportClearBilling(fmt) {
        const rows = this._filterRowsByCity((this.billingAnalysisResults && this.billingAnalysisResults.clear) || [], this.cityFilters.clear);
        const cityInfo = this._cityExportInfo(this.cityFilters.clear);
        const cols = [
          { label:'User ID', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Billing Amount', value: r => (r.billingAmount ?? '') === '' ? '—' : r.billingAmount },
          { label:'Paid Amount', value:'paidAmount' }, { label:'Month', value:'month' },
          { label:'Payment Details', value: r => this._clearPaymentDetail(r) },
          { label:'By', value: r => r.processedBy || '' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-clear-billing.pdf`, `Clear Billing — ${cityInfo.label}`, 'green')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-clear-billing.xlsx`, `Clear Billing — ${cityInfo.label}`, 'green');
      },

      exportMismatchLess(fmt) {
        const rows = this._filterRowsByCity((this.billingAnalysisResults && this.billingAnalysisResults.mismatchLess) || [], this.cityFilters.mismatchLess);
        const cityInfo = this._cityExportInfo(this.cityFilters.mismatchLess);
        const cols = [
          { label:'User ID', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Billing Amount', value:'billingAmount' }, { label:'Paid Amount', value:'paidAmount' },
          { label:'Difference Amount', value:'differenceAmount' }, { label:'Month', value:'month' },
          { label:'By', value: r => r.processedBy || '' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-mismatch-less-payment.pdf`, `Amount Mismatch — Less Payment — ${cityInfo.label}`, 'red')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-mismatch-less-payment.xlsx`, `Amount Mismatch — Less Payment — ${cityInfo.label}`, 'red');
      },

      exportMismatchExtra(fmt) {
        const rows = this._filterRowsByCity((this.billingAnalysisResults && this.billingAnalysisResults.mismatchExtra) || [], this.cityFilters.mismatchExtra);
        const cityInfo = this._cityExportInfo(this.cityFilters.mismatchExtra);
        const cols = [
          { label:'User ID', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Billing Amount', value:'billingAmount' }, { label:'Paid Amount', value:'paidAmount' },
          { label:'Extra Amount', value:'extraAmount' }, { label:'Month', value:'month' },
          { label:'By', value: r => r.processedBy || '' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-mismatch-extra-payment.pdf`, `Amount Mismatch — Extra Payment — ${cityInfo.label}`, 'purple')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-mismatch-extra-payment.xlsx`, `Amount Mismatch — Extra Payment — ${cityInfo.label}`, 'purple');
      },

      exportDuplicates(fmt) {
        // Same-month duplicates span MULTIPLE dates per group (that's the
        // whole point — same user/amount, different day, same month), so
        // there's no single `date` field to export; list all the dates instead.
        const rows = this._filterRowsByCity((this.billingAnalysisResults && (this.billingAnalysisResults.duplicatesMonth || this.billingAnalysisResults.duplicates)) || [], this.cityFilters.duplicates);
        const cityInfo = this._cityExportInfo(this.cityFilters.duplicates);
        const cols = [
          { label:'Type', value:'source' }, { label:'User', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Month', value:'month' },
          { label:'Dates', value: r => (r.dates || []).join(', ') },
          { label:'Amount', value:'amount' }, { label:'Kitni Dafa Mila', value:'count' },
          { label:'Processed By', value: r => (r.processedBy || []).join(', ') }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-duplicate-entries.pdf`, `Same-Month Duplicate Entries — ${cityInfo.label}`, 'purple')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-duplicate-entries.xlsx`, `Same-Month Duplicate Entries — ${cityInfo.label}`, 'purple');
      },

      exportReview(fmt) {
        let rows = ((this.billingAnalysisResults && this.billingAnalysisResults.doubleReview) || []).filter(x => !x.resolved);
        rows = this._filterRowsByCity(rows, this.cityFilters.review);
        const cityInfo = this._cityExportInfo(this.cityFilters.review);
        const cols = [
          { label:'User', value:'userId' }, { label:'City', value: r => this._cityName(r.userId) }, { label:'Current Cycle (Month)', value:'month' },
          { label:'Current Bill Amount', value:'billingAmount' }, { label:'Extra Amount', value:'extraAmount' },
          { label:'Old Pending Cycle', value:'oldPendingMonth' }, { label:'Old Pending Amount', value:'oldPendingAmount' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-double-payment-review.pdf`, `Double Payment — Review Needed — ${cityInfo.label}`, 'blue')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-double-payment-review.xlsx`, `Double Payment — Review Needed — ${cityInfo.label}`, 'blue');
      },

      exportLedger(fmt) {
        const searchInput = document.getElementById('ledger-search');
        const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
        let rows = [];
        if (this.ledgerFilterType !== 'billing') rows = rows.concat(this.saleData.map(r => ({ ...r, _type:'Sale Payment' })));
        if (this.ledgerFilterType !== 'sale') rows = rows.concat(this.billingData.map(r => ({ ...r, _type:'Billing Bill' })));
        if (query) rows = rows.filter(r => String(r.userId||'').toLowerCase().includes(query) || String(r.name||'').toLowerCase().includes(query));
        if (this.ledgerFilterCity && this.ledgerFilterCity !== 'all') rows = rows.filter(r => this._cityName(r.userId) === this.ledgerFilterCity);
        rows.sort((a,b) => String(b.date).localeCompare(String(a.date)));
        const cityInfo = this._cityExportInfo(this.ledgerFilterCity);
        const cols = [
          { label:'Date', value:'date' }, { label:'Type', value:'_type' }, { label:'User ID', value:'userId' },
          { label:'City', value: r => this._cityName(r.userId) },
          { label:'Name', value:'name' }, { label:'Amount', value:'amount' }, { label:'Processed By', value:'processedBy' }
        ];
        fmt === 'pdf' ? this._exportPDF(rows, cols, `${cityInfo.fileTag}-master-ledger.pdf`, `Master Ledger — ${cityInfo.label}`, 'blue')
                      : this._exportExcel(rows, cols, `${cityInfo.fileTag}-master-ledger.xlsx`, `Master Ledger — ${cityInfo.label}`, 'blue');
      },

      _toDateObj(s) {
        if (!s) return null;
        const datePart = String(s).slice(0, 10);
        const d = new Date(datePart + 'T00:00:00Z');
        return isNaN(d.getTime()) ? null : d;
      },
      _addDays(d, n) { return new Date(d.getTime() + n * 86400000); },
      _fmtDate(d) { return d.toISOString().slice(0, 10); },
      _monthLabel(d) { return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }); },

      // ══════════ REAL DASHBOARD STATS ══════════
      // The dashboard/alert cards used to ship with hardcoded placeholder
      // numbers ("12", "Rs. 24,000", "15 Users Expiring Today", etc.) baked
      // directly into the HTML that were never replaced by real data — pure
      // dummy demo content. This computes every one of those numbers from
      // whatever Sale/Billing data has actually been uploaded, and writes
      // 0 / Rs. 0 when nothing has been uploaded yet, instead of fake
      // numbers. Runs on every page load and right after each import.
      _computeTopStats() {
        const todayStr = this._fmtDate(new Date());

        const todayRecharges = this.billingData.filter(r => String(r.date).slice(0, 10) === todayStr);
        const todayCollectionAmt = this.saleData
          .filter(r => String(r.date).slice(0, 10) === todayStr)
          .reduce((s, r) => s + Number(r.amount || 0), 0);

        const expiringToday = this.billingData.filter(r => {
          const d = this._toDateObj(r.date);
          return d && this._fmtDate(this._addDays(d, 30)) === todayStr;
        });

        const allUserIds = new Set([
          ...this.billingData.map(x => String(x.userId).toLowerCase()),
          ...this.saleData.map(x => String(x.userId).toLowerCase())
        ]);

        this._setText(['cnt-today-recharge'], todayRecharges.length.toLocaleString());
        this._setText(['cnt-today-collection'], `Rs. ${todayCollectionAmt.toLocaleString()}`);
        this._setText(['cnt-expiring-today'], expiringToday.length.toLocaleString());
        this._setText(['cnt-total-users'], allUserIds.size.toLocaleString());
        this._setText(['alert-expiring-cnt'], expiringToday.length.toLocaleString());

        // Clear/Pending/Mismatch/Duplicate counts depend on the full
        // matching engine having actually run — until then, show 0 rather
        // than a stale or fake number.
        const r = this.billingAnalysisResults;
        const truePendingCount = r ? r.pending.filter(x => x.reason !== 'no_payment').length : 0;
        this._setText(['cnt-clear-bills'], (r ? r.clear.length : 0).toLocaleString());
        this._setText(['cnt-pending-bills'], truePendingCount.toLocaleString());
        this._setText(['cnt-mismatch-bills'], (r ? (r.mismatchLess.length + r.mismatchExtra.length) : 0).toLocaleString());
        this._setText(['alert-pending-cnt'], truePendingCount.toLocaleString());
        this._setText(['alert-duplicate-cnt'], (r ? (r.duplicatesMonth || []).length : 0).toLocaleString());
        this._setText(['alert-mismatch-cnt'], (r ? (r.mismatchLess.length + r.mismatchExtra.length) : 0).toLocaleString());

        const freeUsersAll = this._freeUsersCount().all;
        this._setText(['cnt-free-users'], freeUsersAll.length.toLocaleString());
        this._setText(['alert-free-users-cnt'], freeUsersAll.length.toLocaleString());
        const freeUsersAmt = freeUsersAll.reduce((s, r) => s + Number(r.amount || 0), 0);
        this._setText(['cnt-free-users-amt'], `Rs. ${freeUsersAmt.toLocaleString()}`);

        this._renderFreeUsers();
      },

      // ══════════ FREE USERS ══════════
      // A user counts as "Free" purely by the word "free" appearing anywhere
      // in their Name — in a Sale Payment row OR a Billing Bill row. This
      // scans both raw datasets directly (not the FIFO/billing-analysis
      // results), so it works even before any verification has been run.
      // Single source of truth for that scan — used by the Free Users page
      // itself, its Excel/PDF export, the Dashboard stat/alert, and the
      // Analytics chart, so all four can never drift out of sync.
      // Every row keeps its original index (_idx) into this.saleData /
      // this.billingData so the same inline-edit path as the Import page
      // (updateImportRecord) can save changes straight back to the source data.
      _freeUsersCount() {
        const isFree = name => String(name || '').toLowerCase().includes('free');

        const saleFree = this.saleData
          .map((r, idx) => ({ ...r, _idx: idx, _type: 'sale' }))
          .filter(r => isFree(r.name));
        const billingFree = this.billingData
          .map((r, idx) => ({ ...r, _idx: idx, _type: 'billing' }))
          .filter(r => isFree(r.name));

        return { all: [...saleFree, ...billingFree], saleFree, billingFree };
      },

      _renderFreeUsers() {
        const { all, saleFree, billingFree } = this._freeUsersCount();

        this._setText(['fu-total-cnt'], all.length.toLocaleString());
        this._setText(['fu-sale-cnt'], saleFree.length.toLocaleString());
        this._setText(['fu-billing-cnt'], billingFree.length.toLocaleString());
        const totalAmt = all.reduce((s, r) => s + Number(r.amount || 0), 0);
        this._setText(['fu-total-amt'], `Rs. ${totalAmt.toLocaleString()}`);

        this._populateCityFilterDropdown('fu-city-filter');
        let rows = this._filterRowsByCity(all, this.cityFilters.freeUsers);
        rows = rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

        this._setHtml(['fu-tbody'], rows.map(r => `
          <tr>
            <td>${r._type === 'sale'
              ? '<span class="badge" style="background:#dbeafe; color:#1d4ed8;">Sale</span>'
              : '<span class="badge" style="background:#ede9fe; color:#7c3aed;">Billing</span>'}</td>
            <td class="font-mono editable-cell" contenteditable="true" spellcheck="false" data-idx="${r._idx}" data-field="date" onblur="AppUI.updateImportRecord('${r._type}', this)">${this._escapeHtml(r.date)}</td>
            <td style="font-weight:800; color:var(--primary);" class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${r._idx}" data-field="userId" onblur="AppUI.updateImportRecord('${r._type}', this)">${this._escapeHtml(r.userId)}</td>
            <td>${this._cityBadge(r.userId)}</td>
            <td class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${r._idx}" data-field="name" onblur="AppUI.updateImportRecord('${r._type}', this)">${this._escapeHtml(r.name)}</td>
            <td class="font-mono">Rs. <span class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${r._idx}" data-field="amount" onblur="AppUI.updateImportRecord('${r._type}', this)">${Number(r.amount)}</span></td>
            <td class="editable-cell" contenteditable="true" spellcheck="false" data-idx="${r._idx}" data-field="processedBy" onblur="AppUI.updateImportRecord('${r._type}', this)">${this._escapeHtml(r.processedBy)}</td>
          </tr>`).join('') || `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">Koi Free User nahi mila — Name field mein "free" likha koi record Sale ya Billing data mein maujood nahi hai.</td></tr>`);
      },

      // Excel/PDF export for the Free Users page, same pattern as every other category.
      exportFreeUsers(fmt) {
        const relabel = { sale: 'Sale Payment', billing: 'Billing Bill' };
        const all = this._filterRowsByCity(
          this._freeUsersCount().all.map(r => ({ ...r, _type: relabel[r._type] })),
          this.cityFilters.freeUsers
        );
        const cityInfo = this._cityExportInfo(this.cityFilters.freeUsers);
        const cols = [
          { label:'Source', value:'_type' }, { label:'Date', value:'date' }, { label:'User ID', value:'userId' },
          { label:'City', value: r => this._cityName(r.userId) }, { label:'Name', value:'name' },
          { label:'Amount', value:'amount' }, { label:'By', value:'processedBy' }
        ];
        fmt === 'pdf' ? this._exportPDF(all, cols, `${cityInfo.fileTag}-free-users.pdf`, `Free Users — ${cityInfo.label}`, 'purple')
                      : this._exportExcel(all, cols, `${cityInfo.fileTag}-free-users.xlsx`, `Free Users — ${cityInfo.label}`, 'purple');
      },

      // Detect EXACT duplicate entries: same User + same Date + same Amount
      // appearing more than once. This is almost always an accidental double
      // entry (same bill/payment typed in twice) — these get REMOVED before
      // analysis runs (see _dedupeExactRecords / runBillingAnalysis).
      _findDuplicateEntries(records, sourceLabel) {
        const groups = new Map();
        for (const r of records) {
          const uid = String(r.userId || '').toLowerCase();
          const d = this._toDateObj(r.date);
          if (!uid || !d || !(r.amount > 0)) continue;
          const key = `${uid}::${this._fmtDate(d)}::${Number(r.amount)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(r);
        }
        const dups = [];
        for (const list of groups.values()) {
          if (list.length > 1) {
            dups.push({
              source: sourceLabel,
              userId: list[0].userId,
              name: list[0].name,
              date: list[0].date,
              amount: list[0].amount,
              count: list.length,
              removedCount: list.length - 1
            });
          }
        }
        return dups;
      },

      // Remove exact duplicates from a record list, keeping the FIRST
      // occurrence of each User+Date+Amount combination and dropping the rest.
      // Rows with a blank user/date/amount are left untouched (not de-duped).
      _dedupeExactRecords(records) {
        const seen = new Set();
        const out = [];
        for (const r of records) {
          const uid = String(r.userId || '').toLowerCase();
          const d = this._toDateObj(r.date);
          if (uid && d && r.amount > 0) {
            const key = `${uid}::${this._fmtDate(d)}::${Number(r.amount)}`;
            if (seen.has(key)) continue; // exact duplicate — drop it
            seen.add(key);
          }
          out.push(r);
        }
        return out;
      },

      // Detect SAME-MONTH duplicate entries: same User + same Amount + same
      // calendar month, but on DIFFERENT dates (e.g. recharged twice in July
      // by mistake, a few days apart). These are only flagged for manual
      // review — never auto-removed, since two genuine payments can
      // legitimately land in the same month.
      _findSameMonthDuplicates(records, sourceLabel) {
        const groups = new Map();
        for (const r of records) {
          const uid = String(r.userId || '').toLowerCase();
          const d = this._toDateObj(r.date);
          if (!uid || !d || !(r.amount > 0)) continue;
          const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
          const key = `${uid}::${monthKey}::${Number(r.amount)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(r);
        }
        const dups = [];
        for (const list of groups.values()) {
          const uniqueDates = new Set(list.map(r => r.date));
          // Same date, same amount = exact duplicate (handled elsewhere) —
          // only flag here when the dates actually differ.
          if (list.length > 1 && uniqueDates.size > 1) {
            // Sort the underlying records by date so `dates` and `processedBy`
            // line up index-for-index (needed to show WHO did each recharge).
            const sortedRecords = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const sortedDates = sortedRecords.map(r => r.date);
            const processedBy = sortedRecords.map(r => (r.processedBy || '').trim() || '—');
            dups.push({
              source: sourceLabel,
              userId: list[0].userId,
              name: list[0].name,
              month: this._monthLabel(this._toDateObj(sortedDates[0])),
              amount: list[0].amount,
              dates: sortedDates,
              processedBy: processedBy,
              count: list.length
            });
          }
        }
        return dups;
      },

      _computeBillingAnalysis(billingRecords, saleRecords, overrides) {
        // Exact User+Date+Amount duplicates are removed BEFORE this function
        // runs (see runBillingAnalysis) — whatever got cleaned up is stashed
        // on `this._lastDuplicateCleanup` purely for the report/banner.
        const duplicatesExact = this._lastDuplicateCleanup
          ? [...this._lastDuplicateCleanup.sale, ...this._lastDuplicateCleanup.billing]
          : [];
        // Same-month (different date) duplicates are only flagged, not removed.
        const duplicatesMonth = [
          ...this._findSameMonthDuplicates(saleRecords, 'Sale Payment'),
          ...this._findSameMonthDuplicates(billingRecords, 'Billing Bill')
        ];

        const billingByUser = new Map();
        for (const r of billingRecords) {
          const uid = r.userId.toLowerCase();
          const d = this._toDateObj(r.date);
          if (!d || !(r.amount > 0)) continue;
          if (!billingByUser.has(uid)) billingByUser.set(uid, []);
          billingByUser.get(uid).push({ userId: r.userId, name: r.name, date: d, amount: r.amount });
        }
        for (const list of billingByUser.values()) list.sort((a, b) => a.date - b.date);

        const paymentsByUser = new Map();
        for (const r of saleRecords) {
          const uid = r.userId.toLowerCase();
          const d = this._toDateObj(r.date);
          if (!d || !(r.amount > 0)) continue;
          if (!paymentsByUser.has(uid)) paymentsByUser.set(uid, []);
          paymentsByUser.get(uid).push({ userId: r.userId, name: r.name, date: d, amount: r.amount, used: 0, processedBy: (r.processedBy || '').trim() });
        }
        for (const list of paymentsByUser.values()) list.sort((a, b) => a.date - b.date);

        const results = {
          clear: [], pending: [], mismatchLess: [], mismatchExtra: [], doubleReview: [],
          duplicates: duplicatesMonth,       // same-month, flagged-only duplicates (shown in UI)
          duplicatesMonth: duplicatesMonth,
          duplicatesExact: duplicatesExact   // exact duplicates already removed (report-only)
        };

        for (const [uid, cycles] of billingByUser.entries()) {
          const payments = paymentsByUser.get(uid) || [];
          const pendingSoFar = [];

          cycles.forEach((cycle, idx) => {
            const cycleId = `${uid}::${this._fmtDate(cycle.date)}::${idx}`;
            // FIX: payment often arrives BEFORE the billing/package date gets entered
            // (customer pays first, staff records the recharge a few days later).
            // Previously windowStart = cycle.date meant any such earlier payment was
            // ignored entirely, wrongly marking an already-paid bill as Pending.
            // Now we also look 10 days back from the package date.
            const windowStart = this._addDays(cycle.date, -10);
            const windowEnd = this._addDays(cycle.date, 30);
            const windowPayments = payments.filter(p => p.date >= windowStart && p.date <= windowEnd && p.used < p.amount);
            // Mark every payment considered here — anything never picked up by
            // ANY billing cycle's window has no bill raised for it at all, and
            // gets flagged as an "Unbilled Sale" pending entry after this loop.
            windowPayments.forEach(p => { p._considered = true; });
            const due = cycle.amount;
            const name = cycle.name || (windowPayments[0] && windowPayments[0].name) || '';
            const base = {
              cycleId, userId: cycle.userId, name, billingAmount: due,
              packageDate: this._fmtDate(cycle.date), expiryDate: this._fmtDate(this._addDays(cycle.date, 30)), month: this._monthLabel(cycle.date)
            };

            if (!windowPayments.length) {
              results.pending.push({ ...base, pendingAmount: due, pendingMonth: base.month, reason: 'no_payment' });
              pendingSoFar.push({ cycleId, remaining: due, base });
              return;
            }

            // SINGLE-PAYMENT MATCHING — a bill is matched against ONE Sale
            // payment, never several payments added together. Two separate
            // Rs. 1000 payments sitting in the same window are almost
            // certainly two separate transactions for two separate bills;
            // summing them into one bill's "Paid Amount" invents a false
            // Extra/Less mismatch and silently swallows the other payment.
            // So: pick the single closest-matching payment for this bill
            // and leave every other payment in the window completely
            // untouched, free for its own bill to claim later.
            let best = windowPayments.find(p => Math.abs((p.amount - p.used) - due) < 0.01); // exact match first
            if (!best) {
              const surplus = windowPayments.filter(p => (p.amount - p.used) > due).sort((a, b) => (a.amount - a.used) - (b.amount - b.used));
              if (surplus.length) best = surplus[0]; // smallest single payment that still fully covers this bill
              else {
                const short = windowPayments.filter(p => (p.amount - p.used) < due).sort((a, b) => (b.amount - b.used) - (a.amount - a.used));
                best = short[0]; // largest single payment available, even though it falls short
              }
            }
            const avail = best.amount - best.used;

            if (Math.abs(avail - due) < 0.01) {
              best.used += due;
              results.clear.push({ ...base, paidAmount: avail, processedBy: best.processedBy });
              return;
            }
            if (avail < due) {
              best.used = best.amount;
              results.mismatchLess.push({ ...base, paidAmount: avail, differenceAmount: due - avail, processedBy: best.processedBy });
              return;
            }

            const extra = avail - due;
            let candidateIdx = -1;
            for (let i = pendingSoFar.length - 1; i >= 0; i--) {
              if (Math.abs(pendingSoFar[i].remaining - extra) < 0.01) { candidateIdx = i; break; }
            }

            if (candidateIdx !== -1) {
              // A package runs for 30 days; if the customer pays a "double"
              // amount after that — enough to cover BOTH this new bill AND
              // their old pending bill exactly — both get cleared
              // automatically. No manual click needed by default. An admin
              // can still override a specific row to 'advance' (treat the
              // extra as an advance recharge, leaving the old bill pending)
              // or 'review' (hold it for manual decision on the Review page)
              // via reviewOverrides, but 'clear_old' is now the default.
              const decision = overrides[cycleId] || 'clear_old';
              const oldCycle = pendingSoFar[candidateIdx];
              if (decision === 'clear_old') {
                best.used = best.amount;
                results.clear.push({ ...base, paidAmount: due, processedBy: best.processedBy });
                const pIdx = results.pending.findIndex(x => x.cycleId === oldCycle.cycleId);
                if (pIdx !== -1) results.pending.splice(pIdx, 1);
                results.clear.push({ ...oldCycle.base, paidAmount: oldCycle.remaining, note: `Cleared via double payment on ${base.packageDate}`, processedBy: best.processedBy });
                pendingSoFar.splice(candidateIdx, 1);
              } else if (decision === 'advance') {
                best.used += due;
                results.clear.push({ ...base, paidAmount: due, processedBy: best.processedBy });
                results.doubleReview.push({ ...base, extraAmount: extra, oldPendingCycleId: oldCycle.cycleId, oldPendingMonth: oldCycle.base.month, oldPendingDate: oldCycle.base.packageDate, oldPendingAmount: oldCycle.remaining, resolved: 'advance_recharge', processedBy: best.processedBy });
                pendingSoFar.push({ cycleId, remaining: 0, base });
              } else {
                results.doubleReview.push({ ...base, extraAmount: extra, oldPendingCycleId: oldCycle.cycleId, oldPendingMonth: oldCycle.base.month, oldPendingDate: oldCycle.base.packageDate, oldPendingAmount: oldCycle.remaining, resolved: null, processedBy: best.processedBy });
              }
              return;
            }

            best.used += due;
            results.mismatchExtra.push({ ...base, paidAmount: avail, extraAmount: extra, processedBy: best.processedBy });
          });
        }

        // ── "UNBILLED SALE" PENDING: payment exists in the Sale report but
        // no Billing entry was ever raised for it within the 30-day window
        // (the payment was never even considered by any billing cycle above).
        // This is the reverse of a normal pending bill: money IS in hand, the
        // bill was simply never entered into the Billing report.
        for (const payments of paymentsByUser.values()) {
          for (const p of payments) {
            if (p._considered) continue;
            const leftover = p.amount - p.used;
            if (leftover > 0.01) {
              const pendingMonth = this._monthLabel(p.date);
              results.pending.push({
                cycleId: `unbilled::${String(p.userId).toLowerCase()}::${this._fmtDate(p.date)}::${leftover}`,
                userId: p.userId,
                name: p.name,
                billingAmount: null,
                pendingAmount: leftover,
                pendingMonth,
                packageDate: this._fmtDate(p.date),
                expiryDate: this._fmtDate(this._addDays(p.date, 30)),
                month: pendingMonth,
                reason: 'unbilled_sale',
                processedBy: p.processedBy
              });
            }
          }
        }

        // ── EXTRA → PENDING FIFO COVERAGE: an "Extra Payment" (Mismatch-Extra)
        // for a user can clear that SAME USER's older Pending bill(s) —
        // treating the extra money like an advance payment. Oldest pending
        // bill first: if the extra amount fully covers it, that pending bill
        // clears and the leftover extra tries to cover the next-oldest one,
        // and so on. e.g. Bill due Rs. 2000, Extra Rs. 4000, and there's one
        // older Pending bill of Rs. 2000 → that pending bill clears using
        // Rs. 2000 of the extra, Rs. 2000 extra remains. If NO pending bill
        // exists for that user (or the extra can't fully cover even the
        // oldest one), nothing changes — the row just stays in Mismatch-Extra.
        const extraPendingMatches = [];
        for (const ex of results.mismatchExtra) {
          const uid = String(ex.userId).toLowerCase();
          const userPending = results.pending
            .filter(p => String(p.userId).toLowerCase() === uid)
            .sort((a, b) => String(a.packageDate).localeCompare(String(b.packageDate))); // oldest first
          const covered = [];
          let remaining = Number(ex.extraAmount);
          for (const p of userPending) {
            const amt = Number(p.pendingAmount);
            if (amt <= remaining + 0.01) { covered.push(p); remaining -= amt; }
            else break; // FIFO — stop at the first one the leftover can't fully cover
          }
          if (covered.length) {
            extraPendingMatches.push({
              extraCycleId: ex.cycleId,
              pendingCycleIds: covered.map(p => p.cycleId),
              userId: ex.userId, name: ex.name,
              totalCovered: covered.reduce((s, p) => s + Number(p.pendingAmount), 0),
              remainingExtra: Math.max(0, remaining),
              count: covered.length
            });
          }
        }
        results.extraPendingMatches = extraPendingMatches;

        // AUTO-APPLY every match found above — no manual click needed.
        // Clears every covered pending bill automatically, then either
        // shrinks the extra row to its leftover amount (if any money is
        // left over) or, if fully used up, moves the extra row itself into
        // "Clear" too. A user can still opt a specific row OUT of this
        // auto-clear (reviewOverrides[cycleId] = 'keep_extra') via the
        // "Undo" button in the UI, in which case it's skipped here and
        // stays as a plain Mismatch-Extra row.
        for (const m of extraPendingMatches) {
          if (overrides[m.extraCycleId] === 'keep_extra') continue;
          const exIdx = results.mismatchExtra.findIndex(x => x.cycleId === m.extraCycleId);
          if (exIdx === -1) continue;
          const ex = results.mismatchExtra[exIdx];

          for (const pcid of m.pendingCycleIds) {
            const pIdx = results.pending.findIndex(x => x.cycleId === pcid);
            if (pIdx === -1) continue; // already cleared by another match — skip safely
            const pend = results.pending[pIdx];
            results.clear.push({ ...pend, paidAmount: pend.pendingAmount, note: `Cleared via double payment (extra amount from ${ex.packageDate})` });
            results.pending.splice(pIdx, 1);
          }

          if (m.remainingExtra > 0.01) {
            results.mismatchExtra[exIdx] = {
              ...ex, extraAmount: m.remainingExtra, paidAmount: Number(ex.billingAmount) + m.remainingExtra,
              note: `Rs. ${m.totalCovered.toLocaleString()} used to clear ${m.count} old pending bill${m.count === 1 ? '' : 's'}; Rs. ${m.remainingExtra.toLocaleString()} extra still left over`
            };
          } else {
            results.mismatchExtra[exIdx] = {
              ...ex, paidAmount: Number(ex.billingAmount) + m.totalCovered,
              note: `Extra Rs. ${m.totalCovered.toLocaleString()} fully used to clear ${m.count} old pending bill${m.count === 1 ? '' : 's'} via double payment`
            };
          }
        }

        this._applyManualCorrections(results);

        // ── EXTRA-PAYMENT BILLS ARE ALSO CLEAR BILLS: a Mismatch — Extra row
        // means the Sale payment fully covered (and exceeded) that bill's own
        // Billing Amount — so that specific bill IS paid/Clear, the "mismatch"
        // is only about the leftover extra money. So besides staying listed
        // on the Mismatch — Extra page (for tracking how much extra came in,
        // and whether it was used to auto-clear any older Pending bill), every
        // Mismatch — Extra row is ALSO added into Clear Billing using the real
        // Sale-report paid amount, so dashboards/reports correctly show the
        // bill itself as Clear rather than unresolved/Pending.
        for (const ex of results.mismatchExtra) {
          results.clear.push({
            ...ex,
            note: ex.note || `Extra Payment Received — Billing Rs. ${Number(ex.billingAmount).toLocaleString()} + Extra Rs. ${Number(ex.extraAmount).toLocaleString()} (Total Paid Rs. ${Number(ex.paidAmount).toLocaleString()})`
          });
        }

        return results;
      },

      // ── MANUAL CORRECTIONS — applies user-driven edits/clears on top of the
      // freshly computed results, every single time analysis re-runs:
      //  1) manualEdits: a Mismatch row (Less or Extra) whose Billing/Paid
      //     amount was hand-corrected on the Mismatch pages. If the corrected
      //     amounts now match, the row moves straight into Clear. If they still
      //     differ, the row is updated in place (and moved to the other
      //     Mismatch list if the correction flipped it from short to extra or
      //     vice-versa).
      //  2) manualClears: a Pending bill hand-marked "Clear" on the Pending
      //     Bills page — pulled out of Pending and pushed into Clear.
      _applyManualCorrections(results) {
        const edits = this.manualEdits || {};
        const editedRows = [
          ...results.mismatchLess.map(r => ({ row: r, key: 'mismatchLess' })),
          ...results.mismatchExtra.map(r => ({ row: r, key: 'mismatchExtra' }))
        ];
        for (const { row, key } of editedRows) {
          const edit = edits[row.cycleId];
          if (!edit) continue;
          const list = results[key];
          const idx = list.findIndex(x => x.cycleId === row.cycleId);
          if (idx === -1) continue; // already moved by an earlier pass
          const billingAmount = edit.billingAmount != null ? Number(edit.billingAmount) : row.billingAmount;
          const paidAmount = edit.paidAmount != null ? Number(edit.paidAmount) : row.paidAmount;
          list.splice(idx, 1);
          const diff = paidAmount - billingAmount;
          if (Math.abs(diff) < 0.01) {
            results.clear.push({ ...row, billingAmount, paidAmount, note: 'Amount manually edit karke correct kiya gaya — automatically Clear ho gaya' });
          } else if (diff < 0) {
            results.mismatchLess.push({ ...row, billingAmount, paidAmount, differenceAmount: Math.abs(diff) });
          } else {
            results.mismatchExtra.push({ ...row, billingAmount, paidAmount, extraAmount: diff });
          }
        }

        const manualClears = this.manualClears || {};
        const manualFrees = this.manualFrees || {};
        for (let i = results.pending.length - 1; i >= 0; i--) {
          const row = results.pending[i];
          // Manual amount edit (from Billing Not In Sale / Pending tables) —
          // applied first so a corrected amount is what actually gets cleared.
          const edit = edits[row.cycleId];
          if (edit && edit.pendingAmount != null) {
            row.pendingAmount = Number(edit.pendingAmount);
            if (row.billingAmount !== null && row.billingAmount !== undefined) row.billingAmount = Number(edit.pendingAmount);
          }
          if (manualFrees[row.cycleId]) {
            results.clear.push({ ...row, paidAmount: 0, isFree: true, note: '🆓 Free User — "Free" button se manually clear kiya gaya' });
            results.pending.splice(i, 1);
            continue;
          }
          if (!manualClears[row.cycleId]) continue;
          results.clear.push({ ...row, paidAmount: row.pendingAmount, note: '"Clear" button se manually clear kiya gaya' });
          results.pending.splice(i, 1);
        }
        return results;
      },

      // Stashes what the last exact-duplicate cleanup removed, so
      // _computeBillingAnalysis can report it without re-scanning.
      _lastDuplicateCleanup: null,

      runBillingAnalysis() {
        if (!this.saleData.length || !this.billingData.length) {
          alert('Pehle dono files (Sale aur Billing) upload karein.');
          return;
        }
        const statusEl = document.getElementById('import-status');
        if (statusEl) statusEl.textContent = 'Running billing analysis...';

        setTimeout(() => {
          // EXACT-DUPLICATE CLEANUP — same User + Date + Amount repeated rows
          // are collapsed to a single row BEFORE any matching happens, so they
          // can't inflate "Clear"/"Extra Payment" totals or FIFO matching.
          const dupSale = this._findDuplicateEntries(this.saleData, 'Sale Payment');
          const dupBilling = this._findDuplicateEntries(this.billingData, 'Billing Bill');
          const removedCount = dupSale.reduce((s, d) => s + d.removedCount, 0) + dupBilling.reduce((s, d) => s + d.removedCount, 0);
          this.saleData = this._dedupeExactRecords(this.saleData);
          this.billingData = this._dedupeExactRecords(this.billingData);
          this._lastDuplicateCleanup = { sale: dupSale, billing: dupBilling, removedCount };

          this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
          this._renderBillingAnalysis();
          if (statusEl) {
            statusEl.textContent = removedCount
              ? `✅ Billing analysis complete. 🧹 ${removedCount} exact-duplicate row${removedCount === 1 ? '' : 's'} removed before matching.`
              : '✅ Billing analysis complete.';
          }
          this._saveState();
        }, 10);
      },

      resolveDoublePayment(cycleId, decision) {
        this.reviewOverrides[cycleId] = decision;
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // Extra-to-pending clearing now happens AUTOMATICALLY (see
      // _computeBillingAnalysis). This just re-enables it for a row that
      // was previously opted out via undoMismatchExtra() below — removes
      // the 'keep_extra' override so the auto-clear picks it back up.
      clearMismatchExtra(cycleId) {
        delete this.reviewOverrides[cycleId];
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // ── EDITABLE MISMATCH TABLES ── User corrects the Billing/Paid amount
      // right inside the table row and hits Save. If the corrected amounts
      // now match, _applyManualCorrections moves the row into Clear on the
      // very next render — no extra click needed.
      saveMismatchEdit(btn) {
        const tr = btn.closest('tr');
        if (!tr) return;
        const cycleId = tr.dataset.cycleId;
        const billingInput = tr.querySelector('.edit-billing-amt');
        const paidInput = tr.querySelector('.edit-paid-amt');
        const billingAmount = parseFloat(billingInput && billingInput.value);
        const paidAmount = parseFloat(paidInput && paidInput.value);
        if (!cycleId || isNaN(billingAmount) || isNaN(paidAmount) || billingAmount < 0 || paidAmount < 0) {
          alert('Sahi amount likhein (0 ya usse zyada).');
          return;
        }
        this.manualEdits[cycleId] = { billingAmount, paidAmount };
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // Reverts a hand-corrected Mismatch row back to its originally computed amounts.
      undoMismatchEdit(cycleId) {
        delete this.manualEdits[cycleId];
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // ── EDITABLE "BILLING NOT IN SALE" / PENDING AMOUNT — single-amount
      // rows (no separate Paid Amount, since no Sale payment was matched).
      // Saves the corrected amount; use the row's ✅ Clear button separately
      // to move it into Clear Billing once it's actually settled.
      savePendingAmountEdit(btn) {
        const tr = btn.closest('tr');
        if (!tr) return;
        const cycleId = tr.dataset.cycleId;
        const input = tr.querySelector('.edit-pending-amt');
        const pendingAmount = parseFloat(input && input.value);
        if (!cycleId || isNaN(pendingAmount) || pendingAmount < 0) {
          alert('Sahi amount likhein (0 ya usse zyada).');
          return;
        }
        this.manualEdits[cycleId] = { ...(this.manualEdits[cycleId] || {}), pendingAmount };
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // ── PENDING BILLS — manual "Clear" button next to each user. Marks
      // that bill Clear and it's automatically added to the Clear Billing
      // list on the very next render.
      clearPendingBill(cycleId) {
        this.manualClears[cycleId] = true;
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // ── PENDING BILLS — manual "🆓 Free" button next to each user. Marks
      // that bill as a Free User: pushed into Clear with paidAmount 0 (no
      // payment actually expected/collected) instead of the pending amount,
      // and a distinct note so it's clear this wasn't a real payment.
      markPendingFree(cycleId) {
        this.manualFrees[cycleId] = true;
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._renderFreeUsers();
        this._saveState();
      },

      // Bulk version — re-enables auto-clear for EVERY Mismatch-Extra row
      // that was manually opted out, in one click.
      clearAllMismatchExtraMatches() {
        const matches = (this.billingAnalysisResults && this.billingAnalysisResults.extraPendingMatches) || [];
        if (!matches.length) {
          alert('Koi bhi Extra Payment kisi Pending bill ko cover nahi karta — clear karne ke liye kuch nahi hai.');
          return;
        }
        for (const m of matches) delete this.reviewOverrides[m.extraCycleId];
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      // Opt a row OUT of auto-clear — sends it back to plain Mismatch-Extra
      // (its extra amount will NOT be used to pay off old pending bills).
      undoMismatchExtra(cycleId) {
        this.reviewOverrides[cycleId] = 'keep_extra';
        this.billingAnalysisResults = this._computeBillingAnalysis(this.billingData, this.saleData, this.reviewOverrides);
        this._renderBillingAnalysis();
        this._saveState();
      },

      _setHtml(ids, html) {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el) el.innerHTML = html;
        }
      },
      _setText(ids, text) {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el) el.textContent = text;
        }
      },
      _setDisplay(ids, value) {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el) el.style.display = value;
        }
      },

      _reasonBadge(reason) {
        if (reason === 'unbilled_sale') return `<span class="badge-reason unbilled-sale">💰 Unbilled Sale</span>`;
        if (reason === 'no_payment') return `<span class="badge-reason no-payment">⏳ No Payment Found</span>`;
        return '';
      },

      // Human-readable "how did this bill clear" text for the Clear Billing
      // page/exports. Rows created via FIFO double-payment review or the
      // auto extra-to-pending match carry a `note`; everything else was a
      // plain exact payment match.
      _clearPaymentDetail(r) {
        return r.note || 'Exact Match — payment poori tarah billing amount ke barabar thi';
      },

      _renderBillingAnalysis() {
        const r = this.billingAnalysisResults;
        if (!r) return;
        const analysisResults = document.getElementById('analysis-results');
        if (analysisResults) analysisResults.style.display = 'block';
        const verifyResults = document.getElementById('verify-results');
        const verifyEmpty = document.getElementById('verify-empty-msg');
        if (verifyResults) verifyResults.style.display = 'block';
        if (verifyEmpty) verifyEmpty.style.display = 'none';

        // "No Payment Found" bills are no longer counted as Pending — they
        // moved fully to their own "Billing Not In Sale" page/stats below.
        // Pending now means only "Unbilled Sale" (payment received, bill
        // never raised).
        const truePending = r.pending.filter(x => x.reason !== 'no_payment');
        const noPaymentBilling = r.pending.filter(x => x.reason === 'no_payment');

        // Fill every per-category city filter dropdown (each id only exists on
        // its own page, so this is safe to call unconditionally everywhere).
        ['pending-city-filter', 'verify-pending-city-filter', 'pg-pending-city-filter'].forEach(id => this._populateCityFilterDropdown(id));
        ['nopayment-city-filter', 'pg-nopayment-city-filter'].forEach(id => this._populateCityFilterDropdown(id));
        ['clear-city-filter', 'pg-clear-city-filter'].forEach(id => this._populateCityFilterDropdown(id));
        ['mismatch-less-city-filter', 'verify-mismatch-less-city-filter', 'pg-mismatch-less-city-filter'].forEach(id => this._populateCityFilterDropdown(id));
        ['mismatch-extra-city-filter', 'verify-mismatch-extra-city-filter', 'pg-mismatch-extra-city-filter'].forEach(id => this._populateCityFilterDropdown(id));
        ['duplicate-city-filter', 'verify-duplicate-city-filter', 'pg-duplicate-city-filter'].forEach(id => this._populateCityFilterDropdown(id));
        ['verify-review-city-filter'].forEach(id => this._populateCityFilterDropdown(id));

        const pendingRows = this._filterRowsByCity(truePending, this.cityFilters.pending);
        const noPaymentRows = this._filterRowsByCity(noPaymentBilling, this.cityFilters.nopayment);
        const clearRows = this._filterRowsByCity(r.clear, this.cityFilters.clear);
        const mismatchLessRows = this._filterRowsByCity(r.mismatchLess, this.cityFilters.mismatchLess);
        const mismatchExtraRows = this._filterRowsByCity(r.mismatchExtra, this.cityFilters.mismatchExtra);

        this._setText(['an-cnt-clear', 'verify-cnt-clear'], r.clear.length.toLocaleString());
        this._setText(['an-cnt-pending', 'verify-cnt-pending', 'pg-pending-cnt'], truePending.length.toLocaleString());
        this._setText(['an-cnt-less', 'verify-cnt-less', 'pg-mismatch-less-cnt'], r.mismatchLess.length.toLocaleString());
        this._setText(['an-cnt-extra', 'verify-cnt-extra', 'pg-mismatch-extra-cnt'], r.mismatchExtra.length.toLocaleString());
        const unresolvedReview = r.doubleReview.filter(x => !x.resolved);
        const reviewRows = this._filterRowsByCity(unresolvedReview, this.cityFilters.review);
        this._setText(['an-cnt-review', 'verify-cnt-review'], unresolvedReview.length.toLocaleString());
        this._setText(['an-cnt-duplicate', 'verify-cnt-duplicate'], (r.duplicatesMonth || []).length.toLocaleString());
        this._setText(['pg-nopayment-cnt'], noPaymentBilling.length.toLocaleString());

        // sync main dashboard stat cards + alert chips too (single source of truth)
        this._computeTopStats();

        // Amount-wise dashboard summary (Rs.)
        const totalClearAmt = r.clear.reduce((s, x) => s + Number(x.paidAmount || 0), 0);
        const totalPendingAmt = truePending.reduce((s, x) => s + Number(x.pendingAmount || 0), 0);
        const totalLessAmt = r.mismatchLess.reduce((s, x) => s + Number(x.differenceAmount || 0), 0);
        const totalExtraAmt = r.mismatchExtra.reduce((s, x) => s + Number(x.extraAmount || 0), 0);
        const totalNoPaymentAmt = noPaymentBilling.reduce((s, x) => s + Number(x.pendingAmount || 0), 0);
        this._setText(['amt-clear'], `Rs. ${totalClearAmt.toLocaleString()}`);
        this._setText(['amt-pending', 'pg-pending-amt'], `Rs. ${totalPendingAmt.toLocaleString()}`);
        this._setText(['amt-mismatch-less', 'pg-mismatch-less-amt'], `Rs. ${totalLessAmt.toLocaleString()}`);
        this._setText(['amt-mismatch-extra', 'pg-mismatch-extra-amt'], `Rs. ${totalExtraAmt.toLocaleString()}`);
        this._setText(['pg-nopayment-amt'], `Rs. ${totalNoPaymentAmt.toLocaleString()}`);

        if (unresolvedReview.length) {
          this._setDisplay(['review-card', 'verify-review-card'], 'block');
          const reviewHtml = reviewRows.map(x => `
            <tr>
              <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}${x.name ? ' — ' + this._escapeHtml(x.name) : ''}</td>
              <td>${this._cityBadge(x.userId)}</td>
              <td>${this._escapeHtml(x.month)} (Rs. ${x.billingAmount.toLocaleString()})</td>
              <td class="font-mono">Rs. ${x.extraAmount.toLocaleString()}</td>
              <td>${this._escapeHtml(x.oldPendingMonth)}</td>
              <td class="font-mono">Rs. ${x.oldPendingAmount.toLocaleString()}</td>
              <td style="white-space:nowrap;">
                <button class="btn btn-green" style="padding:4px 8px; font-size:11px;" onclick="AppUI.resolveDoublePayment('${x.cycleId}','clear_old')">Clear Old Bill</button>
                <button class="btn btn-blue" style="padding:4px 8px; font-size:11px;" onclick="AppUI.resolveDoublePayment('${x.cycleId}','advance')">Advance Recharge</button>
              </td>
            </tr>`).join('');
          this._setHtml(['review-tbody', 'verify-review-tbody'], reviewHtml);
        } else {
          this._setDisplay(['review-card', 'verify-review-card'], 'none');
        }

        this._setText(['pg-clear-cnt'], r.clear.length.toLocaleString());
        this._setText(['pg-clear-amt'], `Rs. ${totalClearAmt.toLocaleString()}`);
        this._setText(['pg-clear-auto-cnt'], r.clear.filter(x => (x.note || '').toLowerCase().includes('extra')).length.toLocaleString());

        const clearEmpty = document.getElementById('clear-billing-empty-msg');
        const clearResults = document.getElementById('clear-billing-results');
        if (clearResults) clearResults.style.display = 'block';
        if (clearEmpty) clearEmpty.style.display = 'none';

        this._setHtml(['pg-clear-tbody'], clearRows.map(x => `
          <tr>
            <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}</td>
            <td>${this._cityBadge(x.userId)}</td>
            <td>${this._escapeHtml(x.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td class="font-mono">${(x.billingAmount === null || x.billingAmount === undefined) ? '<span style="color:var(--text-muted);">—</span>' : 'Rs. ' + Number(x.billingAmount).toLocaleString()}</td>
            <td class="font-mono" style="color:var(--accent-green); font-weight:800;">Rs. ${Number(x.paidAmount).toLocaleString()}</td>
            <td>${this._escapeHtml(x.month)}</td>
            <td style="font-size:12px;">${this._escapeHtml(this._clearPaymentDetail(x))}</td>
            <td>${this._byLabel(x.processedBy) || '<span style="color:var(--text-muted);">—</span>'}</td>
          </tr>`).join(''));

        this._setHtml(['pending-tbody', 'verify-pending-tbody', 'pg-pending-tbody'], pendingRows.map(x => `
          <tr data-cycle-id="${this._escapeHtml(x.cycleId)}">
            <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}</td>
            <td>${this._cityBadge(x.userId)}</td>
            <td>${this._escapeHtml(x.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td class="font-mono"><input type="number" step="0.01" min="0" class="form-control edit-pending-amt" value="${x.pendingAmount}" style="width:92px; padding:3px 6px; font-size:12px;"></td>
            <td>${this._escapeHtml(x.pendingMonth)}</td>
            <td class="font-mono">${x.packageDate}</td>
            <td class="font-mono">${x.expiryDate}</td>
            <td>${this._byLabel(x.processedBy) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td style="white-space:nowrap;">
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px;" onclick="AppUI.savePendingAmountEdit(this)" title="Amount edit karke save karein">💾 Save</button>
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px; margin-left:4px;" onclick="AppUI.clearPendingBill('${x.cycleId}')" title="Is bill ko manually Clear karein — Clear Billing list mein khud-b-khud add ho jayega">✅ Clear</button>
              <button class="btn btn-outline" style="padding:3px 8px; font-size:10.5px; margin-left:4px; border-color:#7c3aed; color:#7c3aed;" onclick="AppUI.markPendingFree('${x.cycleId}')" title="Is user ko Free User mark karke clear karein — koi payment amount nahi lagega">🆓 Free</button>
            </td>
          </tr>`).join(''));

        // Dedicated "Billing Not In Sale Report" page — only reason:'no_payment' rows.
        this._setHtml(['pg-nopayment-tbody'], noPaymentRows.map(x => `
          <tr data-cycle-id="${this._escapeHtml(x.cycleId)}">
            <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}</td>
            <td>${this._cityBadge(x.userId)}</td>
            <td>${this._escapeHtml(x.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td class="font-mono"><input type="number" step="0.01" min="0" class="form-control edit-pending-amt" value="${x.pendingAmount}" style="width:92px; padding:3px 6px; font-size:12px;"></td>
            <td>${this._escapeHtml(x.pendingMonth)}</td>
            <td class="font-mono">${x.packageDate}</td>
            <td class="font-mono">${x.expiryDate}</td>
            <td>${this._byLabel(x.processedBy) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td style="white-space:nowrap;">
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px;" onclick="AppUI.savePendingAmountEdit(this)" title="Amount edit karke save karein">💾 Save</button>
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px; margin-left:4px;" onclick="AppUI.clearPendingBill('${x.cycleId}')" title="Is bill ko manually Clear karein — Clear Billing list mein khud-b-khud add ho jayega">✅ Clear</button>
              <button class="btn btn-outline" style="padding:3px 8px; font-size:10.5px; margin-left:4px; border-color:#7c3aed; color:#7c3aed;" onclick="AppUI.markPendingFree('${x.cycleId}')" title="Is user ko Free User mark karke clear karein — koi payment amount nahi lagega">🆓 Free</button>
            </td>
          </tr>`).join(''));

        this._setHtml(['mismatch-less-tbody', 'verify-mismatch-less-tbody', 'pg-mismatch-less-tbody'], mismatchLessRows.map(x => {
          const edited = !!this.manualEdits[x.cycleId];
          return `
          <tr data-cycle-id="${this._escapeHtml(x.cycleId)}">
            <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}</td>
            <td>${this._cityBadge(x.userId)}</td>
            <td>${this._escapeHtml(x.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td class="font-mono"><input type="number" step="0.01" min="0" class="form-control edit-billing-amt" value="${x.billingAmount}" style="width:92px; padding:3px 6px; font-size:12px;"></td>
            <td class="font-mono"><input type="number" step="0.01" min="0" class="form-control edit-paid-amt" value="${x.paidAmount}" style="width:92px; padding:3px 6px; font-size:12px;"></td>
            <td class="font-mono" style="color:var(--danger); font-weight:800;">Rs. ${x.differenceAmount.toLocaleString()}</td>
            <td>${this._escapeHtml(x.month)}</td>
            <td>${this._byLabel(x.processedBy) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td style="white-space:nowrap;">
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px;" onclick="AppUI.saveMismatchEdit(this)" title="Amount edit karke save karein — barabar ho gaya to khud-b-khud Clear mein chala jayega">💾 Save</button>
              ${edited ? `<button class="btn" style="padding:3px 8px; font-size:10.5px; margin-left:4px;" onclick="AppUI.undoMismatchEdit('${x.cycleId}')" title="Manual edit hatayein">↩ Undo</button>` : ''}
            </td>
          </tr>`;
        }).join(''));

        const extraMatchByCycle = new Map((r.extraPendingMatches || []).map(m => [m.extraCycleId, m]));
        this._setText(['pg-mismatch-extra-match-cnt'], (r.extraPendingMatches || []).length.toLocaleString());
        this._setHtml(['mismatch-extra-tbody', 'verify-mismatch-extra-tbody', 'pg-mismatch-extra-tbody'], mismatchExtraRows.map(x => {
          const match = extraMatchByCycle.get(x.cycleId);
          const optedOut = this.reviewOverrides[x.cycleId] === 'keep_extra';
          let actionHtml = `<span style="color:var(--text-muted); font-size:11.5px;">Koi pending bill cover nahi hoti</span>`;
          if (x.note) {
            // Auto-clear already applied (partial leftover remains here) — offer undo.
            actionHtml = `<span style="color:var(--accent-green); font-size:11.5px;">✅ Auto-clear ho gaya — ${this._escapeHtml(x.note)}</span>
              <button class="btn" style="padding:3px 8px; font-size:10.5px; margin-left:6px;" onclick="AppUI.undoMismatchExtra('${x.cycleId}')" title="Is auto-clear ko wapis alag karein">↩ Undo</button>`;
          } else if (match && optedOut) {
            const billLabel = `${match.count} Pending Bill${match.count === 1 ? '' : 's'} (Rs. ${match.totalCovered.toLocaleString()})`;
            actionHtml = `<span style="color:var(--text-muted); font-size:11.5px;">Manually alag rakha gaya</span>
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px; margin-left:6px;" onclick="AppUI.clearMismatchExtra('${x.cycleId}')" title="Extra amount se ${billLabel} auto-clear karein">✅ Ab Clear Karein</button>`;
          } else if (match) {
            // Should rarely hit — auto-clear runs by default, so a full match without a
            // leftover note means it already merged into "Clear" and won't appear here.
            actionHtml = `<span style="color:var(--accent-green); font-size:11.5px;">✅ Auto-clear ho raha hai</span>`;
          }
          const edited = !!this.manualEdits[x.cycleId];
          return `
          <tr data-cycle-id="${this._escapeHtml(x.cycleId)}">
            <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}</td>
            <td>${this._cityBadge(x.userId)}</td>
            <td>${this._escapeHtml(x.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td class="font-mono"><input type="number" step="0.01" min="0" class="form-control edit-billing-amt" value="${x.billingAmount}" style="width:92px; padding:3px 6px; font-size:12px;"></td>
            <td class="font-mono"><input type="number" step="0.01" min="0" class="form-control edit-paid-amt" value="${x.paidAmount}" style="width:92px; padding:3px 6px; font-size:12px;"></td>
            <td class="font-mono" style="color:var(--purple); font-weight:800;">Rs. ${x.extraAmount.toLocaleString()}</td>
            <td>${this._escapeHtml(x.month)}</td>
            <td>${this._byLabel(x.processedBy) || '<span style="color:var(--text-muted);">—</span>'}</td>
            <td style="white-space:nowrap;">
              ${actionHtml}
              <button class="btn btn-green" style="padding:3px 8px; font-size:10.5px; margin-left:6px;" onclick="AppUI.saveMismatchEdit(this)" title="Amount edit karke save karein — barabar ho gaya to khud-b-khud Clear mein chala jayega">💾 Save</button>
              ${edited ? `<button class="btn" style="padding:3px 8px; font-size:10.5px; margin-left:4px;" onclick="AppUI.undoMismatchEdit('${x.cycleId}')" title="Manual edit hatayein">↩ Undo</button>` : ''}
            </td>
          </tr>`;
        }).join(''));

        // Same-month duplicates (flagged only — not removed, shown for review)
        const duplicatesMonth = r.duplicatesMonth || r.duplicates || [];
        const duplicateRows = this._filterRowsByCity(duplicatesMonth, this.cityFilters.duplicates);
        this._setText(['pg-duplicate-cnt'], duplicatesMonth.length.toLocaleString());
        const totalDuplicateAmt = duplicatesMonth.reduce((s, x) => s + Number(x.amount || 0) * (x.count || 0), 0);
        this._setText(['pg-duplicate-amt'], `Rs. ${totalDuplicateAmt.toLocaleString()}`);
        if (duplicatesMonth.length) {
          this._setDisplay(['duplicate-card', 'verify-duplicate-card', 'pg-duplicate-card'], 'block');
          this._setHtml(['duplicate-tbody', 'verify-duplicate-tbody', 'pg-duplicate-tbody'], duplicateRows.map(x => `
            <tr>
              <td>${this._escapeHtml(x.source)}</td>
              <td style="font-weight:800; color:var(--primary);">${this._escapeHtml(x.userId)}</td>
              <td>${this._cityBadge(x.userId)}</td>
              <td>${this._escapeHtml(x.name) || '<span style="color:var(--text-muted);">—</span>'}</td>
              <td>${this._escapeHtml(x.month)}</td>
              <td class="font-mono">${(x.dates || []).map(d => this._fmtDate(this._toDateObj(d))).join(', ')}</td>
              <td class="font-mono">Rs. ${Number(x.amount).toLocaleString()}</td>
              <td style="font-weight:800; color:var(--warning);">${x.count}x</td>
              <td>${(x.processedBy || []).map(p => this._byLabel(p)).filter(Boolean).join(', ')}</td>
            </tr>`).join(''));
        } else {
          this._setDisplay(['duplicate-card', 'verify-duplicate-card', 'pg-duplicate-card'], 'none');
        }

        // Exact duplicates that were auto-removed before this analysis ran
        // (report-only note — the rows are already gone from saleData/billingData)
        const duplicatesExact = r.duplicatesExact || [];
        const exactNote = document.getElementById('duplicate-exact-note');
        if (exactNote) {
          if (duplicatesExact.length) {
            const removed = duplicatesExact.reduce((s, x) => s + (x.removedCount || (x.count - 1)), 0);
            exactNote.style.display = 'flex';
            exactNote.innerHTML = `<span class="info-banner-icon">🧹</span><span><strong>${removed} exact-duplicate row${removed === 1 ? '' : 's'}</strong> (same User + Date + Amount repeated) ${removed === 1 ? 'was' : 'were'} auto-removed before this analysis ran.</span>`;
          } else {
            exactNote.style.display = 'none';
          }
        }
      },

      saveBillingEdit(event) {
        event.preventDefault();
        alert('Billing record saved successfully!');
      },

      // Live City preview under the User ID field on the Edit Billing page.
      updateEditBillingCity(userId) {
        const el = document.getElementById('edit-userid-city');
        if (!el) return;
        el.innerHTML = userId.trim() ? this._cityBadge(userId) : '';
      },

      runSync() { alert('Syncing completed!'); },
      filterTable(type) {},

      // ══════════ REAL ANALYTICS ENGINE ══════════
      // This used to ship with hardcoded demo numbers (Rs. 2.45M, a fixed
      // Jan-Jul revenue line, a fixed 1020/180/50/20 doughnut) that never
      // reflected the data actually uploaded. Everything below is computed
      // live from this.saleData / this.billingData / this.billingAnalysisResults,
      // same as the dashboard's _computeTopStats(). Shows zeros until real
      // data exists instead of fake figures.
      _computeAnalyticsStats() {
        const r = this.billingAnalysisResults;
        const thisYear = new Date().getUTCFullYear();

        const totalRevenue = this.saleData
          .filter(s => { const d = this._toDateObj(s.date); return d && d.getUTCFullYear() === thisYear; })
          .reduce((sum, s) => sum + Number(s.amount || 0), 0);

        const clearCount = r ? r.clear.length : 0;
        const pendingCount = r ? r.pending.length : 0;
        const mismatchCount = r ? (r.mismatchLess.length + r.mismatchExtra.length) : 0;
        const totalBills = clearCount + pendingCount + mismatchCount;
        const collectionRate = totalBills ? Math.round((clearCount / totalBills) * 1000) / 10 : 0;

        const outstandingDues = r
          ? r.pending.reduce((s, x) => s + Number(x.pendingAmount || 0), 0) +
            r.mismatchLess.reduce((s, x) => s + Number(x.differenceAmount || 0), 0)
          : 0;

        const freeUsersCount = this._freeUsersCount().all.length;

        this._setText(['an-total-revenue'], `Rs. ${totalRevenue.toLocaleString()}`);
        this._setText(['an-collection-rate'], `${collectionRate}%`);
        this._setText(['an-outstanding-dues'], `Rs. ${outstandingDues.toLocaleString()}`);
        this._setText(['an-cnt-free-users'], freeUsersCount.toLocaleString());
        this._setText(['an-revenue-chart-title'], `📈 Revenue & Collection Growth (${thisYear})`);

        return { clearCount, pendingCount, mismatchCount, freeUsersCount, r };
      },

      initCharts() {
        this.chartsInitialized = true;
        const stats = this._computeAnalyticsStats();

        // Build last-6-months revenue trend from real Sale Payment data.
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
          months.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), total: 0 });
        }
        this.saleData.forEach(s => {
          const d = this._toDateObj(s.date);
          if (!d) return;
          const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
          const m = months.find(x => x.key === key);
          if (m) m.total += Number(s.amount || 0);
        });

        const elRev = document.getElementById('chartRevenueTrend');
        const elStatus = document.getElementById('chartStatusDistribution');

        if (this._chartRevenue) this._chartRevenue.destroy();
        if (this._chartStatus) this._chartStatus.destroy();

        if (elRev) {
          this._chartRevenue = new Chart(elRev.getContext('2d'), {
            type: 'line',
            data: {
              labels: months.map(m => m.label),
              datasets: [{
                label: 'Collections',
                data: months.map(m => m.total),
                borderColor: '#0b51b7',
                backgroundColor: 'rgba(11, 81, 183, 0.12)',
                fill: true
              }]
            }
          });
        }

        if (elStatus) {
          this._chartStatus = new Chart(elStatus.getContext('2d'), {
            type: 'doughnut',
            data: {
              labels: ['Clear', 'Pending', 'Mismatch', 'Duplicates', 'Free Users'],
              datasets: [{
                data: [stats.clearCount, stats.pendingCount, stats.mismatchCount, (stats.r ? (stats.r.duplicatesMonth || []).length : 0), stats.freeUsersCount],
                backgroundColor: ['#119445', '#d97706', '#dc2626', '#334155', '#7c3aed']
              }]
            }
          });
        }
      }
    };