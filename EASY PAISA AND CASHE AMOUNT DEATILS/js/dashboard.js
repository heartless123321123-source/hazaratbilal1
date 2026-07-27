/**
 * dashboard.js
 * -----------------------------------------------------------
 * Computes the 4 "Operational Metrics Engine" cards
 * (Daily / Weekly / Monthly / Yearly) from whatever dataset
 * is currently on screen (post-filter), and paints them.
 * Dates in records are stored as "dd-mm-yyyy" strings.
 * -----------------------------------------------------------
 */

const Dashboard = (function () {

    function el(id) { return document.getElementById(id); }

    function parseStampDate(str) {
        if (!str) return null;
        const parts = String(str).split("-");
        if (parts.length !== 3) return null;
        const [d, m, y] = parts.map(Number);
        if (!d || !m || !y) return null;
        return new Date(y, m - 1, d);
    }

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function update(dataset) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 6); // rolling 7-day window

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        let daily = 0, weekly = 0, monthly = 0, yearly = 0;

        dataset.forEach(row => {
            const amt = Number(row.amount || 0);
            const d = parseStampDate(row.date);
            if (!d) return;

            if (sameDay(d, startOfToday)) daily += amt;
            if (d >= startOfWeek && d <= now) weekly += amt;
            if (d >= startOfMonth && d <= now) monthly += amt;
            if (d >= startOfYear && d <= now) yearly += amt;
        });

        setText("cardDaily", daily);
        setText("cardWeekly", weekly);
        setText("cardMonthly", monthly);
        setText("cardYearly", yearly);
    }

    function setText(id, value) {
        const node = el(id);
        if (node) node.innerText = `Rs. ${Number(value).toLocaleString()}`;
    }

    return { update };
})();
