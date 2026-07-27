/**
 * settings.js
 * -----------------------------------------------------------
 * Lightweight settings actions — persisted via storage.js
 * (localStorage). Currently: remembering last-used filters,
 * and a "Danger Zone" wipe of the whole IndexedDB ledger.
 * -----------------------------------------------------------
 */

const SettingsPanel = (function () {

    function rememberLastFilters() {
        AppStorage.setSetting("lastAccount", document.getElementById("accPicker").value);
        AppStorage.setSetting("lastCity", document.getElementById("cityPicker").value);
    }

    function restoreLastFilters() {
        const acc = AppStorage.getSetting("lastAccount", "");
        const city = AppStorage.getSetting("lastCity", "");
        if (acc) document.getElementById("accPicker").value = acc;
        if (city) document.getElementById("cityPicker").value = city;
    }

    async function wipeAllData() {
        const sure = confirm("⚠ This will permanently delete ALL saved ledger records from this device. Continue?");
        if (!sure) return;

        await LedgerDB.clearAll();
        App.activeDataset = [];
        App.applyFiltersAndRender();
        alert("Ledger cleared.");
    }

    return { rememberLastFilters, restoreLastFilters, wipeAllData };
})();
