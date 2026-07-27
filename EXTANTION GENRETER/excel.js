// ============================================================
// excel.js — AIRTOUCH Excel Export (.xlsx)
// ============================================================

function downloadExcel(rows) {

  if (rows.length === 0) {
    alert("کوئی Data نہیں ہے Download کرنے کے لیے!");
    return;
  }

  const data = [
    ["Date/Time", "User ID", "Amount", "Phone", "Full Message", "Status", "Office"]
  ];

  rows.forEach(r => {
    data.push([
      r.date || "",
      r.id || "",
      r.amount || "",
      r.phone || "",
      r.message || "",
      r.status || "Pending",
      extractOfficeFromId(r.id)
    ]);
  });


  // Sheet بنائیں
  const ws = XLSX.utils.aoa_to_sheet(data);


  // Column Width
  ws["!cols"] = [
    { wch: 22 },
    { wch: 15 },
    { wch: 10 },
    { wch: 25 },
    { wch: 60 },
    { wch: 12 },
    { wch: 12 }
  ];


  // Workbook بنائیں
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Recharge Data"
  );


  // Download XLSX
  XLSX.writeFile(
    wb,
    "AIRTOUCH_Recharge_" +
    new Date().toISOString().slice(0, 10) +
    ".xlsx"
  );
}
