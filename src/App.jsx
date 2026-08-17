import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Truck, Wallet,
  Calculator, Plus, Trash2, Download, Loader2, TrendingUp, TrendingDown, Printer,
  LogOut, Users, Search, Filter, History, RefreshCw, CalendarCheck, Bell, UserRound,
  Building2, RotateCcw, CheckCircle2, XCircle, AlertTriangle, FileDown,
} from "lucide-react";

const PRINT_STYLES = `
@media print {
  @page { size: A4 landscape; margin: 12mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .zaro-no-print { display: none !important; }
  .zaro-print-header { display: block !important; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  input, select { border: none !important; }
}
.zaro-print-header { display: none; }
`;

const BURGUNDY = "#6E1E24";
const TAN = "#8B5E3C";
const SECTION_BG = "#F7EDEE";
const CHARCOAL = "#2B2B2B";

const STATUS_OPTIONS = ["قيد المعالجة", "مؤكد", "تم الشحن", "تم التسليم", "مرتجع", "ملغي"];

const DEFAULT_DATA = {
  products: [
    { code: "WATCH01", name: "ساعة ZARO كلاسيك", price: 1200, cost: 450, reorderPoint: 5 },
    { code: "WALLET01", name: "محفظة جلد طبيعي", price: 450, cost: 150, reorderPoint: 5 },
    { code: "BELT01", name: "حزام جلد مزخرف", price: 350, cost: 100, reorderPoint: 5 },
    { code: "SUNGLASS01", name: "نظارة شمس ZARO", price: 550, cost: 180, reorderPoint: 5 },
  ],
  inventory: [
    { code: "WATCH01", available: 40 },
    { code: "WALLET01", available: 60 },
    { code: "BELT01", available: 80 },
    { code: "SUNGLASS01", available: 50 },
  ],
  inventoryMovements: [],
  shippingCompanies: [
    { name: "Bosta", cost: 65, feePct: 0.02, days: 7 },
    { name: "Mylerz", cost: 60, feePct: 0.015, days: 10 },
  ],
  collections: [
    { date: "2026-08-01", company: "Bosta", received: 4300 },
    { date: "2026-08-05", company: "Mylerz", received: 2100 },
  ],
  orders: [
    { id: "ORD-1001", date: "2026-08-01", customer: "أحمد محمد", product: "ساعة ZARO كلاسيك", qty: 1, company: "Bosta", status: "تم التسليم", notes: "" },
    { id: "ORD-1002", date: "2026-08-02", customer: "منى سيد", product: "محفظة جلد طبيعي", qty: 2, company: "Mylerz", status: "تم التسليم", notes: "" },
    { id: "ORD-1003", date: "2026-08-03", customer: "كريم علي", product: "نظارة شمس ZARO", qty: 1, company: "Bosta", status: "مرتجع", notes: "" },
    { id: "ORD-1004", date: "2026-08-04", customer: "سارة حسن", product: "حزام جلد مزخرف", qty: 1, company: "Mylerz", status: "قيد الشحن", notes: "" },
  ],
  ads: [
    { date: "2026-08-01", platform: "فيسبوك", amount: 3000, orders: 25 },
    { date: "2026-08-03", platform: "تيك توك", amount: 1800, orders: 12 },
    { date: "2026-08-05", platform: "فيسبوك", amount: 2600, orders: 20 },
  ],
  fixedCosts: [
    { month: "أغسطس 2026", item: "تسويق / إدارة سوشيال ميديا", amount: 4000 },
    { month: "أغسطس 2026", item: "تصوير المنتجات", amount: 1500 },
    { month: "أغسطس 2026", item: "مونتاج الفيديوهات", amount: 1200 },
    { month: "أغسطس 2026", item: "باقة واي فاي", amount: 400 },
    { month: "أغسطس 2026", item: "مواصلات وتوصيل", amount: 800 },
    { month: "أغسطس 2026", item: "أخرى", amount: 500 },
  ],
  cpp: {
    salePrice: 550, cost: 180, shipFwd: 62, shipRet: 62,
    codFeePct: 0.018, confRate: 0.65, delRate: 0.8,
    expectedOrders: 300, marginPct: 0.1, actualCpp: 90,
  },
  customers: [],
  suppliers: [],
  returns: [],
  dailyClosures: [],
  expenseApprovals: [],
};

const STORAGE_KEY = "zaro-erp-data-v1";
const fmt = (n) => (isFinite(n) ? Math.round(n).toLocaleString("en-US") : "0") + " ج.م";
const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1) : "0") + "%";

const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
const isRatio = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1;

function validateSection(section, payload) {
  if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) return "البيانات غير صالحة.";
  if (section === "orders") {
    const ids = new Set();
    for (const order of payload) {
      if (!order.id?.trim() || !order.date || !order.customer?.trim() || !order.product || !order.company) return "كل أوردر يحتاج رقمًا وتاريخًا وعميلًا ومنتجًا وشركة شحن.";
      if (ids.has(order.id.trim())) return `رقم الأوردر ${order.id} مكرر. استخدم رقمًا مختلفًا.`;
      ids.add(order.id.trim());
      if (!Number.isInteger(Number(order.qty)) || Number(order.qty) < 1) return `كمية الأوردر ${order.id} يجب أن تكون رقمًا صحيحًا أكبر من صفر.`;
      if (!STATUS_OPTIONS.includes(order.status)) return `حالة الأوردر ${order.id} غير معروفة.`;
    }
  }
  if (section === "products") {
    const codes = new Set();
    for (const product of payload) {
      if (!product.code?.trim() || !product.name?.trim()) return "كل منتج يحتاج كودًا واسمًا.";
      if (codes.has(product.code.trim())) return `كود المنتج ${product.code} مكرر.`;
      codes.add(product.code.trim());
      if (!isNonNegativeNumber(product.price) || !isNonNegativeNumber(product.cost)) return `سعر وتكلفة المنتج ${product.name} يجب أن تكون أرقامًا موجبة أو صفرًا.`;
    }
  }
  if (section === "inventory" && payload.some((row) => !isNonNegativeNumber(row.available))) return "كميات المخزون لا يمكن أن تكون سالبة.";
  if (section === "inventoryMovements" && payload.some((row) => !row.date || !row.code || !row.reason?.trim() || !Number.isInteger(Number(row.qty)) || Number(row.qty) < 1 || !["إضافة", "خصم"].includes(row.type))) return "حركة المخزون تحتاج تاريخًا ومنتجًا وسببًا وكمية صحيحة أكبر من صفر.";
  if (section === "shippingCompanies" && payload.some((row) => !isNonNegativeNumber(row.cost) || !isRatio(row.feePct))) return "تكلفة الشحن يجب ألا تكون سالبة ونسبة العمولة بين 0% و100%.";
  if (section === "collections" && payload.some((row) => !row.date || !row.company || !isNonNegativeNumber(row.received))) return "كل تحصيل يحتاج تاريخًا وشركة ومبلغًا غير سالب.";
  if (section === "ads" && payload.some((row) => !row.date || !row.platform?.trim() || !isNonNegativeNumber(row.amount) || !isNonNegativeNumber(row.orders))) return "مصروف الإعلان يحتاج تاريخًا ومنصة ومبالغ غير سالبة.";
  if (section === "fixedCosts" && payload.some((row) => !row.month?.trim() || !row.item?.trim() || !isNonNegativeNumber(row.amount))) return "كل مصروف ثابت يحتاج شهرًا وبندًا ومبلغًا غير سالب.";
  if (section === "cpp") {
    const ratioFields = ["codFeePct", "confRate", "delRate", "marginPct"];
    if (ratioFields.some((field) => !isRatio(payload[field])) || ["salePrice", "cost", "shipFwd", "shipRet", "expectedOrders", "actualCpp"].some((field) => !isNonNegativeNumber(payload[field]))) return "مدخلات Max CPP يجب أن تكون أرقامًا صحيحة والنسب بين 0% و100%.";
  }
  if (["customers", "suppliers"].includes(section)) {
    if (payload.some((row) => !row.id?.trim() || !row.name?.trim())) return "كل سجل يحتاج معرفًا واسمًا.";
    const ids = new Set();
    for (const row of payload) { if (ids.has(row.id.trim())) return `المعرف ${row.id} مكرر.`; ids.add(row.id.trim()); }
  }
  if (section === "returns") {
    if (payload.some((row) => !row.id?.trim() || !row.orderId?.trim() || !row.date || !row.product?.trim() || !["pending", "approved", "refunded", "rejected"].includes(row.status) || !Number.isInteger(Number(row.qty)) || Number(row.qty) < 1 || !isNonNegativeNumber(row.refundAmount))) return "بيانات المرتجع تحتاج أوردرًا ومنتجًا وكمية ومبلغًا وحالة صحيحة.";
  }
  if (section === "dailyClosures") {
    if (payload.some((row) => !row.id?.trim() || !row.date || row.status !== "closed" || !Number.isInteger(Number(row.totalOrders)) || Number(row.totalOrders) < 0 || !isNonNegativeNumber(row.totalSales))) return "بيانات إغلاق اليوم غير صالحة.";
    const dates = new Set();
    for (const row of payload) { if (dates.has(row.date)) return `اليوم ${row.date} مغلق بالفعل.`; dates.add(row.date); }
  }
  if (section === "expenseApprovals") {
    if (payload.some((row) => !row.id?.trim() || !row.date || !row.type?.trim() || !isNonNegativeNumber(row.amount) || !["pending", "approved", "rejected"].includes(row.status))) return "بيانات اعتماد المصروف غير صالحة.";
  }
  return "";
}

function useZaroData(role) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const skipNextRealtime = React.useRef(false);

  useEffect(() => {
    (async () => {
      const { data: row, error } = await supabase.from("zaro_state").select("data").eq("id", 1).single();
      const isEmpty = error || !row || !row.data || Object.keys(row.data).length === 0;
      if (isEmpty) {
        if (role === "owner") {
          // أول تشغيل: الأونر بس يقدر يعمل seed للبيانات الافتراضية
          await supabase.rpc("zaro_seed", { p_data: DEFAULT_DATA });
        }
        setData(DEFAULT_DATA);
      } else {
        setData({ ...DEFAULT_DATA, ...row.data, inventoryMovements: row.data.inventoryMovements || [] });
      }
      setLoading(false);
    })();

    // استقبال تحديثات لحظية من مستخدمين تانيين
    const channel = supabase
      .channel("zaro_state_changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "zaro_state" }, (payload) => {
        if (skipNextRealtime.current) {
          skipNextRealtime.current = false;
          return;
        }
        setData(payload.new.data);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [role]);

  // كل تعديل بيتبعت بس للقسم اللي تغيّر (مثلاً orders أو products) —
  // السيرفر (RPC: zaro_update_section) هو اللي يتحقق فعليًا إن الصلاحية تسمح بالتعديل على القسم ده
  const saveSection = useCallback(async (section, next) => {
    const previous = data?.[section];
    setData((prev) => ({ ...prev, [section]: next }));
    setSaveState("saving");
    skipNextRealtime.current = true;
    const { error } = await supabase.rpc("zaro_update_section", { p_section: section, p_payload: next });
    if (error) {
      setData((prev) => ({ ...prev, [section]: previous }));
      skipNextRealtime.current = false;
      setSaveState("error");
      console.error(error);
    } else {
      setSaveState("saved");
    }
    setTimeout(() => setSaveState("idle"), 1600);
    return !error;
  }, [data]);

  const applyInventoryMovement = useCallback(async (movement) => {
    setSaveState("saving");
    const { error } = await supabase.rpc("zaro_apply_inventory_movement", {
      p_code: movement.code,
      p_type: movement.type,
      p_qty: Number(movement.qty),
      p_reason: movement.reason,
      p_date: movement.date,
    });
    if (error) {
      setSaveState("error");
      console.error(error);
      return { ok: false, error };
    }
    setData((prev) => {
      const inventory = prev.inventory.map((item) => item.code === movement.code
        ? { ...item, available: Number(item.available || 0) + (movement.type === "إضافة" ? Number(movement.qty) : -Number(movement.qty)) }
        : item);
      return { ...prev, inventory, inventoryMovements: [...(prev.inventoryMovements || []), { ...movement, qty: Number(movement.qty), id: crypto.randomUUID() }] };
    });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1600);
    return { ok: true };
  }, []);

  return { data, saveSection, applyInventoryMovement, loading, saveState };
}

function computeOrder(order, products, companies) {
  const p = products.find((x) => x.name === order.product) || { price: 0, cost: 0 };
  const c = companies.find((x) => x.name === order.company) || { cost: 0, feePct: 0 };
  const qty = Number(order.qty) || 0;
  const totalSale = qty * (p.price || 0);
  const totalCost = qty * (p.cost || 0);
  const shipCost = c.cost || 0;
  const codFee = totalSale * (c.feePct || 0);
  let netProfit = 0;
  if (order.status === "تم التسليم") netProfit = totalSale - totalCost - shipCost - codFee;
  else if (order.status === "مرتجع") netProfit = -(shipCost * 2);
  return { ...order, unitPrice: p.price || 0, totalSale, unitCost: p.cost || 0, totalCost, shipCost, codFee, netProfit };
}

function Card({ label, value, big, positive, negative, icon: Icon }) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: SECTION_BG, borderColor: "#E5D3D5" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        {Icon && <Icon size={16} color={BURGUNDY} />}
      </div>
      <div
        className={`font-bold ${big ? "text-2xl" : "text-lg"}`}
        style={{ color: negative ? "#B91C1C" : positive ? "#15803D" : BURGUNDY }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-2 py-2 text-xs font-semibold text-white sticky top-0" style={{ background: BURGUNDY }}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-2 py-1.5 text-xs border-b border-gray-100 ${className}`}>{children}</td>;
}
function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full px-2 py-1 text-xs rounded border border-gray-300 focus:outline-none focus:ring-2"
      style={{ "--tw-ring-color": BURGUNDY }}
    />
  );
}
function Select({ children, ...props }) {
  return (
    <select {...props} className="w-full px-2 py-1 text-xs rounded border border-gray-300 bg-white">
      {children}
    </select>
  );
}
function Btn({ children, onClick, variant = "primary", icon: Icon, ...props }) {
  const styles =
    variant === "primary"
      ? { background: BURGUNDY, color: "white" }
      : variant === "danger"
      ? { background: "#FEE2E2", color: "#B91C1C" }
      : { background: "#F3F4F6", color: CHARCOAL };
  return (
    <button
      onClick={onClick}
      style={styles}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition"
      {...props}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

export default function ZaroERP({ role, email, onSignOut }) {
  const { data, saveSection, applyInventoryMovement, loading, saveState } = useZaroData(role);
  const [tab, setTab] = useState("dashboard");
  const [validationMessage, setValidationMessage] = useState("");

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96 gap-2 text-gray-500">
        <Loader2 className="animate-spin" size={18} /> جاري التحميل...
      </div>
    );
  }

  const isOwner = role === "owner";
  const canEditOrders = role === "owner" || role === "accountant";
  const canEditCollections = role === "owner" || role === "accountant";
  const canEditOther = role === "owner"; // منتجات، مخزون، شركات شحن، مصاريف، Max CPP
  const roleLabel = role === "owner" ? "أونر" : role === "accountant" ? "محاسب" : "مشاهدة فقط";

  const computedOrders = data.orders.map((o) => computeOrder(o, data.products, data.shippingCompanies));

  const delivered = computedOrders.filter((o) => o.status === "تم التسليم");
  const returned = computedOrders.filter((o) => o.status === "مرتجع");
  const totalSales = delivered.reduce((s, o) => s + o.totalSale, 0);
  const totalCOGS = delivered.reduce((s, o) => s + o.totalCost, 0);
  const totalShip = [...delivered, ...returned].reduce((s, o) => s + o.shipCost, 0);
  const totalCOD = delivered.reduce((s, o) => s + o.codFee, 0);
  const operatingProfit = computedOrders.reduce((s, o) => s + o.netProfit, 0);
  const totalAds = data.ads.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalFixed = data.fixedCosts.reduce((s, f) => s + Number(f.amount || 0), 0);
  const finalProfit = operatingProfit - totalAds - totalFixed;
  const deliveryRate = delivered.length + returned.length > 0 ? delivered.length / (delivered.length + returned.length) : 0;

  const productStats = data.products.map((p) => {
    const po = delivered.filter((o) => o.product === p.name);
    return { ...p, deliveredCount: po.length, totalProfit: po.reduce((s, o) => s + o.netProfit, 0) };
  }).sort((a, b) => b.totalProfit - a.totalProfit);

  const bestProduct = productStats[0];

  const cpp = data.cpp;
  const fixedPerOrder = cpp.expectedOrders > 0 ? totalFixed / cpp.expectedOrders : 0;
  const marginMoney = cpp.salePrice * cpp.marginPct;
  const profitIfDelivered = cpp.salePrice - cpp.cost - cpp.shipFwd - cpp.salePrice * cpp.codFeePct;
  const lossIfReturned = -(cpp.shipFwd + cpp.shipRet);
  const expectedPerConfirmed = cpp.delRate * profitIfDelivered + (1 - cpp.delRate) * lossIfReturned;
  const expectedPerPurchase = cpp.confRate * expectedPerConfirmed;
  const breakevenCpp = expectedPerPurchase - fixedPerOrder;
  const maxCpp = breakevenCpp - marginMoney;
  const decision = cpp.actualCpp > maxCpp ? "⛔ أوقف الحملة — بتخسر" : cpp.actualCpp < maxCpp * 0.7 ? "✅ كبّر الميزانية — هامش أمان كويس" : "⚠️ على الحافة — راقب عن قرب";
  const decisionColor = cpp.actualCpp > maxCpp ? "#B91C1C" : cpp.actualCpp < maxCpp * 0.7 ? "#15803D" : "#B45309";

  const inventoryComputed = data.inventory.map((inv) => {
    const p = data.products.find((x) => x.code === inv.code) || {};
    const sold = delivered.filter((o) => o.product === p.name).reduce((s, o) => s + Number(o.qty || 0), 0);
    const remaining = inv.available - sold;
    return { ...inv, name: p.name, unitCost: p.cost || 0, sold, remaining, value: remaining * (p.cost || 0) };
  });

  const collectionsComputed = data.collections.map((c) => {
    const co = delivered.filter((o) => o.company === c.company);
    const expected = co.reduce((s, o) => s + o.totalSale - o.codFee, 0);
    const diff = expected - c.received;
    return { ...c, deliveredCount: co.length, expected, diff, statusLabel: diff === 0 ? "✔ تم التحصيل" : "⚠ متبقي" };
  });

  // ---------- mutation helpers ----------
  const update = (key, next) => {
    const message = validateSection(key, next);
    if (message) {
      setValidationMessage(message);
      return false;
    }
    setValidationMessage("");
    return saveSection(key, next);
  };
  const addRow = (key, row) => update(key, [...data[key], row]);
  const removeRow = (key, idx) => update(key, data[key].filter((_, i) => i !== idx));
  const editRow = (key, idx, field, value) =>
    update(key, data[key].map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const editCpp = (field, value) => update("cpp", { ...data.cpp, [field]: value });

  // ---------- export ----------
  const exportExcel = () => {
    const escapeCsv = (value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const downloadCsv = (filename, rows) => {
      const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    };
    const dashRows = [
      ["ZARO — لوحة متابعة البزنس"],
      [],
      ["إجمالي عدد الأوردرات", data.orders.length],
      ["أوردرات تم تسليمها", delivered.length],
      ["أوردرات مرتجعة", returned.length],
      ["نسبة التسليم الفعلية", pct(deliveryRate)],
      ["إجمالي المبيعات", totalSales],
      ["إجمالي تكلفة المنتجات", totalCOGS],
      ["إجمالي تكلفة الشحن", totalShip],
      ["إجمالي عمولات التحصيل", totalCOD],
      ["الربح التشغيلي", operatingProfit],
      ["إجمالي مصاريف الإعلانات", totalAds],
      ["إجمالي المصاريف الثابتة", totalFixed],
      ["صافي الربح النهائي", finalProfit],
      ["المنتج الأكثر ربحية", bestProduct ? bestProduct.name : "—"],
      ["أقصى تكلفة شراء (Max CPP)", Math.round(maxCpp)],
    ];
    const rows = [...dashRows];

    rows.push([], ["الأوردرات"], ["رقم الأوردر", "التاريخ", "العميل", "المنتج", "الكمية", "سعر الوحدة", "إجمالي البيع", "تكلفة الوحدة", "إجمالي التكلفة", "شركة الشحن", "تكلفة الشحن", "عمولة التحصيل", "الحالة", "صافي الربح", "ملاحظات"], ...computedOrders.map((o) => [o.id, o.date, o.customer, o.product, o.qty, o.unitPrice, o.totalSale, o.unitCost, o.totalCost, o.company, o.shipCost, Math.round(o.codFee), o.status, Math.round(o.netProfit), o.notes]));

    rows.push([], ["المنتجات"], ["كود", "الاسم", "سعر البيع", "التكلفة", "هامش الوحدة", "عدد المُسلّم", "إجمالي الربح"], ...productStats.map((p) => [p.code, p.name, p.price, p.cost, p.price - p.cost, p.deliveredCount, Math.round(p.totalProfit)]));

    rows.push([], ["المخزون"], ["كود", "المنتج", "المتاح", "المُباع (مُسلّم)", "المتبقي", "تكلفة الوحدة", "قيمة المخزون"], ...inventoryComputed.map((i) => [i.code, i.name, i.available, i.sold, i.remaining, i.unitCost, Math.round(i.value)]));

    const shipRows = [
      ["شركات الشحن"],
      ["الاسم", "تكلفة الشحن", "نسبة العمولة", "مدة التحصيل"],
      ...data.shippingCompanies.map((c) => [c.name, c.cost, pct(c.feePct), c.days]),
      [],
      ["التحصيلات"],
      ["التاريخ", "الشركة", "عدد المُسلّم", "المفروض تحصيله", "المستلم فعليًا", "الفرق", "الحالة"],
      ...collectionsComputed.map((c) => [c.date, c.company, c.deliveredCount, Math.round(c.expected), c.received, Math.round(c.diff), c.statusLabel]),
    ];
    rows.push([], ...shipRows);

    const expRows = [
      ["مصاريف الإعلانات"],
      ["التاريخ", "المنصة", "المبلغ", "عدد الأوردرات"],
      ...data.ads.map((a) => [a.date, a.platform, a.amount, a.orders]),
      [],
      ["المصاريف الثابتة"],
      ["الشهر", "البند", "المبلغ"],
      ...data.fixedCosts.map((f) => [f.month, f.item, f.amount]),
    ];
    rows.push([], ...expRows);

    const cppRows = [
      ["Max CPP Calculator"],
      ["سعر البيع", cpp.salePrice], ["تكلفة المنتج", cpp.cost], ["شحن ذهاب", cpp.shipFwd],
      ["شحن مرتجع", cpp.shipRet], ["نسبة عمولة التحصيل", pct(cpp.codFeePct)], ["نسبة التأكيد", pct(cpp.confRate)],
      ["نسبة التسليم", pct(cpp.delRate)], ["أوردرات متوقعة شهريًا", cpp.expectedOrders], ["هامش الربح المطلوب", pct(cpp.marginPct)],
      [], ["تكلفة ثابتة لكل أوردر", Math.round(fixedPerOrder)], ["أقصى تكلفة شراء (Max CPP)", Math.round(maxCpp)],
      ["CPP الفعلي الحالي", cpp.actualCpp], ["القرار", decision],
    ];
    rows.push([], ...cppRows);
    downloadCsv(`zaro_business_system_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "الأوردرات", icon: ShoppingCart },
    { id: "products", label: "المنتجات", icon: Package },
    { id: "inventory", label: "المخزون", icon: Boxes },
    { id: "shipping", label: "الشحن", icon: Truck },
    { id: "expenses", label: "المصاريف", icon: Wallet },
    { id: "cpp", label: "Max CPP", icon: Calculator },
    ...(isOwner ? [
      { id: "ownerOps", label: "تشغيل Owner", icon: Bell },
      { id: "users", label: "المستخدمين", icon: Users },
    ] : []),
  ];

  const currentTabLabel = tabs.find((t) => t.id === tab)?.label || "";

  return (
    <div dir="rtl" className="min-h-screen bg-white text-gray-800" style={{ fontFamily: "Arial, sans-serif" }}>
      <style>{PRINT_STYLES}</style>

      {/* Print-only heading (shown only when printing) */}
      <div className="zaro-print-header px-5 pt-4">
        <div className="flex items-center justify-between" style={{ borderBottom: `2px solid ${BURGUNDY}`, paddingBottom: 8 }}>
          <div className="font-bold text-lg" style={{ color: BURGUNDY }}>ZARO — {currentTabLabel}</div>
          <div className="text-xs text-gray-500">{new Date().toLocaleDateString("ar-EG")}</div>
        </div>
      </div>

      {/* Header */}
      <div className="zaro-no-print flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#eee" }}>
        <div className="flex items-center gap-2 min-w-0">

          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs" style={{ background: BURGUNDY }}>
            ZARO
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: BURGUNDY }}>ZARO Business System</div>
            <div className="text-[10px] text-gray-400">
              {saveState === "saving" ? "بيحفظ لكل المستخدمين..." : saveState === "saved" ? "✔ اتحفظ للجميع" : "قاعدة بيانات مشتركة — أي تعديل يظهر للجميع فورًا"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-gray-400 text-left hidden md:block" dir="ltr">
            {email}
            <div className="text-right font-bold" style={{ color: BURGUNDY }} dir="rtl">{roleLabel}</div>
          </div>
          <Btn onClick={() => window.print()} icon={Printer} variant="secondary">طباعة الشاشة دي</Btn>
          <Btn onClick={exportExcel} icon={Download}>تصدير CSV / Excel</Btn>
          <button onClick={onSignOut} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-1" title="تسجيل خروج">
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {validationMessage && (
        <div className="zaro-no-print mx-5 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
          {validationMessage}
        </div>
      )}

      <div className="zaro-no-print flex flex-wrap gap-1 px-5 py-2 border-b" style={{ borderColor: "#eee", background: "#FAFAFA" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            style={tab === t.id ? { background: BURGUNDY, color: "white" } : { color: CHARCOAL }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "dashboard" && <DashboardTab data={data} computedOrders={computedOrders} />}

        {tab === "ownerOps" && isOwner && (
          <OwnerOperationsTab
            data={data}
            computedOrders={computedOrders}
            collectionsComputed={collectionsComputed}
            update={update}
            readOnly={!isOwner}
          />
        )}

        {tab === "orders" && (
          <OrdersTab
            data={data} computedOrders={computedOrders}
            addRow={addRow} removeRow={removeRow} editRow={editRow}
            readOnly={!canEditOrders}
          />
        )}

        {tab === "products" && (
          <ProductsTab data={data} addRow={addRow} removeRow={removeRow} editRow={editRow} readOnly={!canEditOther} />
        )}

        {tab === "inventory" && (
          <InventoryTab data={data} inventoryComputed={inventoryComputed} inventoryMovements={data.inventoryMovements || []} applyInventoryMovement={applyInventoryMovement} editRow={editRow} readOnly={!canEditOther} />
        )}

        {tab === "shipping" && (
          <ShippingTab
            data={data} collectionsComputed={collectionsComputed}
            addRow={addRow} removeRow={removeRow} editRow={editRow}
            readOnlyCompanies={!canEditOther} readOnlyCollections={!canEditCollections}
          />
        )}

        {tab === "expenses" && (
          <ExpensesTab data={data} addRow={addRow} removeRow={removeRow} editRow={editRow} totalAds={totalAds} totalFixed={totalFixed} readOnly={!canEditOther} />
        )}

        {tab === "cpp" && (
          <CppTab
            cpp={cpp} editCpp={editCpp}
            fixedPerOrder={fixedPerOrder} marginMoney={marginMoney}
            profitIfDelivered={profitIfDelivered} lossIfReturned={lossIfReturned}
            expectedPerConfirmed={expectedPerConfirmed} expectedPerPurchase={expectedPerPurchase}
            breakevenCpp={breakevenCpp} maxCpp={maxCpp} decision={decision} decisionColor={decisionColor}
            readOnly={!canEditOther}
          />
        )}

        {tab === "users" && isOwner && <UsersTab />}
      </div>
    </div>
  );
}

function DashboardTab({ data, computedOrders }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const inPeriod = (date) => (!from || date >= from) && (!to || date <= to);
  const periodOrders = computedOrders.filter((order) => inPeriod(order.date));
  const delivered = periodOrders.filter((order) => order.status === "تم التسليم");
  const returned = periodOrders.filter((order) => order.status === "مرتجع");
  const totalSales = delivered.reduce((sum, order) => sum + order.totalSale, 0);
  const totalCOGS = delivered.reduce((sum, order) => sum + order.totalCost, 0);
  const totalShip = [...delivered, ...returned].reduce((sum, order) => sum + order.shipCost, 0);
  const totalCOD = delivered.reduce((sum, order) => sum + order.codFee, 0);
  const operatingProfit = periodOrders.reduce((sum, order) => sum + order.netProfit, 0);
  const totalAds = data.ads.filter((ad) => inPeriod(ad.date)).reduce((sum, ad) => sum + Number(ad.amount || 0), 0);
  const totalFixed = data.fixedCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  const finalProfit = operatingProfit - totalAds - totalFixed;
  const deliveryRate = delivered.length + returned.length > 0 ? delivered.length / (delivered.length + returned.length) : 0;
  const productStats = data.products.map((product) => {
    const productOrders = delivered.filter((order) => order.product === product.name);
    return { ...product, deliveredCount: productOrders.reduce((sum, order) => sum + Number(order.qty || 0), 0), totalProfit: productOrders.reduce((sum, order) => sum + order.netProfit, 0) };
  }).sort((a, b) => b.totalProfit - a.totalProfit);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-3 flex flex-col md:flex-row gap-2 items-end" style={{ borderColor: "#E5D3D5", background: "#FAFAFA" }}>
        <div className="text-xs font-bold flex-1" style={{ color: BURGUNDY }}>تحليل الفترة</div>
        <div className="w-full md:w-auto"><label className="text-[10px] text-gray-500">من</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="w-full md:w-auto"><label className="text-[10px] text-gray-500">إلى</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Btn variant="secondary" onClick={() => { setFrom(""); setTo(""); }}>كل البيانات</Btn>
      </div>
      <div className="text-[10px] text-gray-500">الأوردرات: {periodOrders.length} | المصاريف الثابتة محسوبة وفق البنود المسجلة حاليًا.</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card label="إجمالي الأوردرات" value={periodOrders.length} icon={ShoppingCart} /><Card label="تم تسليمها" value={delivered.length} icon={TrendingUp} positive /><Card label="مرتجعة" value={returned.length} icon={TrendingDown} negative /><Card label="نسبة التسليم" value={pct(deliveryRate)} icon={Truck} /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card label="إجمالي المبيعات" value={fmt(totalSales)} /><Card label="تكلفة المنتجات" value={fmt(totalCOGS)} /><Card label="تكلفة الشحن" value={fmt(totalShip)} /><Card label="عمولات التحصيل" value={fmt(totalCOD)} /></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Card label="الربح التشغيلي" value={fmt(operatingProfit)} positive={operatingProfit >= 0} negative={operatingProfit < 0} /><Card label="مصاريف الإعلانات" value={fmt(totalAds)} /><Card label="المصاريف الثابتة" value={fmt(totalFixed)} /><Card label="صافي الربح النهائي" value={fmt(finalProfit)} big positive={finalProfit >= 0} negative={finalProfit < 0} /></div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5D3D5" }}><div className="px-3 py-2 text-xs font-bold" style={{ background: SECTION_BG, color: BURGUNDY }}>ترتيب المنتجات حسب الربحية</div><table className="w-full"><thead><tr><Th>المنتج</Th><Th>الكمية المُسلّمة</Th><Th>إجمالي الربح</Th></tr></thead><tbody>{productStats.map((product) => <tr key={product.code}><Td>{product.name}</Td><Td>{product.deliveredCount}</Td><Td className="font-bold" style={{ color: BURGUNDY }}>{fmt(product.totalProfit)}</Td></tr>)}</tbody></table></div>
    </div>
  );
}

function OrdersTab({ data, computedOrders, addRow, removeRow, editRow, readOnly }) {
  const [form, setForm] = useState({ id: "", date: "", customer: "", product: data.products[0]?.name || "", qty: 1, company: data.shippingCompanies[0]?.name || "", status: STATUS_OPTIONS[0], notes: "" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrders = computedOrders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => statusFilter === "all" || order.status === statusFilter)
    .filter(({ order }) => !normalizedQuery || [order.id, order.customer, order.product, order.company].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)));

  const addOrder = async () => {
    const next = { ...form, id: form.id.trim(), customer: form.customer.trim(), qty: Number(form.qty) };
    if (!next.id || !next.date || !next.customer || !next.product || !next.company || next.qty < 1) {
      setMessage("أكمل بيانات الأوردر وأدخل كمية صحيحة.");
      return;
    }
    if (computedOrders.some((order) => order.id === next.id)) {
      setMessage("رقم الأوردر موجود بالفعل. استخدم رقمًا مختلفًا.");
      return;
    }
    const ok = await addRow("orders", next);
    if (ok) {
      setMessage("تمت إضافة الأوردر.");
      setForm({ ...form, id: "", customer: "" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-3 flex flex-col md:flex-row gap-2" style={{ borderColor: "#E5D3D5", background: "#FAFAFA" }}>
        <div className="flex-1 flex items-center gap-2"><Search size={14} color={BURGUNDY} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالرقم أو العميل أو المنتج..." /></div>
        <div className="flex items-center gap-2"><Filter size={14} color={BURGUNDY} /><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">كل الحالات</option>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      </div>

      {!readOnly && (
        <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-8 gap-2 items-end" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div><label className="text-[10px] text-gray-500">رقم الأوردر</label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="ORD-1005" /></div>
          <div><label className="text-[10px] text-gray-500">التاريخ</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">العميل</label><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">المنتج</label><Select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>{data.products.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}</Select></div>
          <div><label className="text-[10px] text-gray-500">الكمية</label><Input type="number" min="1" step="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">شركة الشحن</label><Select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>{data.shippingCompanies.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</Select></div>
          <div><label className="text-[10px] text-gray-500">الحالة</label><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
          <Btn icon={Plus} onClick={addOrder}>إضافة</Btn>
          {message && <div className="col-span-full text-[10px] text-gray-600">{message}</div>}
        </div>
      )}

      <div className="text-[10px] text-gray-500">عرض {filteredOrders.length} من {computedOrders.length} أوردر</div>
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
        <table className="w-full">
          <thead><tr><Th>رقم</Th><Th>التاريخ</Th><Th>العميل</Th><Th>المنتج</Th><Th>كمية</Th><Th>إجمالي البيع</Th><Th>الشحن</Th><Th>شركة الشحن</Th><Th>الحالة</Th><Th>صافي الربح</Th><Th></Th></tr></thead>
          <tbody>
            {filteredOrders.map(({ order: o, index }) => (
              <tr key={o.id}>
                <Td>{o.id}</Td><Td>{o.date}</Td><Td>{o.customer}</Td><Td>{o.product}</Td><Td>{o.qty}</Td><Td>{fmt(o.totalSale)}</Td><Td>{fmt(o.shipCost)}</Td><Td>{o.company}</Td>
                <Td><Select value={o.status} disabled={readOnly} onChange={(e) => editRow("orders", index, "status", e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Td>
                <Td className="font-bold" style={{ color: o.netProfit >= 0 ? "#15803D" : "#B91C1C" }}>{fmt(o.netProfit)}</Td>
                <Td>{!readOnly && <button title="حذف الأوردر" onClick={() => window.confirm(`حذف الأوردر ${o.id}؟`) && removeRow("orders", index)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsTab({ data, addRow, removeRow, editRow, readOnly }) {
  const [form, setForm] = useState({ code: "", name: "", price: "", cost: "", reorderPoint: 5 });
  const [message, setMessage] = useState("");

  const addProduct = async () => {
    const next = { code: form.code.trim(), name: form.name.trim(), price: Number(form.price), cost: Number(form.cost), reorderPoint: Number(form.reorderPoint) };
    if (!next.code || !next.name || !isNonNegativeNumber(next.price) || !isNonNegativeNumber(next.cost)) {
      setMessage("أدخل كود واسم وسعر وتكلفة صحيحة.");
      return;
    }
    if (data.products.some((product) => product.code === next.code || product.name === next.name)) {
      setMessage("كود أو اسم المنتج موجود بالفعل.");
      return;
    }
    const productSaved = await addRow("products", next);
    if (productSaved) {
      const inventorySaved = await addRow("inventory", { code: next.code, available: 0 });
      if (inventorySaved) {
        setMessage("تمت إضافة المنتج وفتح رصيده في المخزون.");
        setForm({ code: "", name: "", price: "", cost: "", reorderPoint: 5 });
      }
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div><label className="text-[10px] text-gray-500">كود</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">الاسم</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">سعر البيع</label><Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">التكلفة</label><Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">حد إعادة الطلب</label><Input type="number" min="0" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} /></div>
          <Btn icon={Plus} onClick={addProduct}>إضافة</Btn>
          {message && <div className="col-span-full text-[10px] text-gray-600">{message}</div>}
        </div>
      )}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
        <table className="w-full">
            <thead><tr><Th>كود</Th><Th>الاسم</Th><Th>سعر البيع</Th><Th>التكلفة</Th><Th>حد إعادة الطلب</Th><Th>الهامش</Th><Th></Th></tr></thead>
          <tbody>
            {data.products.map((p, i) => (
              <tr key={p.code}>
                <Td>{p.code}</Td><Td>{p.name}</Td>
                <Td><Input type="number" min="0" disabled={readOnly} value={p.price} onChange={(e) => editRow("products", i, "price", Number(e.target.value))} /></Td>
                <Td><Input type="number" min="0" disabled={readOnly} value={p.cost} onChange={(e) => editRow("products", i, "cost", Number(e.target.value))} /></Td>
                <Td><Input type="number" min="0" disabled={readOnly} value={p.reorderPoint ?? 5} onChange={(e) => editRow("products", i, "reorderPoint", Number(e.target.value))} /></Td>
                <Td className="font-bold" style={{ color: BURGUNDY }}>{fmt(p.price - p.cost)}</Td>
                <Td>{!readOnly && <button title="حذف المنتج" onClick={() => window.confirm(`حذف المنتج ${p.name}؟`) && removeRow("products", i)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryTab({ data, inventoryComputed, inventoryMovements, applyInventoryMovement, editRow, readOnly }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), code: data.products[0]?.code || "", type: "إضافة", qty: 1, reason: "" });
  const [message, setMessage] = useState("");

  const submitMovement = async () => {
    if (!form.date || !form.code || !form.reason.trim() || !Number.isInteger(Number(form.qty)) || Number(form.qty) < 1) {
      setMessage("أدخل التاريخ والمنتج والكمية والسبب قبل تسجيل الحركة.");
      return;
    }
    const result = await applyInventoryMovement({ ...form, qty: Number(form.qty), reason: form.reason.trim() });
    if (!result.ok) {
      setMessage(result.error?.message || "تعذر تسجيل حركة المخزون.");
      return;
    }
    setMessage("تم تسجيل حركة المخزون وتحديث الرصيد.");
    setForm({ ...form, qty: 1, reason: "" });
  };

  return (
    <div className="space-y-5">
      {!readOnly && (
        <div className="rounded-xl border p-3" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>تسجيل حركة مخزون</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
            <div><label className="text-[10px] text-gray-500">التاريخ</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">المنتج</label><Select value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>{data.products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></div>
            <div><label className="text-[10px] text-gray-500">نوع الحركة</label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="إضافة">إضافة</option><option value="خصم">خصم</option></Select></div>
            <div><label className="text-[10px] text-gray-500">الكمية</label><Input type="number" min="1" step="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">السبب</label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="شراء، تالف، تسوية..." /></div>
            <Btn icon={Plus} onClick={submitMovement}>تسجيل</Btn>
          </div>
          {message && <div className="mt-2 text-[10px] text-gray-600">{message}</div>}
        </div>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
        <table className="w-full">
          <thead><tr><Th>المنتج</Th><Th>الرصيد الأساسي / التسوية</Th><Th>المُباع (مُسلّم)</Th><Th>المتبقي</Th><Th>قيمة المخزون</Th><Th>الحالة</Th></tr></thead>
          <tbody>
            {inventoryComputed.map((inv, i) => (
              <tr key={i}>
                <Td>{inv.name}</Td>
                <Td><Input type="number" min="0" disabled={readOnly} value={inv.available} onChange={(e) => editRow("inventory", i, "available", Number(e.target.value))} /></Td>
                <Td>{inv.sold}</Td>
                <Td className="font-bold">{inv.remaining}</Td>
                <Td>{fmt(inv.value)}</Td>
                <Td>{inv.remaining < 5 ? <span style={{ color: "#B91C1C" }}>⚠ أعد الطلب</span> : <span style={{ color: "#15803D" }}>✔ متوفر</span>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inventoryMovements.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>آخر حركات المخزون</div>
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
            <table className="w-full">
              <thead><tr><Th>التاريخ</Th><Th>المنتج</Th><Th>الحركة</Th><Th>الكمية</Th><Th>السبب</Th></tr></thead>
              <tbody>
                {inventoryMovements.slice(-12).reverse().map((movement, index) => (
                  <tr key={movement.id || index}>
                    <Td>{movement.date}</Td><Td>{data.products.find((p) => p.code === movement.code)?.name || movement.code}</Td>
                    <Td style={{ color: movement.type === "إضافة" ? "#15803D" : "#B91C1C" }}>{movement.type}</Td><Td>{movement.qty}</Td><Td>{movement.reason}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ShippingTab({ data, collectionsComputed, addRow, removeRow, editRow, readOnlyCompanies, readOnlyCollections }) {
  const [form, setForm] = useState({ date: "", company: data.shippingCompanies[0]?.name || "", received: "" });
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>شركات الشحن</div>
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
          <table className="w-full">
            <thead><tr><Th>الاسم</Th><Th>تكلفة الشحن</Th><Th>نسبة العمولة</Th></tr></thead>
            <tbody>
              {data.shippingCompanies.map((c, i) => (
                <tr key={i}>
                  <Td>{c.name}</Td>
                  <Td><Input type="number" disabled={readOnlyCompanies} value={c.cost} onChange={(e) => editRow("shippingCompanies", i, "cost", Number(e.target.value))} /></Td>
                  <Td><Input type="number" step="0.001" disabled={readOnlyCompanies} value={c.feePct} onChange={(e) => editRow("shippingCompanies", i, "feePct", Number(e.target.value))} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>التحصيلات</div>
        {!readOnlyCollections && (
          <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end mb-2" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
            <div><label className="text-[10px] text-gray-500">التاريخ</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">الشركة</label>
              <Select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                {data.shippingCompanies.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </Select>
            </div>
            <div><label className="text-[10px] text-gray-500">المستلم فعليًا</label><Input type="number" value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} /></div>
            <Btn icon={Plus} onClick={() => { addRow("collections", { ...form, received: Number(form.received) || 0 }); setForm({ ...form, received: "" }); }}>إضافة</Btn>
          </div>
        )}
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
          <table className="w-full">
            <thead><tr><Th>التاريخ</Th><Th>الشركة</Th><Th>عدد المُسلّم</Th><Th>المفروض تحصيله</Th><Th>المستلم</Th><Th>الفرق</Th><Th>الحالة</Th><Th></Th></tr></thead>
            <tbody>
              {collectionsComputed.map((c, i) => (
                <tr key={i}>
                  <Td>{c.date}</Td><Td>{c.company}</Td><Td>{c.deliveredCount}</Td>
                  <Td>{fmt(c.expected)}</Td><Td>{fmt(c.received)}</Td>
                  <Td className="font-bold" style={{ color: c.diff === 0 ? "#15803D" : "#B91C1C" }}>{fmt(c.diff)}</Td>
                  <Td>{c.statusLabel}</Td>
                  <Td>{!readOnlyCollections && <button onClick={() => removeRow("collections", i)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpensesTab({ data, addRow, removeRow, editRow, totalAds, totalFixed, readOnly }) {
  const [adForm, setAdForm] = useState({ date: "", platform: "فيسبوك", amount: "", orders: "" });
  const [fixForm, setFixForm] = useState({ month: "", item: "", amount: "" });
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>مصاريف الإعلانات (إجمالي: {fmt(totalAds)})</div>
        {!readOnly && (
          <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-end mb-2" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
            <div><label className="text-[10px] text-gray-500">التاريخ</label><Input type="date" value={adForm.date} onChange={(e) => setAdForm({ ...adForm, date: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">المنصة</label><Input value={adForm.platform} onChange={(e) => setAdForm({ ...adForm, platform: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">المبلغ</label><Input type="number" value={adForm.amount} onChange={(e) => setAdForm({ ...adForm, amount: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">عدد الأوردرات</label><Input type="number" value={adForm.orders} onChange={(e) => setAdForm({ ...adForm, orders: e.target.value })} /></div>
            <Btn icon={Plus} onClick={() => { addRow("ads", { ...adForm, amount: Number(adForm.amount) || 0, orders: Number(adForm.orders) || 0 }); setAdForm({ ...adForm, amount: "", orders: "" }); }}>إضافة</Btn>
          </div>
        )}
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
          <table className="w-full">
            <thead><tr><Th>التاريخ</Th><Th>المنصة</Th><Th>المبلغ</Th><Th>الأوردرات</Th><Th>تكلفة الأوردر</Th><Th></Th></tr></thead>
            <tbody>
              {data.ads.map((a, i) => (
                <tr key={i}>
                  <Td>{a.date}</Td><Td>{a.platform}</Td><Td>{fmt(a.amount)}</Td><Td>{a.orders}</Td>
                  <Td>{fmt(a.orders ? a.amount / a.orders : 0)}</Td>
                  <Td>{!readOnly && <button onClick={() => removeRow("ads", i)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>المصاريف الثابتة (إجمالي: {fmt(totalFixed)})</div>
        {!readOnly && (
          <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end mb-2" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
            <div><label className="text-[10px] text-gray-500">الشهر</label><Input value={fixForm.month} onChange={(e) => setFixForm({ ...fixForm, month: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">البند</label><Input value={fixForm.item} onChange={(e) => setFixForm({ ...fixForm, item: e.target.value })} /></div>
            <div><label className="text-[10px] text-gray-500">المبلغ</label><Input type="number" value={fixForm.amount} onChange={(e) => setFixForm({ ...fixForm, amount: e.target.value })} /></div>
            <Btn icon={Plus} onClick={() => { addRow("fixedCosts", { ...fixForm, amount: Number(fixForm.amount) || 0 }); setFixForm({ month: "", item: "", amount: "" }); }}>إضافة</Btn>
          </div>
        )}
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
          <table className="w-full">
            <thead><tr><Th>الشهر</Th><Th>البند</Th><Th>المبلغ</Th><Th></Th></tr></thead>
            <tbody>
              {data.fixedCosts.map((f, i) => (
                <tr key={i}>
                  <Td>{f.month}</Td><Td>{f.item}</Td><Td>{fmt(f.amount)}</Td>
                  <Td>{!readOnly && <button onClick={() => removeRow("fixedCosts", i)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CppTab({ cpp, editCpp, fixedPerOrder, marginMoney, profitIfDelivered, lossIfReturned, expectedPerConfirmed, expectedPerPurchase, breakevenCpp, maxCpp, decision, decisionColor, readOnly }) {
  const fields = [
    ["salePrice", "سعر البيع"], ["cost", "تكلفة المنتج"], ["shipFwd", "شحن ذهاب"], ["shipRet", "شحن مرتجع"],
    ["codFeePct", "نسبة عمولة التحصيل"], ["confRate", "نسبة التأكيد"], ["delRate", "نسبة التسليم"],
    ["expectedOrders", "أوردرات متوقعة شهريًا"], ["marginPct", "هامش الربح المطلوب (%)"],
  ];
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
        <div className="text-xs font-bold mb-3" style={{ color: BURGUNDY }}>المدخلات</div>
        <div className="space-y-2">
          {fields.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <label className="text-xs text-gray-600 w-1/2">{label}</label>
              <Input type="number" step="0.01" disabled={readOnly} value={cpp[key]} onChange={(e) => editCpp(key, Number(e.target.value))} />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-2 border-t mt-2">
            <label className="text-xs font-bold text-gray-700 w-1/2">CPP الفعلي الحالي</label>
            <Input type="number" disabled={readOnly} value={cpp.actualCpp} onChange={(e) => editCpp("actualCpp", Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "#E5D3D5" }}>
          <Row label="تكلفة ثابتة لكل أوردر" value={fmt(fixedPerOrder)} />
          <Row label="هامش الربح المطلوب" value={fmt(marginMoney)} />
          <Row label="صافي الربح لو الأوردر اتسلم" value={fmt(profitIfDelivered)} />
          <Row label="خسارة لو الأوردر اتأكد ورجع" value={fmt(lossIfReturned)} />
          <Row label="القيمة المتوقعة لكل أوردر مؤكد" value={fmt(expectedPerConfirmed)} />
          <Row label="القيمة المتوقعة لكل Purchase" value={fmt(expectedPerPurchase)} />
          <Row label="نقطة التعادل (Break-even CPP)" value={fmt(breakevenCpp)} />
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: BURGUNDY }}>
          <div className="text-xs text-white opacity-80 mb-1">أقصى تكلفة شراء تقدر تدفعها (Max CPP)</div>
          <div className="text-3xl font-bold text-white">{fmt(maxCpp)}</div>
        </div>
        <div className="rounded-xl p-4 text-center border-2" style={{ borderColor: decisionColor }}>
          <div className="text-xs text-gray-500 mb-1">القرار بناءً على CPP الفعلي</div>
          <div className="text-lg font-bold" style={{ color: decisionColor }}>{decision}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="font-bold" style={{ color: CHARCOAL }}>{value}</span>
    </div>
  );
}

function opStatusText(status) {
  return status === "pending" ? "معلّق" : status === "approved" ? "معتمد" : status === "refunded" ? "تم رد المبلغ" : status === "rejected" ? "مرفوض" : status === "closed" ? "مغلق" : status;
}

function OwnerOperationsTab({ data, computedOrders, collectionsComputed, update }) {
  const [notice, setNotice] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customerForm, setCustomerForm] = useState({ id: "", name: "", phone: "", notes: "" });
  const [supplierForm, setSupplierForm] = useState({ id: "", name: "", phone: "", notes: "" });
  const [returnForm, setReturnForm] = useState({ orderId: data.orders[0]?.id || "", qty: 1, refundAmount: "", reason: "" });
  const [expenseForm, setExpenseForm] = useState({ date: new Date().toISOString().slice(0, 10), type: "مصاريف تشغيل", amount: "", notes: "" });

  const customers = data.customers || [];
  const suppliers = data.suppliers || [];
  const returns = data.returns || [];
  const dailyClosures = data.dailyClosures || [];
  const expenseApprovals = data.expenseApprovals || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = computedOrders.filter((order) => order.date === today);
  const delivered = computedOrders.filter((order) => order.status === "تم التسليم");
  const pendingExpenses = expenseApprovals.filter((row) => row.status === "pending");
  const openReturns = returns.filter((row) => ["pending", "approved"].includes(row.status));
  const lowStock = data.inventory.map((row) => {
    const product = data.products.find((item) => item.code === row.code);
    const sold = delivered.filter((order) => order.product === product?.name).reduce((sum, order) => sum + Number(order.qty || 0), 0);
    const remaining = Number(row.available || 0) - sold;
    return { ...row, name: product?.name || row.code, remaining, threshold: Number(product?.reorderPoint ?? 5) };
  }).filter((row) => row.remaining <= row.threshold);
  const overdueOrders = computedOrders.filter((order) => ["قيد المعالجة", "مؤكد", "تم الشحن"].includes(order.status) && Math.floor((Date.now() - new Date(order.date).getTime()) / 86400000) >= 3);
  const collectionIssues = collectionsComputed.filter((row) => !row.settled && Math.abs(Number(row.diff || 0)) > 0.01);
  const isClosedToday = dailyClosures.some((row) => row.date === today && row.status === "closed");
  const monthOrders = computedOrders.filter((order) => String(order.date || "").startsWith(reportMonth));
  const monthDelivered = monthOrders.filter((order) => order.status === "تم التسليم");
  const monthReturned = monthOrders.filter((order) => order.status === "مرتجع");
  const monthSales = monthDelivered.reduce((sum, order) => sum + order.totalSale, 0);
  const monthOperating = monthOrders.reduce((sum, order) => sum + order.netProfit, 0);
  const monthAds = data.ads.filter((row) => String(row.date || "").startsWith(reportMonth)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthFixed = data.fixedCosts.filter((row) => String(row.month || "").includes(reportMonth) || String(row.month || "").includes("أغسطس") && reportMonth.endsWith("-08")).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthNet = monthOperating - monthAds - monthFixed;
  const notifications = [
    ...lowStock.map((row) => ({ icon: Boxes, color: "#B91C1C", text: `المخزون منخفض: ${row.name} — المتبقي ${row.remaining}` })),
    ...overdueOrders.map((row) => ({ icon: AlertTriangle, color: "#B45309", text: `أوردر متأخر يحتاج متابعة: ${row.id} — ${row.status}` })),
    ...collectionIssues.map((row) => ({ icon: Truck, color: "#B45309", text: `فرق تحصيل يحتاج تسوية: ${row.company} بتاريخ ${row.date}` })),
    ...pendingExpenses.map((row) => ({ icon: Wallet, color: "#B45309", text: `مصروف بانتظار الاعتماد: ${fmt(row.amount)} — ${row.type}` })),
    ...(!isClosedToday ? [{ icon: CalendarCheck, color: "#6E1E24", text: `لم يتم إغلاق يوم ${today} بعد.` }] : []),
  ];

  const addCustomer = async () => {
    const row = { ...customerForm, id: customerForm.id.trim() || `CUS-${Date.now()}`, name: customerForm.name.trim(), phone: customerForm.phone.trim(), notes: customerForm.notes.trim() };
    if (!row.name) return setNotice("أدخل اسم العميل أولًا.");
    if (await update("customers", [...customers, row])) { setNotice("تمت إضافة العميل."); setCustomerForm({ id: "", name: "", phone: "", notes: "" }); }
  };
  const addSupplier = async () => {
    const row = { ...supplierForm, id: supplierForm.id.trim() || `SUP-${Date.now()}`, name: supplierForm.name.trim(), phone: supplierForm.phone.trim(), notes: supplierForm.notes.trim() };
    if (!row.name) return setNotice("أدخل اسم المورد أولًا.");
    if (await update("suppliers", [...suppliers, row])) { setNotice("تمت إضافة المورد."); setSupplierForm({ id: "", name: "", phone: "", notes: "" }); }
  };
  const addReturn = async () => {
    const order = data.orders.find((row) => row.id === returnForm.orderId);
    if (!order) return setNotice("اختر أوردرًا صحيحًا للمرتجع.");
    const row = { id: `RET-${Date.now()}`, orderId: order.id, date: today, product: order.product, qty: Number(returnForm.qty), refundAmount: Number(returnForm.refundAmount) || 0, reason: returnForm.reason.trim(), status: "pending" };
    if (!row.reason || row.qty < 1) return setNotice("أدخل كمية وسبب المرتجع.");
    if (await update("returns", [...returns, row])) { setNotice("تم تسجيل المرتجع للمراجعة."); setReturnForm({ ...returnForm, qty: 1, refundAmount: "", reason: "" }); }
  };
  const setReturnStatus = async (id, status) => {
    const next = returns.map((row) => row.id === id ? { ...row, status } : row);
    if (await update("returns", next)) setNotice(`تم تحديث حالة المرتجع إلى ${opStatusText(status)}.`);
  };
  const addExpenseApproval = async () => {
    const row = { id: `EXP-${Date.now()}`, ...expenseForm, amount: Number(expenseForm.amount) || 0, status: "pending" };
    if (!row.date || !row.type.trim() || row.amount < 0) return setNotice("أدخل بيانات المصروف بشكل صحيح.");
    if (await update("expenseApprovals", [...expenseApprovals, row])) { setNotice("تم إدخال المصروف بانتظار الاعتماد."); setExpenseForm({ ...expenseForm, amount: "", notes: "" }); }
  };
  const setExpenseStatus = async (id, status) => {
    const next = expenseApprovals.map((row) => row.id === id ? { ...row, status } : row);
    if (await update("expenseApprovals", next)) setNotice(`تم تحديث اعتماد المصروف إلى ${opStatusText(status)}.`);
  };
  const settleCollection = async (index) => {
    const next = data.collections.map((row, rowIndex) => rowIndex === index ? { ...row, settled: true, settledAt: new Date().toISOString() } : row);
    if (await update("collections", next)) setNotice("تم تسجيل تسوية التحصيل.");
  };
  const closeToday = async () => {
    if (isClosedToday) return setNotice("اليوم مغلق بالفعل.");
    const snapshot = { id: `CLOSE-${today}`, date: today, totalOrders: todayOrders.length, deliveredCount: todayOrders.filter((row) => row.status === "تم التسليم").length, returnedCount: todayOrders.filter((row) => row.status === "مرتجع").length, totalSales: todayOrders.filter((row) => row.status === "تم التسليم").reduce((sum, row) => sum + row.totalSale, 0), operatingProfit: todayOrders.reduce((sum, row) => sum + row.netProfit, 0), status: "closed", closedAt: new Date().toISOString() };
    if (await update("dailyClosures", [...dailyClosures, snapshot])) setNotice(`تم إغلاق يوم ${today} واعتماد ملخصه.`);
  };
  const downloadBackup = () => {
    const payload = JSON.stringify({ app: "ZARO ERP", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }));
    link.download = `zaro_backup_${today}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("تم تنزيل نسخة احتياطية JSON محلية. احتفظ بها في مكان آمن.");
  };
  const restoreBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("سيتم استبدال بيانات النظام الحالية بمحتوى النسخة الاحتياطية. تأكد من وجود نسخة حديثة قبل المتابعة. هل تريد الاستمرار؟")) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== "ZARO ERP" || !parsed?.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) throw new Error("ملف النسخة الاحتياطية غير صالح");
      const { error } = await supabase.rpc("zaro_restore_backup", { p_data: parsed });
      if (error) throw error;
      setNotice("تم استرجاع النسخة الاحتياطية بنجاح. سيتم تحديث الشاشة.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setNotice(`تعذر استرجاع النسخة الاحتياطية: ${error?.message || "تحقق من الملف والصلاحيات"}`);
    }
  };

  return (
    <div className="space-y-5">
      {notice && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">{notice}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="تنبيهات تحتاج متابعة" value={notifications.length} icon={Bell} negative={notifications.length > 0} />
        <Card label="مرتجعات مفتوحة" value={openReturns.length} icon={RotateCcw} negative={openReturns.length > 0} />
        <Card label="مصروفات معلقة" value={pendingExpenses.length} icon={Wallet} negative={pendingExpenses.length > 0} />
        <Card label="طلبات متأخرة" value={overdueOrders.length} icon={AlertTriangle} negative={overdueOrders.length > 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div className="flex items-center justify-between gap-2 mb-2"><div className="text-xs font-bold" style={{ color: BURGUNDY }}>الإغلاق اليومي</div><CalendarCheck size={16} color={BURGUNDY} /></div>
          <div className="text-xs text-gray-600 mb-3">اعتماد ملخص اليوم بعد مراجعة الأوردرات والتحصيلات والمصاريف.</div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3"><Row label="أوردرات اليوم" value={todayOrders.length} /><Row label="مبيعات اليوم" value={fmt(todayOrders.filter((row) => row.status === "تم التسليم").reduce((sum, row) => sum + row.totalSale, 0))} /><Row label="تم التسليم" value={todayOrders.filter((row) => row.status === "تم التسليم").length} /><Row label="المرتجع" value={todayOrders.filter((row) => row.status === "مرتجع").length} /></div>
          <Btn icon={CalendarCheck} onClick={closeToday} disabled={isClosedToday}>{isClosedToday ? "اليوم مغلق" : "اعتماد إغلاق اليوم"}</Btn>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5" }}>
          <div className="flex items-center justify-between gap-2 mb-2"><div className="text-xs font-bold" style={{ color: BURGUNDY }}>مركز التنبيهات</div><Bell size={16} color={BURGUNDY} /></div>
          {notifications.length === 0 ? <div className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 size={14} /> لا توجد تنبيهات معلقة.</div> : <div className="space-y-2 max-h-40 overflow-auto">{notifications.slice(0, 8).map((item, index) => <div key={index} className="flex items-start gap-2 text-xs text-gray-700"><item.icon size={14} color={item.color} className="mt-0.5 shrink-0" />{item.text}</div>)}</div>}
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5" }}>
        <div className="flex flex-wrap items-end gap-2 mb-3"><div className="text-xs font-bold flex-1" style={{ color: BURGUNDY }}>التقرير الشهري</div><div><label className="text-[10px] text-gray-500">الشهر</label><Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></div><><Btn variant="secondary" icon={FileDown} onClick={downloadBackup}>نسخة احتياطية JSON</Btn><label className="inline-flex items-center justify-center rounded-lg border border-[#6E1E24] px-3 py-2 text-xs font-bold text-[#6E1E24] cursor-pointer hover:bg-[#F8EFF0]">استرجاع JSON<input className="hidden" type="file" accept="application/json,.json" onChange={restoreBackup} /></label></></div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2"><Card label="الأوردرات" value={monthOrders.length} /><Card label="التسليم" value={monthDelivered.length} positive /><Card label="المرتجع" value={monthReturned.length} negative={monthReturned.length > 0} /><Card label="المبيعات" value={fmt(monthSales)} /><Card label="مصاريف الإعلان" value={fmt(monthAds)} /><Card label="صافي الشهر" value={fmt(monthNet)} positive={monthNet >= 0} negative={monthNet < 0} /></div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5" }}>
        <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: BURGUNDY }}><Truck size={15} /> تسويات الشحن والتحصيلات</div>
        <div className="rounded border overflow-x-auto"><table className="w-full"><thead><tr><Th>التاريخ</Th><Th>الشركة</Th><Th>المفروض</Th><Th>المستلم</Th><Th>الفرق</Th><Th>الحالة</Th><Th></Th></tr></thead><tbody>{collectionsComputed.map((row, index) => <tr key={`${row.date}-${row.company}-${index}`}><Td>{row.date}</Td><Td>{row.company}</Td><Td>{fmt(row.expected)}</Td><Td>{fmt(row.received)}</Td><Td className="font-bold" style={{ color: row.diff === 0 ? "#15803D" : "#B91C1C" }}>{fmt(row.diff)}</Td><Td>{row.settled ? "✔ تمت التسوية" : row.statusLabel}</Td><Td>{!row.settled && <Btn variant="secondary" onClick={() => settleCollection(index)}>تسجيل التسوية</Btn>}</Td></tr>)}</tbody></table></div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <OperationsEntityCard title="العملاء" icon={UserRound} fields={customerForm} setFields={setCustomerForm} fieldsConfig={[["id", "المعرف"], ["name", "الاسم"], ["phone", "الهاتف"], ["notes", "ملاحظات"]]} onAdd={addCustomer} rows={customers} columns={[["id", "المعرف"], ["name", "الاسم"], ["phone", "الهاتف"]]} />
        <OperationsEntityCard title="الموردون" icon={Building2} fields={supplierForm} setFields={setSupplierForm} fieldsConfig={[["id", "المعرف"], ["name", "الاسم"], ["phone", "الهاتف"], ["notes", "ملاحظات"]]} onAdd={addSupplier} rows={suppliers} columns={[["id", "المعرف"], ["name", "الاسم"], ["phone", "الهاتف"]]} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>المرتجعات والاسترداد</div>
          <div className="grid grid-cols-2 gap-2 items-end"><div><label className="text-[10px] text-gray-500">الأوردر</label><Select value={returnForm.orderId} onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value })}>{data.orders.map((row) => <option key={row.id} value={row.id}>{row.id} — {row.product}</option>)}</Select></div><div><label className="text-[10px] text-gray-500">الكمية</label><Input type="number" min="1" value={returnForm.qty} onChange={(e) => setReturnForm({ ...returnForm, qty: e.target.value })} /></div><div><label className="text-[10px] text-gray-500">مبلغ الرد</label><Input type="number" min="0" value={returnForm.refundAmount} onChange={(e) => setReturnForm({ ...returnForm, refundAmount: e.target.value })} /></div><div><label className="text-[10px] text-gray-500">السبب</label><Input value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} /></div></div>
          <div className="mt-2"><Btn icon={RotateCcw} onClick={addReturn}>تسجيل للمراجعة</Btn></div>
          <div className="mt-3 rounded border overflow-x-auto"><table className="w-full"><thead><tr><Th>الأوردر</Th><Th>المنتج</Th><Th>المبلغ</Th><Th>الحالة</Th><Th></Th></tr></thead><tbody>{returns.slice(-8).reverse().map((row) => <tr key={row.id}><Td>{row.orderId}</Td><Td>{row.product}</Td><Td>{fmt(row.refundAmount)}</Td><Td>{opStatusText(row.status)}</Td><Td>{row.status === "pending" && <div className="flex gap-1"><button title="اعتماد" onClick={() => setReturnStatus(row.id, "approved")}><CheckCircle2 size={14} color="#15803D" /></button><button title="رفض" onClick={() => setReturnStatus(row.id, "rejected")}><XCircle size={14} color="#B91C1C" /></button></div>}{row.status === "approved" && <button title="تأكيد رد المبلغ" onClick={() => setReturnStatus(row.id, "refunded")}><CheckCircle2 size={14} color="#15803D" /></button>}</Td></tr>)}</tbody></table></div>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>اعتماد المصاريف</div>
          <div className="grid grid-cols-2 gap-2 items-end"><div><label className="text-[10px] text-gray-500">التاريخ</label><Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></div><div><label className="text-[10px] text-gray-500">النوع</label><Input value={expenseForm.type} onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })} /></div><div><label className="text-[10px] text-gray-500">المبلغ</label><Input type="number" min="0" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div><div><label className="text-[10px] text-gray-500">ملاحظات</label><Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></div></div>
          <div className="mt-2"><Btn icon={Plus} onClick={addExpenseApproval}>إضافة مصروف للمراجعة</Btn></div>
          <div className="mt-3 rounded border overflow-x-auto"><table className="w-full"><thead><tr><Th>التاريخ</Th><Th>النوع</Th><Th>المبلغ</Th><Th>الحالة</Th><Th></Th></tr></thead><tbody>{expenseApprovals.slice(-8).reverse().map((row) => <tr key={row.id}><Td>{row.date}</Td><Td>{row.type}</Td><Td>{fmt(row.amount)}</Td><Td>{opStatusText(row.status)}</Td><Td>{row.status === "pending" && <div className="flex gap-1"><button title="اعتماد" onClick={() => setExpenseStatus(row.id, "approved")}><CheckCircle2 size={14} color="#15803D" /></button><button title="رفض" onClick={() => setExpenseStatus(row.id, "rejected")}><XCircle size={14} color="#B91C1C" /></button></div>}</Td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}

function OperationsEntityCard({ title, icon: Icon, fields, setFields, fieldsConfig, onAdd, rows, columns }) {
  return <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}><div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: BURGUNDY }}><Icon size={15} />{title}</div><div className="grid grid-cols-2 gap-2 items-end">{fieldsConfig.map(([key, label]) => <div key={key}><label className="text-[10px] text-gray-500">{label}</label><Input value={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} /></div>)}</div><div className="mt-2"><Btn icon={Plus} onClick={onAdd}>إضافة</Btn></div><div className="mt-3 rounded border overflow-x-auto"><table className="w-full"><thead><tr>{columns.map(([, label]) => <Th key={label}>{label}</Th>)}</tr></thead><tbody>{rows.slice(-6).reverse().map((row) => <tr key={row.id}>{columns.map(([key]) => <Td key={key}>{row[key] || "—"}</Td>)}</tr>)}</tbody></table></div></div>;
}

function UsersTab() {
  const [profiles, setProfiles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditAvailable, setAuditAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setErrorMessage("");
    const [{ data: profileRows, error: profileError }, { data: inviteRows, error: inviteError }, { data: auditRows, error: auditError }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at", { ascending: false }),
      supabase.from("invited_users").select("email, role, invited_by, created_at").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, details, created_at").order("created_at", { ascending: false }).limit(25),
    ]);
    setProfiles(profileRows || []);
    setInvites(inviteRows || []);
    setAuditLogs(auditRows || []);
    setAuditAvailable(!auditError);
    if (profileError || inviteError) setErrorMessage("تعذر تحميل المستخدمين أو الدعوات. تأكد من تطبيق migrations المطلوبة ثم حاول مرة أخرى.");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (id, role) => {
    const target = profiles.find((profile) => profile.id === id);
    if (role === "owner" && target?.role !== "owner" && !window.confirm(`منح ${target?.email || "هذا المستخدم"} صلاحية مالك يعطيه تحكمًا كاملًا في النظام. هل تريد المتابعة؟`)) return;
    if (role !== target?.role && role !== "owner" && !window.confirm(`تغيير صلاحية ${target?.email || "هذا المستخدم"} إلى ${roleText(role)}؟`)) return;
    setErrorMessage("");
    setSuccessMessage("");
    const { error } = await supabase.rpc("zaro_set_user_role", { p_user_id: id, p_role: role });
    if (error) {
      setErrorMessage(error.message || "تعذر تحديث الصلاحية. حاول مرة أخرى.");
      return;
    }
    setSuccessMessage("تم تحديث الصلاحية وتسجيل العملية.");
    load();
  };

  const addInvite = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setErrorMessage("");
    setSuccessMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage("اكتب إيميل صحيحًا أولاً.");
      return;
    }
    if (inviteRole === "owner" && !window.confirm("هذه الدعوة ستمنح Owner تلقائيًا عند تسجيل الإيميل. هل تريد المتابعة؟")) return;
    setSaving(true);
    const { error } = await supabase.from("invited_users").upsert({ email: normalizedEmail, role: inviteRole });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message || "تعذر حفظ الدعوة. حاول مرة أخرى.");
      return;
    }
    setEmail("");
    setSuccessMessage(`تمت إضافة ${normalizedEmail} بصلاحية ${roleText(inviteRole)}.`);
    load();
  };

  const removeInvite = async (inviteEmail) => {
    if (!window.confirm(`حذف دعوة ${inviteEmail}؟`)) return;
    setErrorMessage("");
    const { error } = await supabase.from("invited_users").delete().eq("email", inviteEmail);
    if (error) {
      setErrorMessage(error.message || "تعذر حذف الدعوة.");
      return;
    }
    setSuccessMessage("تم حذف الدعوة.");
    load();
  };

  const roleText = (r) =>
    r === "pending" ? "بانتظار الموافقة" : r === "owner" ? "مالك" : r === "accountant" ? "محاسب" : "مشاهدة فقط";
  const actionText = (action) => action === "change_role" ? "تغيير صلاحية" : action === "update_section" ? "تعديل بيانات" : action === "inventory_movement" ? "حركة مخزون" : action;

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-500 text-xs"><Loader2 className="animate-spin" size={16} /> جاري التحميل...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2"><div className="text-xs text-gray-500">إدارة الدعوات والأدوار وسجل العمليات الحساسة.</div><Btn variant="secondary" icon={RefreshCw} onClick={load}>تحديث</Btn></div>
      {errorMessage && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</div>}
      {successMessage && <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{successMessage}</div>}

      <div className="rounded-xl border p-4" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
        <div className="text-xs font-bold mb-1" style={{ color: BURGUNDY }}>إضافة شخص جديد</div>
        <div className="text-[10px] text-gray-500 mb-3">حدّد الإيميل والصلاحية مسبقًا. عند التسجيل بالإيميل نفسه سيحصل الشخص على الصلاحية المحددة تلقائيًا.</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div><label className="text-[10px] text-gray-500">الإيميل</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" dir="ltr" /></div>
          <div><label className="text-[10px] text-gray-500">الصلاحية</label><Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}><option value="viewer">مشاهدة فقط</option><option value="accountant">محاسب</option><option value="owner">مالك</option></Select></div>
          <Btn icon={Plus} onClick={addInvite} disabled={saving}>{saving ? "جارٍ الحفظ..." : "إضافة"}</Btn>
        </div>
      </div>

      {invites.length > 0 && (
        <div><div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>الدعوات المسبقة</div><div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}><table className="w-full"><thead><tr><Th>الإيميل</Th><Th>الصلاحية</Th><Th>أُضيفت في</Th><Th></Th></tr></thead><tbody>{invites.map((invite) => <tr key={invite.email}><Td dir="ltr">{invite.email}</Td><Td className="font-bold" style={{ color: BURGUNDY }}>{roleText(invite.role)}</Td><Td>{invite.created_at ? new Date(invite.created_at).toLocaleDateString("ar-EG") : "—"}</Td><Td><button title="حذف الدعوة" onClick={() => removeInvite(invite.email)}><Trash2 size={13} color="#B91C1C" /></button></Td></tr>)}</tbody></table></div></div>
      )}

      <div><div className="text-xs font-bold mb-2" style={{ color: BURGUNDY }}>المستخدمون الحاليون</div><div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}><table className="w-full"><thead><tr><Th>الإيميل</Th><Th>الاسم</Th><Th>الصلاحية الحالية</Th><Th>تغيير الصلاحية</Th></tr></thead><tbody>{profiles.map((p) => <tr key={p.id}><Td dir="ltr">{p.email}</Td><Td>{p.full_name || "—"}</Td><Td className="font-bold" style={{ color: p.role === "pending" ? "#B45309" : BURGUNDY }}>{roleText(p.role)}</Td><Td><Select value={p.role} onChange={(e) => setRole(p.id, e.target.value)}><option value="pending">بانتظار الموافقة</option><option value="accountant">محاسب</option><option value="viewer">مشاهدة فقط</option><option value="owner">مالك</option></Select></Td></tr>)}</tbody></table></div></div>

      <div><div className="flex items-center gap-1 text-xs font-bold mb-2" style={{ color: BURGUNDY }}><History size={14} /> سجل العمليات</div>{!auditAvailable ? <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">سجل التدقيق سيظهر بعد تطبيق migration الخاصة به.</div> : auditLogs.length === 0 ? <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">لا توجد عمليات مسجلة بعد.</div> : <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}><table className="w-full"><thead><tr><Th>الوقت</Th><Th>العملية</Th><Th>الكيان</Th><Th>المعرف</Th><Th>المستخدم</Th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id}><Td>{new Date(log.created_at).toLocaleString("ar-EG")}</Td><Td>{actionText(log.action)}</Td><Td>{log.entity_type}</Td><Td>{log.entity_id || "—"}</Td><Td dir="ltr">{log.actor_id ? `${log.actor_id.slice(0, 8)}…` : "system"}</Td></tr>)}</tbody></table></div>}</div>
    </div>
  );
}
