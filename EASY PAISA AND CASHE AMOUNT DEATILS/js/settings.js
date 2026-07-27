/**
 * settings.js
 * -----------------------------------------------------------
 * Remembers the last-used sidebar filters across page loads,
 * and handles the "Wipe Local Ledger" danger-zone button.
 * -----------------------------------------------------------
 */

const SettingsPanel = (function () {

    function el(id) { return document.getElementById(id); }

    function rememberLastFilters() {
        AppStorage.setSetting("lastAccPicker", el("accPicker").value);
        if (el("cityPicker")) AppStorage.setSetting("lastCityPicker", el("cityPicker").value);
    }

    function restoreLastFilters() {
        const acc = AppStorage.getSetting("lastAccPicker", "");
        if (acc && el("accPicker")) el("accPicker").value = acc;
        const city = AppStorage.getSetting("lastCityPicker", "");
        if (city && el("cityPicker")) el("cityPicker").value = city;
    }

    async function wipeAllData() {
        const proceed = confirm(
            "⚠ Yeh action LOCAL ledger ke tamam records permanently delete kar dega. Yeh undo nahi ho sakta. Continue karein?"
        );
        if (!proceed) return;

        try {
            await LedgerDB.clearAll();
            App.activeDataset = [];
            App.applyFiltersAndRender();
            alert("Local ledger wipe ho gaya.");
        } catch (err) {
            console.error("wipeAllData failed:", err);
            alert("Wipe karte waqt error aayi — console check karein.");
        }
    }

    return { rememberLastFilters, restoreLastFilters, wipeAllData };
})();
