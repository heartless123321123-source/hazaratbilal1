/**
 * storage.js
 * -----------------------------------------------------------
 * Small wrapper around localStorage — used for lightweight
 * "settings" data (last filter used, UI preferences, etc.)
 * NOT used for ledger records — those live in IndexedDB
 * (see database.js) because they can grow into the thousands.
 * -----------------------------------------------------------
 */

const AppStorage = (function () {
    const PREFIX = "airtouch_";

    function setSetting(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (err) {
            console.warn("AppStorage.setSetting failed:", err);
        }
    }

    function getSetting(key, fallback = null) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (err) {
            console.warn("AppStorage.getSetting failed:", err);
            return fallback;
        }
    }

    function removeSetting(key) {
        localStorage.removeItem(PREFIX + key);
    }

    return { setSetting, getSetting, removeSetting };
})();
