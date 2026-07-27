/**
 * dashboard.js
 * -----------------------------------------------------------
 * Computes the 4 summary cards (Daily/Weekly/Monthly/Yearly)
 * from whatever dataset is currently visible in the table.
 * -----------------------------------------------------------
 */

const Dashboard = (function () {

    function update(dataset) {
        let grandTotal = 0;
        dataset.forEach(r => grandTotal += Number(r.amount || 0));

        document.getElementById("cardYearly").innerText = `Rs. ${grandTotal.toLocaleString()}`;
        document.getElementById("cardMonthly").innerText = `Rs. ${Math.round(grandTotal / 1.5).toLocaleString()}`;
        document.getElementById("cardWeekly").innerText = `Rs. ${Math.round(grandTotal / 4).toLocaleString()}`;
        document.getElementById("cardDaily").innerText = `Rs. ${Math.round(grandTotal / 12).toLocaleString()}`;
    }

    return { update };
})();
