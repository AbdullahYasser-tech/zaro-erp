import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, Truck, Wallet,
  Calculator, Plus, Trash2, Download, Loader2, TrendingUp, TrendingDown, Printer,
  LogOut, Users,
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
    { code: "WATCH01", name: "ساعة ZARO كلاسيك", price: 1200, cost: 450 },
    { code: "WALLET01", name: "محفظة جلد طبيعي", price: 450, cost: 150 },
    { code: "BELT01", name: "حزام جلد مزخرف", price: 350, cost: 100 },
    { code: "SUNGLASS01", name: "نظارة شمس ZARO", price: 550, cost: 180 },
  ],
  inventory: [
    { code: "WATCH01", available: 40 },
    { code: "WALLET01", available: 60 },
    { code: "BELT01", available: 80 },
    { code: "SUNGLASS01", available: 50 },
  ],
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
};

const STORAGE_KEY = "zaro-erp-data-v1";
const fmt = (n) => (isFinite(n) ? Math.round(n).toLocaleString("en-US") : "0") + " ج.م";
const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1) : "0") + "%";

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
        setData(row.data);
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
    setData((prev) => ({ ...prev, [section]: next }));
    setSaveState("saving");
    skipNextRealtime.current = true;
    const { error } = await supabase.rpc("zaro_update_section", { p_section: section, p_payload: next });
    setSaveState(error ? "error" : "saved");
    setTimeout(() => setSaveState("idle"), 1200);
    if (error) console.error(error);
  }, []);

  return { data, saveSection, loading, saveState };
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
  const { data, saveSection, loading, saveState } = useZaroData(role);
  const [tab, setTab] = useState("dashboard");

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
  const update = (key, next) => saveSection(key, next);
  const addRow = (key, row) => update(key, [...data[key], row]);
  const removeRow = (key, idx) => update(key, data[key].filter((_, i) => i !== idx));
  const editRow = (key, idx, field, value) =>
    update(key, data[key].map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const editCpp = (field, value) => update("cpp", { ...data.cpp, [field]: value });

  // ---------- export ----------
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dashRows), "Dashboard");

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        computedOrders.map((o) => ({
          "رقم الأوردر": o.id, التاريخ: o.date, العميل: o.customer, المنتج: o.product, الكمية: o.qty,
          "سعر الوحدة": o.unitPrice, "إجمالي البيع": o.totalSale, "تكلفة الوحدة": o.unitCost,
          "إجمالي التكلفة": o.totalCost, "شركة الشحن": o.company, "تكلفة الشحن": o.shipCost,
          "عمولة التحصيل": Math.round(o.codFee), الحالة: o.status, "صافي الربح": Math.round(o.netProfit), ملاحظات: o.notes,
        }))
      ),
      "الأوردرات"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        productStats.map((p) => ({
          كود: p.code, الاسم: p.name, "سعر البيع": p.price, التكلفة: p.cost,
          "هامش الوحدة": p.price - p.cost, "عدد المُسلّم": p.deliveredCount, "إجمالي الربح": Math.round(p.totalProfit),
        }))
      ),
      "المنتجات"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        inventoryComputed.map((i) => ({
          كود: i.code, المنتج: i.name, المتاح: i.available, "المُباع (مُسلّم)": i.sold,
          المتبقي: i.remaining, "تكلفة الوحدة": i.unitCost, "قيمة المخزون": Math.round(i.value),
        }))
      ),
      "المخزون"
    );

    const shipRows = [
      ["شركات الشحن"],
      ["الاسم", "تكلفة الشحن", "نسبة العمولة", "مدة التحصيل"],
      ...data.shippingCompanies.map((c) => [c.name, c.cost, pct(c.feePct), c.days]),
      [],
      ["التحصيلات"],
      ["التاريخ", "الشركة", "عدد المُسلّم", "المفروض تحصيله", "المستلم فعليًا", "الفرق", "الحالة"],
      ...collectionsComputed.map((c) => [c.date, c.company, c.deliveredCount, Math.round(c.expected), c.received, Math.round(c.diff), c.statusLabel]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(shipRows), "الشحن");

    const expRows = [
      ["مصاريف الإعلانات"],
      ["التاريخ", "المنصة", "المبلغ", "عدد الأوردرات"],
      ...data.ads.map((a) => [a.date, a.platform, a.amount, a.orders]),
      [],
      ["المصاريف الثابتة"],
      ["الشهر", "البند", "المبلغ"],
      ...data.fixedCosts.map((f) => [f.month, f.item, f.amount]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), "المصاريف");

    const cppRows = [
      ["Max CPP Calculator"],
      ["سعر البيع", cpp.salePrice], ["تكلفة المنتج", cpp.cost], ["شحن ذهاب", cpp.shipFwd],
      ["شحن مرتجع", cpp.shipRet], ["نسبة عمولة التحصيل", pct(cpp.codFeePct)], ["نسبة التأكيد", pct(cpp.confRate)],
      ["نسبة التسليم", pct(cpp.delRate)], ["أوردرات متوقعة شهريًا", cpp.expectedOrders], ["هامش الربح المطلوب", pct(cpp.marginPct)],
      [], ["تكلفة ثابتة لكل أوردر", Math.round(fixedPerOrder)], ["أقصى تكلفة شراء (Max CPP)", Math.round(maxCpp)],
      ["CPP الفعلي الحالي", cpp.actualCpp], ["القرار", decision],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cppRows), "Max CPP");

    XLSX.writeFile(wb, `zaro_business_system_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "الأوردرات", icon: ShoppingCart },
    { id: "products", label: "المنتجات", icon: Package },
    { id: "inventory", label: "المخزون", icon: Boxes },
    { id: "shipping", label: "الشحن", icon: Truck },
    { id: "expenses", label: "المصاريف", icon: Wallet },
    { id: "cpp", label: "Max CPP", icon: Calculator },
    ...(isOwner ? [{ id: "users", label: "المستخدمين", icon: Users }] : []),
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
        <div className="flex items-center gap-2">
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
          <Btn onClick={exportExcel} icon={Download}>تصدير Excel</Btn>
          <button onClick={onSignOut} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-1" title="تسجيل خروج">
            <LogOut size={15} />
          </button>
        </div>
      </div>

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
        {tab === "dashboard" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="إجمالي الأوردرات" value={data.orders.length} icon={ShoppingCart} />
              <Card label="تم تسليمها" value={delivered.length} icon={TrendingUp} positive />
              <Card label="مرتجعة" value={returned.length} icon={TrendingDown} negative />
              <Card label="نسبة التسليم" value={pct(deliveryRate)} icon={Truck} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="إجمالي المبيعات" value={fmt(totalSales)} />
              <Card label="تكلفة المنتجات" value={fmt(totalCOGS)} />
              <Card label="تكلفة الشحن" value={fmt(totalShip)} />
              <Card label="عمولات التحصيل" value={fmt(totalCOD)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card label="الربح التشغيلي" value={fmt(operatingProfit)} positive={operatingProfit >= 0} negative={operatingProfit < 0} />
              <Card label="مصاريف الإعلانات" value={fmt(totalAds)} />
              <Card label="المصاريف الثابتة" value={fmt(totalFixed)} />
              <Card label="صافي الربح النهائي" value={fmt(finalProfit)} big positive={finalProfit >= 0} negative={finalProfit < 0} />
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E5D3D5" }}>
              <div className="px-3 py-2 text-xs font-bold" style={{ background: SECTION_BG, color: BURGUNDY }}>
                ترتيب المنتجات حسب الربحية
              </div>
              <table className="w-full">
                <thead><tr><Th>المنتج</Th><Th>أوردرات مُسلّمة</Th><Th>إجمالي الربح</Th></tr></thead>
                <tbody>
                  {productStats.map((p, i) => (
                    <tr key={i}>
                      <Td>{p.name}</Td><Td>{p.deliveredCount}</Td>
                      <Td className="font-bold" style={{ color: BURGUNDY }}>{fmt(p.totalProfit)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
          <InventoryTab inventoryComputed={inventoryComputed} editRow={editRow} readOnly={!canEditOther} />
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

function OrdersTab({ data, computedOrders, addRow, removeRow, editRow, readOnly }) {
  const [form, setForm] = useState({ id: "", date: "", customer: "", product: data.products[0]?.name || "", qty: 1, company: data.shippingCompanies[0]?.name || "", status: STATUS_OPTIONS[0], notes: "" });
  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-8 gap-2 items-end" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div><label className="text-[10px] text-gray-500">رقم الأوردر</label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="ORD-1005" /></div>
          <div><label className="text-[10px] text-gray-500">التاريخ</label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">العميل</label><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">المنتج</label>
            <Select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
              {data.products.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
            </Select>
          </div>
          <div><label className="text-[10px] text-gray-500">الكمية</label><Input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">شركة الشحن</label>
            <Select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
              {data.shippingCompanies.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </Select>
          </div>
          <div><label className="text-[10px] text-gray-500">الحالة</label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <Btn icon={Plus} onClick={() => { if (!form.id) return; addRow("orders", form); setForm({ ...form, id: "", customer: "" }); }}>
            إضافة
          </Btn>
        </div>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
        <table className="w-full">
          <thead><tr>
            <Th>رقم</Th><Th>التاريخ</Th><Th>العميل</Th><Th>المنتج</Th><Th>كمية</Th>
            <Th>إجمالي البيع</Th><Th>الشحن</Th><Th>شركة الشحن</Th><Th>الحالة</Th><Th>صافي الربح</Th><Th></Th>
          </tr></thead>
          <tbody>
            {computedOrders.map((o, i) => (
              <tr key={i}>
                <Td>{o.id}</Td><Td>{o.date}</Td><Td>{o.customer}</Td><Td>{o.product}</Td><Td>{o.qty}</Td>
                <Td>{fmt(o.totalSale)}</Td><Td>{fmt(o.shipCost)}</Td><Td>{o.company}</Td>
                <Td>
                  <Select value={o.status} disabled={readOnly} onChange={(e) => editRow("orders", i, "status", e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Td>
                <Td className="font-bold" style={{ color: o.netProfit >= 0 ? "#15803D" : "#B91C1C" }}>{fmt(o.netProfit)}</Td>
                <Td>{!readOnly && <button onClick={() => removeRow("orders", i)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsTab({ data, addRow, removeRow, editRow, readOnly }) {
  const [form, setForm] = useState({ code: "", name: "", price: "", cost: "" });
  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-xl border p-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-end" style={{ borderColor: "#E5D3D5", background: SECTION_BG }}>
          <div><label className="text-[10px] text-gray-500">كود</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">الاسم</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">سعر البيع</label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div><label className="text-[10px] text-gray-500">التكلفة</label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          <Btn icon={Plus} onClick={() => {
            if (!form.name) return;
            addRow("products", { ...form, price: Number(form.price) || 0, cost: Number(form.cost) || 0 });
            addRow("inventory", { code: form.code, available: 0 });
            setForm({ code: "", name: "", price: "", cost: "" });
          }}>إضافة</Btn>
        </div>
      )}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
        <table className="w-full">
          <thead><tr><Th>كود</Th><Th>الاسم</Th><Th>سعر البيع</Th><Th>التكلفة</Th><Th>الهامش</Th><Th></Th></tr></thead>
          <tbody>
            {data.products.map((p, i) => (
              <tr key={i}>
                <Td>{p.code}</Td><Td>{p.name}</Td>
                <Td><Input type="number" disabled={readOnly} value={p.price} onChange={(e) => editRow("products", i, "price", Number(e.target.value))} /></Td>
                <Td><Input type="number" disabled={readOnly} value={p.cost} onChange={(e) => editRow("products", i, "cost", Number(e.target.value))} /></Td>
                <Td className="font-bold" style={{ color: BURGUNDY }}>{fmt(p.price - p.cost)}</Td>
                <Td>{!readOnly && <button onClick={() => removeRow("products", i)}><Trash2 size={13} color="#B91C1C" /></button>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryTab({ inventoryComputed, editRow, readOnly }) {
  return (
    <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
      <table className="w-full">
        <thead><tr><Th>المنتج</Th><Th>المتاح</Th><Th>المُباع (مُسلّم)</Th><Th>المتبقي</Th><Th>قيمة المخزون</Th><Th>الحالة</Th></tr></thead>
        <tbody>
          {inventoryComputed.map((inv, i) => (
            <tr key={i}>
              <Td>{inv.name}</Td>
              <Td><Input type="number" disabled={readOnly} value={inv.available} onChange={(e) => editRow("inventory", i, "available", Number(e.target.value))} /></Td>
              <Td>{inv.sold}</Td>
              <Td className="font-bold">{inv.remaining}</Td>
              <Td>{fmt(inv.value)}</Td>
              <Td>{inv.remaining < 5 ? <span style={{ color: "#B91C1C" }}>⚠ أعد الطلب</span> : <span style={{ color: "#15803D" }}>✔ متوفر</span>}</Td>
            </tr>
          ))}
        </tbody>
      </table>
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

function UsersTab() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = () => {
    setLoading(true);
    setErrorMessage("");
    supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setProfiles(data || []);
        if (error) setErrorMessage("تعذر تحميل المستخدمين. حاول مرة أخرى.");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (id, role) => {
    const { error } = await supabase.rpc("zaro_set_user_role", { p_user_id: id, p_role: role });
    if (error) {
      setErrorMessage("تعذر تحديث الصلاحية. حاول مرة أخرى.");
      return;
    }
    load();
  };

  const roleText = (r) =>
    r === "pending" ? "بانتظار الموافقة" : r === "owner" ? "أونر" : r === "accountant" ? "محاسب" : "مشاهدة فقط";

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <Loader2 className="animate-spin" size={16} /> جاري التحميل...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMessage && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</div>}
      <div className="text-xs text-gray-500">
        وافق على أي حساب جديد سجّل دخول بجوجل عن طريق تغيير صلاحيته من "بانتظار الموافقة" لأي صلاحية تانية.
      </div>
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "#E5D3D5" }}>
        <table className="w-full">
          <thead>
            <tr>
              <Th>الإيميل</Th>
              <Th>الاسم</Th>
              <Th>الصلاحية الحالية</Th>
              <Th>تغيير الصلاحية</Th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <Td>{p.email}</Td>
                <Td>{p.full_name || "—"}</Td>
                <Td className="font-bold" style={{ color: p.role === "pending" ? "#B45309" : BURGUNDY }}>
                  {roleText(p.role)}
                </Td>
                <Td>
                  <Select value={p.role} onChange={(e) => setRole(p.id, e.target.value)}>
                    <option value="pending">بانتظار الموافقة</option>
                    <option value="accountant">محاسب</option>
                    <option value="viewer">مشاهدة فقط</option>
                    <option value="owner">أونر</option>
                  </Select>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
