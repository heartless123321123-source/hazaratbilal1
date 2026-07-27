// ============================================================
// settings.js — AIRTOUCH Recharge Parser Configuration
// یہاں Prefixes اور Amounts بدلیں
// ============================================================

const SETTINGS = {

  // تمام City Prefixes — بڑے اور چھوٹے دونوں
  validPrefixes: [
    "B", "BTK", "KHR", "MKD", "CKD", "ZRT", "NSF", "BKD", "TLS",
    "KOT", "SHM", "MTA", "TLG", "MGL", "SNG", "SWT", "BKT", "ODG",
    "MNR", "GHL", "OSK", "BDN", "KDZ", "TOK", "MBD", "SKT", "OCH",
    "DHR", "TDC", "KML", "THA", "ALD", "QLG", "TNG", "CKT", "SLW",
    "KKL", "FTR", "BGR"
  ],

  // یہ الفاظ User ID نہیں ہیں — Ignore ہوں گے
  ignoreWords: [
    "MB", "GB", "KB", "TB", "G",
    "RS", "PKG", "PLAN", "SPEED",
    "PAYMENT", "RECHARGE", "BILL",
    "DONE", "PHOTO", "CLEAR",
    "NET", "DATA", "INVOICE",
    "LOGIN", "USER", "WIFI"
  ],

  // صحیح Amount Values — صرف یہی amounts valid ہیں
  validAmounts: [
    1200, 1500, 1700, 2000, 2100,
    2400, 2500, 3000, 3500,
    4000, 4200, 8400
  ]

};
