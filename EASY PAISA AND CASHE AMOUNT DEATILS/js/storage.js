/**
 * storage.js
 * -----------------------------------------------------------
 * Thin wrapper around localStorage for small app settings
 * (seed flag, last-used filters). NOT used for ledger records
 * themselves — those live in IndexedDB via database.js.
 * -----------------------------------------------------------
 */

const AppStorage = (function () {

    const PREFIX = "airtouch_setting_";

    function getSetting(key, fallback) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (err) {
            console.error("AppStorage.getSetting failed:", err);
            return fallback;
        }
    }

    function setSetting(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (err) {
            console.error("AppStorage.setSetting failed:", err);
        }
    }

    function removeSetting(key) {
        localStorage.removeItem(PREFIX + key);
    }

    return { getSetting, setSetting, removeSetting };
})();
