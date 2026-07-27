/**
 * airtouch_store.js — Shared Central Data Store
 * ================================================
 * ONE localStorage key for all pages.
 * Purchase → stock UP, Dispatch → stock DOWN, Ledger → full history
 *
 * Include this script in ALL pages BEFORE page-specific scripts:
 *   <script src="airtouch_store.js"></script>
 */

const AirTouchStore = (() => {

    const KEYS = {
        items:     'at_items',
        purchases: 'at_purchases',
        dispatches:'at_dispatches',
        ledger:    'at_ledger'
    };

    // ── Default Items ─────────────────────────────────────────
    // Intentionally empty — no demo/fake items should be seeded.
    // Real inventory should only come from what the user adds themselves.
    const DEFAULT_ITEMS = [];

    let _items     = null;
    let _purchases = null;
    let _dispatches= null;
    let _ledger    = null;

    // ── Load / Save ─────────────────────────────────────────
    function load(key, def) {
        try {
            const v = localStorage.getItem(key);
            return v ? JSON.parse(v) : def;
        } catch { return def; }
    }

    function save(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    }

    function init() {
        _items      = load(KEYS.items,     DEFAULT_ITEMS);
        _purchases  = load(KEYS.purchases, []);
        _dispatches = load(KEYS.dispatches,[]);
        _ledger     = load(KEYS.ledger,    []);
    }

    function saveAll() {
        save(KEYS.items,     _items);
        save(KEYS.purchases, _purchases);
        save(KEYS.dispatches,_dispatches);
        save(KEYS.ledger,    _ledger);
    }

    // ── Item CRUD ────────────────────────────────────────────
    function getItems() { return _items; }

    function getItemById(id) { return _items.find(i => i.id == id); }

    function addItem(item) {
        const newId = Math.max(0, ..._items.map(i => i.id)) + 1;
        const newItem = { id: newId, stock: 0, ...item };
        _items.push(newItem);
        saveAll();
        return newItem;
    }

    function updateItem(id, updates) {
        const idx = _items.findIndex(i => i.id == id);
        if (idx === -1) return false;
        Object.assign(_items[idx], updates);
        saveAll();
        return true;
    }

    function deleteItem(id) {
        _items = _items.filter(i => i.id != id);
        saveAll();
    }

    // ── PURCHASE (Stock IN) ─────────────────────────────────
    function recordPurchase(supplier, invoiceNum, date, lines, remarks) {
        const purchaseId = 'PUR-' + Date.now();
        const grandTotal = lines.reduce((s, l) => s + (l.qty * l.unitCost), 0);

        const purchase = {
            id: purchaseId, supplier, invoiceNum, date, lines, remarks,
            grandTotal, createdAt: new Date().toISOString()
        };

        _purchases.unshift(purchase);

        // Update stock + add to ledger
        lines.forEach(line => {
            const item = _items.find(i => i.id == line.itemId);
            if (!item) return;
            item.stock += line.qty;
            if (line.unitCost > 0) item.purchase = line.unitCost;
            item.updated = date;
            _ledger.unshift({
                id: 'TXN-' + Date.now() + '-' + line.itemId,
                type: 'PURCHASE',
                itemId: line.itemId,
                itemCode: item.code,
                itemName: item.name,
                qty: +line.qty,
                reference: purchaseId,
                invoiceNum,
                supplier,
                date,
                remarks: remarks || ''
            });
        });

        saveAll();
        return purchase;
    }

    // ── DISPATCH (Stock OUT) ────────────────────────────────
    function recordDispatch(city, employee, date, lines, remarks) {
        const batchRef = 'DSP-' + Date.now();
        const records  = [];

        // Validate stock first
        for (const line of lines) {
            const item = _items.find(i => i.id == line.itemId);
            if (!item) throw new Error(`Item ID ${line.itemId} not found.`);
            if (item.stock < line.qty) throw new Error(`"${item.name}" — only ${item.stock} in stock, need ${line.qty}.`);
        }

        lines.forEach(line => {
            const item = _items.find(i => i.id == line.itemId);
            item.stock -= line.qty;
            item.updated = date;

            const rec = {
                id: 'D-' + Date.now() + '-' + line.itemId,
                batchRef, city, employee, date,
                itemId: line.itemId, itemCode: item.code, itemName: item.name,
                qty: line.qty, remarks: remarks || '',
                createdAt: new Date().toISOString()
            };
            _dispatches.unshift(rec);
            records.push(rec);

            _ledger.unshift({
                id: 'TXN-' + Date.now() + '-' + line.itemId,
                type: 'DISPATCH',
                itemId: line.itemId,
                itemCode: item.code,
                itemName: item.name,
                qty: -line.qty,
                reference: batchRef,
                city, employee, date,
                remarks: remarks || ''
            });
        });

        saveAll();
        return records;
    }

    // ── LEDGER ───────────────────────────────────────────────
    function getLedger(filters = {}) {
        let rows = _ledger;
        if (filters.type)   rows = rows.filter(r => r.type === filters.type);
        if (filters.itemId) rows = rows.filter(r => r.itemId == filters.itemId);
        if (filters.search) {
            const s = filters.search.toLowerCase();
            rows = rows.filter(r =>
                (r.itemName||'').toLowerCase().includes(s) ||
                (r.reference||'').toLowerCase().includes(s) ||
                (r.type||'').toLowerCase().includes(s)
            );
        }
        return rows;
    }

    function getPurchases() { return _purchases; }
    function getDispatches() { return _dispatches; }

    // ── Stock Summary ────────────────────────────────────────
    function getStockSummary() {
        const totalItems = _items.length;
        const totalQty   = _items.reduce((s, i) => s + (i.stock || 0), 0);
        const totalValue = _items.reduce((s, i) => s + ((i.stock || 0) * (i.purchase || 0)), 0);
        const lowStock   = _items.filter(i => i.stock <= i.minStock).length;
        const outOfStock = _items.filter(i => i.stock === 0).length;
        return { totalItems, totalQty, totalValue, lowStock, outOfStock };
    }

    // ── Reset (for testing) ─────────────────────────────────
    function resetAll() {
        _items      = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
        _purchases  = [];
        _dispatches = [];
        _ledger     = [];
        saveAll();
    }

    // ── DISPATCH EDIT / REVERSE (additive only — does not touch
    //    recordPurchase/recordDispatch above, so purchase.html and the
    //    normal "new dispatch" flow are unaffected) ──────────────────
    function _removeLedgerEntry(batchRef, itemId, qty) {
        const idx = _ledger.findIndex(r => r.type === 'DISPATCH' && r.reference === batchRef && r.itemId == itemId && r.qty === -qty);
        if (idx !== -1) _ledger.splice(idx, 1);
    }

    // Returns one dispatch line's stock to inventory and removes that line
    // (and its matching ledger entry) permanently.
    function reverseDispatchLine(dispatchId) {
        const idx = _dispatches.findIndex(d => d.id === dispatchId);
        if (idx === -1) return false;
        const d = _dispatches[idx];
        const item = _items.find(i => i.id == d.itemId);
        if (item) item.stock += d.qty;
        _removeLedgerEntry(d.batchRef, d.itemId, d.qty);
        _dispatches.splice(idx, 1);
        saveAll();
        return true;
    }

    // Reverses every line in a trip (batchRef) — used by "Clear Data".
    function reverseDispatchBatch(batchRef) {
        const rows = _dispatches.filter(d => d.batchRef === batchRef);
        rows.forEach(d => {
            const item = _items.find(i => i.id == d.itemId);
            if (item) item.stock += d.qty;
            _removeLedgerEntry(batchRef, d.itemId, d.qty);
        });
        _dispatches = _dispatches.filter(d => d.batchRef !== batchRef);
        saveAll();
        return rows;
    }

    // Replaces an existing trip's lines in place (same batchRef kept),
    // giving back the old stock first so the new lines validate against
    // true availability — same rule recordDispatch enforces for new trips.
    function updateDispatchBatch(batchRef, city, employee, date, lines, remarks) {
        const oldRows = _dispatches.filter(d => d.batchRef === batchRef);
        oldRows.forEach(d => { const item = _items.find(i => i.id == d.itemId); if (item) item.stock += d.qty; });

        const restoreOld = () => oldRows.forEach(d => { const item = _items.find(i => i.id == d.itemId); if (item) item.stock -= d.qty; });

        for (const line of lines) {
            const item = _items.find(i => i.id == line.itemId);
            if (!item) { restoreOld(); throw new Error(`Item ID ${line.itemId} not found.`); }
            if (item.stock < line.qty) { restoreOld(); throw new Error(`"${item.name}" — only ${item.stock} in stock, need ${line.qty}.`); }
        }

        oldRows.forEach(d => _removeLedgerEntry(batchRef, d.itemId, d.qty));
        _dispatches = _dispatches.filter(d => d.batchRef !== batchRef);

        const records = [];
        lines.forEach(line => {
            const item = _items.find(i => i.id == line.itemId);
            item.stock -= line.qty;
            item.updated = date;
            const rec = {
                id: 'D-' + Date.now() + '-' + line.itemId + '-' + Math.random().toString(36).slice(2, 6),
                batchRef, city, employee, date,
                itemId: line.itemId, itemCode: item.code, itemName: item.name,
                qty: line.qty, remarks: remarks || '',
                createdAt: new Date().toISOString()
            };
            _dispatches.unshift(rec);
            records.push(rec);
            _ledger.unshift({
                id: 'TXN-' + Date.now() + '-' + line.itemId,
                type: 'DISPATCH', itemId: line.itemId, itemCode: item.code, itemName: item.name,
                qty: -line.qty, reference: batchRef, city, employee, date, remarks: remarks || ''
            });
        });

        saveAll();
        return records;
    }

    // Clears the shared transaction history log only — item.stock values are
    // untouched (they're stored directly on each item, not derived from this
    // log), so this is safe to expose without affecting recordPurchase/
    // recordDispatch or any other existing function.
    function clearLedger(){
        _ledger = [];
        saveAll();
    }

    // Boot
    init();

    return {
        getItems, getItemById, addItem, updateItem, deleteItem,
        recordPurchase, recordDispatch,
        reverseDispatchLine, reverseDispatchBatch, updateDispatchBatch,
        getLedger, clearLedger, getPurchases, getDispatches,
        getStockSummary, resetAll
    };
})();
