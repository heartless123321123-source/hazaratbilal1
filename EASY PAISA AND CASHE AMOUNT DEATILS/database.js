/**
 * database.js
 * -----------------------------------------------------------
 * IndexedDB layer for the ledger. Every saved transaction
 * (manual OR scanned) is stored here as one record:
 *
 *   { id, amount, date, time, name, account, city,
 *     sender, transactionId, customerId, status,
 *     screenshotPath, createdTime }
 * -----------------------------------------------------------
 */

const LedgerDB = (function () {
    const DB_NAME = "AirTouchLedgerDB";
    const DB_VERSION = 1;
    const STORE = "entries";

    let dbInstance = null;

    /**
     * Forces every text field to be a real string (never a number,
     * null, or undefined) before it ever touches IndexedDB.
     * This is the fix for the "(r.transactionId || "").trim is not
     * a function" crash — that happens when transactionId (or any
     * similar field) got saved as a number (e.g. from Excel import
     * or OCR parsing) instead of a string.
     */
    function sanitizeEntry(entry) {
        const toStr = (v) => (v === null || v === undefined) ? "" : String(v).trim();
        return {
            ...entry,
            name: toStr(entry.name),
            account: toStr(entry.account),
            city: toStr(entry.city),
            sender: toStr(entry.sender),
            transactionId: toStr(entry.transactionId),
            customerId: toStr(entry.customerId),
            status: toStr(entry.status),
            date: toStr(entry.date),
            time: toStr(entry.time),
            amount: (entry.amount === null || entry.amount === undefined || entry.amount === "")
                ? 0
                : Number(entry.amount)
        };
    }

    function openDB() {
        if (dbInstance) return Promise.resolve(dbInstance);

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
                    store.createIndex("transactionId", "transactionId", { unique: false });
                    store.createIndex("account", "account", { unique: false });
                    store.createIndex("city", "city", { unique: false });
                    store.createIndex("date", "date", { unique: false });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (event) => {
                console.error("IndexedDB open failed:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function addEntry(entry) {
        const db = await openDB();
        const safeEntry = sanitizeEntry(entry);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);
            const req = store.add(safeEntry);
            req.onsuccess = () => resolve(req.result); // returns new id
            req.onerror = () => reject(req.error);
        });
    }

    async function updateEntry(entry) {
        const db = await openDB();
        const safeEntry = sanitizeEntry(entry);
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);
            const req = store.put(safeEntry);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteEntry(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            const store = tx.objectStore(STORE);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllEntries() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly");
            const store = tx.objectStore(STORE);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    /** Duplicate check — used before saving a scanned entry */
    async function findByTransactionId(transactionId) {
        if (!transactionId) return [];
        const all = await getAllEntries();
        return all.filter(e => e.transactionId && e.transactionId.trim() === transactionId.trim());
    }

    async function clearAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    return {
        openDB,
        addEntry,
        updateEntry,
        deleteEntry,
        getAllEntries,
        findByTransactionId,
        clearAll
    };
})();
