/**
 * app.js
 * -----------------------------------------------------------
 * Main entry point. Boots IndexedDB, loads all saved records
 * into memory (App.activeDataset), renders Table + Dashboard,
 * and wires up every button in index.html to its module.
 *
 * Flow this file drives:
 *   Scan Screenshot ─┐
 *   Manual Entry    ─┼─> entry.js ─> database.js ─> table.js
 *                     │              + dashboard.js + export.js
 * -----------------------------------------------------------
 */

const App = (function () {

    let activeDataset = [];

    async function init() {
        try {
            await LedgerDB.openDB();
            activeDataset = await LedgerDB.getAllEntries();

            // First-ever run: seed a few demo rows so the UI isn't empty
            if (activeDataset.length === 0 && !AppStorage.getSetting("seeded", false)) {
                await seedDemoData();
                activeDataset = await LedgerDB.getAllEntries();
                AppStorage.setSetting("seeded", true);
            }

            // Newest first
            activeDataset.sort((a, b) => (b.id || 0) - (a.id || 0));
        } catch (err) {
            console.error("Failed to initialize database:", err);
            alert("Could not open local database. Some browsers block IndexedDB in private mode.");
        }

        SettingsPanel.restoreLastFilters();
        applyFiltersAndRender();
        wireEvents();
        BulkEntry.wireEvents();

        // Pull in anything scanned + exported from the AirTouch Scan Ledger page
        await importScanLedgerHandoff();
        window.addEventListener("focus", importScanLedgerHandoff);
    }

    /**
     * Picks up records queued by AirTouch-Web.html's "Export" button
     * (written to localStorage key 'airtouch_pending_import') and
     * commits them straight into the Master Spreadsheet, same as
     * Excel Import. Runs on load and whenever this tab regains focus,
     * so switching back from the scan page auto-syncs new records.
     */
    async function importScanLedgerHandoff() {
        let queued;
        try {
            queued = JSON.parse(localStorage.getItem("airtouch_pending_import") || "[]");
        } catch (err) {
            console.error("Could not read scan-ledger hand-off data:", err);
            return;
        }
        if (!Array.isArray(queued) || queued.length === 0) return;

        const count = await EntryManager.commitExcelEntries(queued);
        localStorage.removeItem("airtouch_pending_import");
        alert(`${count} record(s) scan ledger se import ho gaye — Master Spreadsheet update ho chuki hai.`);
    }

    async function seedDemoData() {
        const demo = [
            { date: "18-07-2026", time: "02:15 PM", name: "Alpha Link Wireless", account: "Fazal Amin", city: "WT", amount: 48000, sender: "Alpha Link Wireless", transactionId: "TXN10001", customerId: "", status: "Confirmed", screenshotPath: "", createdTime: new Date().toISOString() },
            { date: "18-07-2026", time: "11:30 AM", name: "Mardan Fiber Core", account: "Airtouch soneri", city: "THA, ALD", amount: 125000, sender: "Mardan Fiber Core", transactionId: "TXN10002", customerId: "", status: "Confirmed", screenshotPath: "", createdTime: new Date().toISOString() },
            { date: "17-07-2026", time: "06:10 PM", name: "Chakdara Client Hub", account: "bank alhabib", city: "CKD", amount: 32000, sender: "Chakdara Client Hub", transactionId: "TXN10003", customerId: "", status: "Confirmed", screenshotPath: "", createdTime: new Date().toISOString() },
            { date: "16-07-2026", time: "09:45 AM", name: "Malakand Tower Lease", account: "Muhammad Tayyab", city: "KOT, SHM", amount: 89000, sender: "Malakand Tower Lease", transactionId: "TXN10004", customerId: "", status: "Confirmed", screenshotPath: "", createdTime: new Date().toISOString() }
        ];
        for (const rec of demo) {
            await LedgerDB.addEntry(rec);
        }
    }

    function applyFiltersAndRender() {
        SearchFilter.execute();
    }

    function wireEvents() {
        // Filters
        document.getElementById("accPicker").addEventListener("change", () => {
            SettingsPanel.rememberLastFilters();
            SearchFilter.execute();
        });
        document.getElementById("cityPicker").addEventListener("change", () => {
            SettingsPanel.rememberLastFilters();
            SearchFilter.execute();
        });
        const searchBox = document.getElementById("searchBox");
        if (searchBox) searchBox.addEventListener("input", () => SearchFilter.execute());

        // Scan modal — file picker + drag/drop
        const fileInput = document.getElementById("scanFileInput");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) Scanner.handleFileChosen(e.target.files[0]);
            });
        }

        const dropzone = document.getElementById("scanDropzone");
        if (dropzone) {
            dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
            dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
            dropzone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropzone.classList.remove("dragover");
                if (e.dataTransfer.files && e.dataTransfer.files[0]) Scanner.handleFileChosen(e.dataTransfer.files[0]);
            });
        }

        // Excel Import — hidden file input
        const excelInput = document.getElementById("excelImportInput");
        if (excelInput) {
            excelInput.addEventListener("change", (e) => {
                if (e.target.files && e.target.files[0]) ExcelImport.handleFileChosen(e.target.files[0]);
            });
        }
    }

    return {
        init,
        applyFiltersAndRender,
        get activeDataset() { return activeDataset; },
        set activeDataset(val) { activeDataset = val; }
    };
})();

/* ---------- Global bridge functions referenced by onclick= in index.html ---------- */
function commitNewEntry() { EntryManager.commitManualEntry(); }
function commitScanEntry() { EntryManager.commitScannedEntry(); }
function executeValidationCheck() { SearchFilter.execute(); }
function clearValidationFilters() { SearchFilter.clearFilters(); }
function openScanModal() { Scanner.openModal(); }
function closeScanModal() { Scanner.closeModal(); }
function openBulkModal() { BulkEntry.openModal(); }
function closeBulkModal() { BulkEntry.closeModal(); }
function triggerExcelImport() { ExcelImport.triggerPicker(); }
function exportLedger() { ExportEngine.exportToExcel(); }
function wipeLedger() { SettingsPanel.wipeAllData(); }

window.addEventListener("DOMContentLoaded", () => App.init());
