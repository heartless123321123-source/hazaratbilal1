/**
 * database.js
 * -----------------------------------------------------------
 * IndexedDB wrapper — persistent local storage for every
 * ledger record (Manual Entry, Scan, WhatsApp Bulk, Excel
 * Import all funnel through here). This is what makes the
 * "Realtime Master Spreadsheet" survive a page refresh.
 * -----------------------------------------------------------
 */

const LedgerDB = (function () {

    const DB_NAME = "airtouch_ledger_db";
    const DB_VERSION = 1;
    const STORE_NAME = "entries";

    let db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }

            if (!("indexedDB" in window)) {
                reject(new Error("IndexedDB not supported in this browser."));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const _db = event.target.result;
                if (!_db.objectStoreNames.contains(STORE_NAME)) {
                    const store = _db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                    store.createIndex("transactionId", "transactionId", { unique: false });
                    store.createIndex("account", "account", { unique: false });
                    store.createIndex("city", "city", { unique: false });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    function addEntry(record) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.add(record);
            req.onsuccess = () => resolve(req.result); // new id
            req.onerror = () => reject(req.error);
        });
    }

    function updateEntry(record) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(record);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function getAllEntries() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    function findByTransactionId(txnId) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const index = store.index("transactionId");
            const req = index.getAll(txnId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    function deleteEntry(id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    function clearAll() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    return { openDB, addEntry, updateEntry, getAllEntries, findByTransactionId, deleteEntry, clearAll };
})();
