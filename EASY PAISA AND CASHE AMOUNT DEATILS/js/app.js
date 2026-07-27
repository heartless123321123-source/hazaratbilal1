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

            // Ledger starts blank — no demo/seed rows are injected.

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

    function applyFiltersAndRender() {
        SearchFilter.execute();
    }

    function wireEvents() {
        // Filters
        document.getElementById("accPicker").addEventListener("change", () => {
            SettingsPanel.rememberLastFilters();
            SearchFilter.execute();
        });
        const cityPicker = document.getElementById("cityPicker");
        if (cityPicker) {
            cityPicker.addEventListener("change", () => {
                SettingsPanel.rememberLastFilters();
                SearchFilter.execute();
            });
        }
        const searchBox = document.getElementById("searchBox");
        if (searchBox) searchBox.addEventListener("input", () => SearchFilter.execute());

        const dupTxnIdToggle = document.getElementById("dupTxnIdToggle");
        if (dupTxnIdToggle) dupTxnIdToggle.addEventListener("change", () => SearchFilter.execute());

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
function executeValidationCheck() { SearchFilter.execute(); }
function clearValidationFilters() { SearchFilter.clearFilters(); }
function openBulkModal() { BulkEntry.openModal(); }
function closeBulkModal() { BulkEntry.closeModal(); }
function triggerExcelImport() { ExcelImport.triggerPicker(); }
function exportLedger() { ExportEngine.exportToExcel(); }
function wipeLedger() { SettingsPanel.wipeAllData(); }

window.addEventListener("DOMContentLoaded", () => App.init());
