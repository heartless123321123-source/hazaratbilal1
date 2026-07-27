/**
 * search.js
 * -----------------------------------------------------------
 * Applies the sidebar Account/City filters + the free-text
 * search box on top of App.activeDataset, then hands the
 * filtered result to TableView + Dashboard for rendering.
 * -----------------------------------------------------------
 */

const SearchFilter = (function () {

    function el(id) { return document.getElementById(id); }

    // Safe string coercion — prevents crashes if a field is a number/null
    // instead of a string (e.g. transactionId saved as a number).
    function safeStr(v) {
        if (v === null || v === undefined) return "";
        return String(v).toLowerCase();
    }

    function getFiltered() {
        const selectedAccount = el("accPicker").value;
        const selectedCity = el("cityPicker").value;
        const searchText = (el("searchBox") ? el("searchBox").value.trim().toLowerCase() : "");

        let filtered = App.activeDataset;

        if (selectedAccount) filtered = filtered.filter(r => r.account === selectedAccount);
        if (selectedCity) filtered = filtered.filter(r => r.city === selectedCity);

        if (searchText) {
            filtered = filtered.filter(r =>
                safeStr(r.name).includes(searchText) ||
                safeStr(r.transactionId).includes(searchText) ||
                safeStr(r.customerId).includes(searchText) ||
                safeStr(r.sender).includes(searchText) ||
                safeStr(r.city).includes(searchText) ||
                safeStr(r.status).includes(searchText)
            );
        }

        return filtered;
    }

    function execute() {
        const filtered = getFiltered();

        TableView.render(filtered);
        Dashboard.update(filtered);

        const selectedAccount = el("accPicker").value;
        const selectedCity = el("cityPicker").value;
        const searchText = el("searchBox") ? el("searchBox").value.trim() : "";

        if (selectedAccount || selectedCity || searchText) {
            let segmentSum = 0;
            filtered.forEach(r => segmentSum += Number(r.amount || 0));

            el("outAmount").innerText = `Rs. ${segmentSum.toLocaleString()}`;
            el("outCount").innerText = `${filtered.length} Rows`;
            el("validationCardOutput").classList.remove("hidden");
            el("filterStatusBadge").innerText = "Active Segment Lock";
            el("filterStatusBadge").className = "text-xs bg-emerald-600 text-white font-bold px-3 py-1 rounded-md shadow-sm";
        } else {
            el("validationCardOutput").classList.add("hidden");
        }
    }

    function clearFilters() {
        el("accPicker").value = "";
        el("cityPicker").value = "";
        if (el("searchBox")) el("searchBox").value = "";
        el("validationCardOutput").classList.add("hidden");
        el("filterStatusBadge").innerText = "Global Master View";
        el("filterStatusBadge").className = "text-xs bg-blue-600 text-white font-bold px-3 py-1 rounded-md shadow-sm";

        TableView.render(App.activeDataset);
        Dashboard.update(App.activeDataset);
    }

    return { execute, clearFilters, getFiltered };
})();
