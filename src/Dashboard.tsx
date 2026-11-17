import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  Truck,
  Store,
  Users,
  Wallet,
  FileCheck,
  MessageSquare,
  ChartNoAxesCombined,
  Boxes,
  Settings,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Plus,
  Download,
  LogOut,
  ShieldCheck,
  Navigation,
  Radio,
} from "lucide-react";
import { Logo, Empty, OrderList, Modal, api } from "./App";
import { money } from "../shared/catalog.mjs";
import { LiveMap } from "./LiveMap";
import { recordLabel, locationErrorLabel } from "./i18n";
export function Dashboard({
  surface,
  lang,
  t,
  user,
  me,
  setMe,
  onLogin,
  notify,
  switchLang,
}: any) {
  const sw = lang === "sw" && surface !== "admin";
  const [tab, setTab] = useState("overview"),
    [data, setData] = useState<any[]>([]),
    [orders, setOrders] = useState<any[]>([]),
    [wallet, setWallet] = useState<any>(null),
    [inspector, setInspector] = useState<any>(null),
    [inspectorPage, setInspectorPage] = useState(0),
    [earnings, setEarnings] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [page, setPage] = useState(0),
    [filter, setFilter] = useState("all"),
    [editor, setEditor] = useState<any>(null),
    [online, setOnline] = useState(false),
    [gpsError, setGpsError] = useState(""),
    [gpsTime, setGpsTime] = useState<Date | null>(null),
    [amount, setAmount] = useState(""),
    [day, setDay] = useState(
      new Date().toLocaleDateString("en-CA", {
        timeZone: "Africa/Dar_es_Salaam",
      }),
    );
  const previous = useRef<number | null>(null);
  useEffect(() => {
    setOnline(!!me?.driver?.online);
  }, [me?.driver?.online]);
  const admin = surface === "admin",
    driver = surface === "driver",
    partner = surface === "partner",
    approved = admin
      ? me?.admin
      : driver
        ? me?.driver?.status === "approved"
        : me?.shop?.status === "approved";
  const tabs = admin
    ? [
        [LayoutDashboard, "Overview", "overview"],
        [Package, "Orders", "orders"],
        [Navigation, "Dispatch", "dispatch"],
        [Store, "Stores", "stores"],
        [Users, "Drivers", "drivers"],
        [Wallet, "Wallets", "wallets"],
        [FileCheck, "Documents", "documents"],
        [MessageSquare, "Problems", "problems"],
        [ChartNoAxesCombined, "Analytics", "analytics"],
        [Boxes, "Stock", "stock"],
        [Settings, "Settings", "settings"],
      ]
    : driver
      ? [
          [LayoutDashboard, t.dashboard, "overview"],
          [Truck, t.deliveries, "orders"],
          [Wallet, t.wallet, "wallet"],
        ]
      : [
          [LayoutDashboard, t.dashboard, "overview"],
          [Package, sw ? "Oda" : "Orders", "orders"],
          [Boxes, t.products, "products"],
          [Wallet, t.earnings, "wallet"],
          [Store, sw ? "Duka langu" : "My shop", "shop"],
        ];
  useEffect(() => {
    if (!inspector?.userId) return;
    api(
      "/admin/drivers/" +
        encodeURIComponent(inspector.userId) +
        "/wallet?page=" +
        inspectorPage,
    )
      .then((wallet) =>
        setInspector((previous: any) => ({ ...previous, wallet })),
      )
      .catch((e: any) => setError(e.message));
  }, [inspector?.userId, inspectorPage]);
  async function refresh() {
    if (!user || !approved) return;
    try {
      setError("");
      const oo = await api("/orders?page=" + page);
      setOrders(oo);
      if (admin && previous.current !== null && oo[0]?.id > previous.current) {
        notify("New order received");
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("DBD · New order", {
            body: "A new order is ready for review.",
          });
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(ctx.destination);
          g.gain.value = 0.07;
          osc.frequency.value = 740;
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        } catch {}
      }
      previous.current = oo[0]?.id || 0;
      if (admin && !["overview", "orders"].includes(tab))
        setData(await api("/admin/" + tab + "?page=" + page));
      else if (partner && tab === "products")
        setData(await api("/partner/products"));
      else if (tab === "wallet") {
        setWallet(await api("/wallet?page=" + page));
        if (partner)
          setEarnings(
            await api("/partner/earnings?day=" + day + "&page=" + page),
          );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(refresh, admin ? 30000 : 12000);
    window.addEventListener("dbd-live-update", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("dbd-live-update", refresh);
    };
  }, [tab, user, approved, page, day]);
  useEffect(() => {
    if (
      !driver ||
      !approved ||
      !orders.some(
        (o) =>
          o.driver_id === user?.id && ["ready", "picked_up"].includes(o.status),
      )
    )
      return;
    if (!navigator.geolocation) {
      setGpsError(t.gpsUnavailable);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      async (p) => {
        try {
          await api("/driver/position", {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
          });
          setGpsTime(new Date());
          setGpsError("");
        } catch (e: any) {
          setGpsError(e.message);
        }
      },
      (e) => setGpsError(locationErrorLabel(e.code, lang)),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [
    driver,
    approved,
    lang,
    orders.map((o) => o.id + o.status).join(","),
  ]);
  async function action(action: string, id: any, value?: any) {
    try {
      setError("");
      await api("/admin/action", { action, id, value });
      notify("Changes saved");
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function status(id: number, status: string, proofId?: number) {
    await api(
      "/orders/" + id + (status === "assign" ? "/accept" : "/status"),
      status === "assign" ? {} : { status, proofId },
    );
    await refresh();
  }
  async function onboarding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    setLoading(true);
    setError("");
    try {
      await api("/onboarding", b);
      setMe(await api("/me"));
      notify(sw ? "Usajili umehifadhiwa" : "Onboarding details saved");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function upload(kind: string, file: File) {
    try {
      await api("/uploads?kind=" + kind, file);
      setMe(await api("/me"));
      notify(sw ? "Hati imepakiwa" : "Document uploaded");
    } catch (e: any) {
      setError(e.message);
    }
  }
  const delivered = orders.filter((o) => o.status === "delivered"),
    active = orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.status),
    ),
    pending = orders.filter((o) => o.status === "placed");
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Logo
          suffix={
            admin ? "ADMIN CONSOLE" : driver ? "DRIVER" : "PARTNER PORTAL"
          }
        />
        <span className="sidebar-label">
          {admin
            ? "PLATFORM MANAGEMENT"
            : driver
              ? sw
                ? "SAFARI YAKO YA KILA SIKU"
                : "YOUR EVERYDAY ROUTE"
              : sw
                ? "BIASHARA YAKO, INAENDELEA"
                : "YOUR BUSINESS, MOVING"}
        </span>
        <nav>
          {tabs.map(([Icon, label, key]: any) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setPage(0);
              }}
            >
              <Icon size={19} />
              {label}
              {key === "orders" && pending.length > 0 && (
                <span className="nav-badge">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="dashboard-profile">
          <span className="avatar">
            {(user?.name || "D").charAt(0).toUpperCase()}
          </span>
          <div>
            <b>{user?.name || "Daily Basis Delivery"}</b>
            <small>
              {admin
                ? "Administrator"
                : driver
                  ? "DBD Driver"
                  : t.businessOwner}
            </small>
          </div>
          {user && (
            <button
              className="icon-button"
              aria-label={t.logout}
              onClick={async () => {
                await (await import("@netlify/identity")).logout();
                location.reload();
              }}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-top">
          <span>
            <span className="live-dot" />
            Dar es Salaam ·{" "}
            {new Date().toLocaleDateString(sw ? "sw-TZ" : "en-TZ", {
              timeZone: "Africa/Dar_es_Salaam",
              weekday: "short",
              day: "numeric",
              month: "long",
            })}
          </span>
          <div>
            {!admin && (
              <button className="language" onClick={switchLang}>
                SW <i /> EN
              </button>
            )}
            <span className="secure-label">
              <ShieldCheck size={15} />
              {sw ? "Akaunti salama" : "Secure workspace"}
            </span>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                {admin
                  ? "DAILY BASIS DELIVERY"
                  : driver
                    ? "DBD DRIVER"
                    : me?.shop?.name || "DBD PARTNER"}
              </span>
              <h1>
                {tab === "overview"
                  ? sw
                    ? "Karibu, tuanze."
                    : admin
                      ? "A good day starts here."
                      : driver
                        ? "Ready for the next delivery?"
                        : "Good things are happening."
                  : (tabs.find((x) => x[2] === tab)?.[1] as string)}
              </h1>
              <p>
                {admin
                  ? "Your city. Your platform. Everything in one place."
                  : sw
                    ? "Kila siku ni nafasi mpya."
                    : "Your everyday, a little more organised."}
              </p>
            </div>
            <button className="secondary" onClick={refresh}>
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              {t.refresh}
            </button>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {!user ? (
            <Empty
              icon={driver ? <Truck size={45} /> : <Store size={45} />}
              title={
                sw
                  ? "Karibu DBD"
                  : admin
                    ? "Your platform workspace"
                    : driver
                      ? "Every delivery makes a difference."
                      : "Your neighbourhood is hungry."
              }
              text={
                sw
                  ? "Ingia kuendelea kwenye akaunti yako."
                  : `Sign in to your ${driver ? "driver" : admin ? "administrator" : "partner"} account to continue.`
              }
              action={t.login}
              onClick={onLogin}
            />
          ) : !approved ? (
            admin ? (
              <Empty
                icon={<ShieldCheck size={45} />}
                title="Administrator access required"
                text="This account does not have a protected administrator role. An authorised operator must grant access."
              />
            ) : (
              <div className="onboarding-grid">
                <div className="panel">
                  <h2>
                    {driver
                      ? sw
                        ? "Kamilisha usajili wa dereva"
                        : "Complete Driver Onboarding"
                      : sw
                        ? "Kamilisha usajili wa mshirika"
                        : "Complete Partner Onboarding"}
                  </h2>
                  <p className="muted">
                    {sw
                      ? "Hifadhi maelezo yako na upakie hati kwa ukaguzi."
                      : "Save your details and upload documents for review."}
                  </p>
                  <form className="form" onSubmit={onboarding}>
                    <label>
                      {t.name}
                      <input
                        name="name"
                        defaultValue={me?.driver?.name || user.name}
                        required
                      />
                    </label>
                    <label>
                      {t.phone}
                      <input
                        type="tel"
                        name="phone"
                        defaultValue={me?.driver?.phone || me?.shop?.phone}
                        required
                      />
                    </label>
                    {driver ? (
                      <label>
                        {sw ? "Tarehe ya kuzaliwa" : "Date of birth"}
                        <input
                          type="date"
                          name="dob"
                          defaultValue={me?.driver?.dob}
                          required
                        />
                      </label>
                    ) : (
                      <>
                        <label>
                          {t.email}
                          <input type="email" value={user.email} readOnly />
                        </label>
                        <label>
                          {sw ? "Jina la biashara" : "Business name"}
                          <input
                            name="businessName"
                            defaultValue={me?.shop?.name}
                            required
                          />
                        </label>
                        <label>
                          {sw ? "Aina ya biashara" : "Business type"}
                          <select name="type">
                            <option value="restaurant">{t.restaurant}</option>
                            <option value="grocery">{t.grocery}</option>
                          </select>
                        </label>
                      </>
                    )}
                    <label>
                      {sw ? "Anwani" : "Address"}
                      <textarea
                        name="address"
                        defaultValue={me?.driver?.address || me?.shop?.address}
                        required
                      />
                    </label>
                    <button className="primary" disabled={loading}>
                      {t.save}
                      <ArrowRight size={17} />
                    </button>
                  </form>
                </div>
                <div className="panel">
                  <span className="status status-placed">{t.pending}</span>
                  <h2>{sw ? "Orodha ya hati" : "Document checklist"}</h2>
                  <p className="muted">
                    {sw
                      ? "JPG, PNG au PDF. Hadi MB 8. Huhifadhiwa kwa faragha."
                      : "JPG, PNG or PDF. Up to 8 MB. Stored privately."}
                  </p>
                  {(driver
                    ? [
                        [
                          "national_id",
                          sw ? "Kitambulisho cha Taifa" : "National ID",
                        ],
                        [
                          "licence",
                          sw ? "Leseni ya udereva" : "Driving licence",
                        ],
                        [
                          "registration",
                          sw ? "Usajili wa chombo" : "Vehicle registration",
                        ],
                        ["insurance", sw ? "Bima" : "Insurance"],
                      ]
                    : [
                        [
                          "business_licence",
                          sw ? "Leseni ya biashara" : "Business licence",
                        ],
                        [
                          "tax_certificate",
                          sw ? "Cheti cha kodi" : "Tax certificate",
                        ],
                      ]
                  ).map(([kind, label]) => {
                    const d = me?.documents
                      ?.filter((x: any) => x.kind === kind)
                      .at(-1);
                    return (
                      <label className="upload-row" key={kind}>
                        <FileCheck size={22} />
                        <span>
                          <b>{label}</b>
                          <small>
                            {d
                              ? recordLabel(d.status, lang)
                              : sw
                                ? "Haijapakiwa"
                                : "Not uploaded"}
                          </small>
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={(e) => {
                            if (e.target.files?.[0])
                              upload(kind, e.target.files[0]);
                          }}
                        />
                      </label>
                    );
                  })}
                  {driver && (
                    <div className="notice">
                      <ShieldCheck size={19} />
                      {sw
                        ? "Idhini inahitaji ukaguzi wa usuli uliopita."
                        : "Approval requires all documents and a passed background check."}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <>
              {driver && (
                <div className="driver-availability panel">
                  <div
                    className={"availability-dot " + (online ? "online" : "")}
                  />
                  <div>
                    <h3>
                      {online
                        ? sw
                          ? "Uko mtandaoni"
                          : "You’re online"
                        : sw
                          ? "Uko nje ya mtandao"
                          : "You’re offline"}
                    </h3>
                    <p>
                      {sw
                        ? "Washa upatikanaji ili kukubali usafirishaji."
                        : "Set your availability to accept deliveries."}
                    </p>
                  </div>
                  <button
                    className={"toggle " + (online ? "on" : "")}
                    role="switch"
                    aria-checked={online}
                    onClick={async () => {
                      try {
                        await api("/driver/online", { online: !online });
                        setOnline(!online);
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    <span />
                  </button>
                </div>
              )}
              {driver && (gpsError || gpsTime) && (
                <div className={"notice " + (gpsError ? "error" : "")}>
                  <Navigation size={18} />
                  {gpsError ||
                    `${gpsTime && Date.now() - gpsTime.getTime() > 120000 ? (sw ? "Eneo limechelewa" : "Position stale — over 2 minutes") : sw ? "Eneo limeshirikiwa" : "GPS shared"} · ${gpsTime?.toLocaleTimeString()}`}
                </div>
              )}
              {tab === "overview" && (
                <>
                  <div className="metric-grid">
                    {[
                      [
                        Package,
                        admin
                          ? "Orders on this page"
                          : driver
                            ? sw
                              ? "Kazi zinazopatikana"
                              : "Available jobs"
                            : sw
                              ? "Oda kwenye ukurasa"
                              : "Orders on this page",
                        driver
                          ? orders.filter((o) => !o.driver_id).length
                          : orders.length,
                      ],
                      [
                        Truck,
                        sw ? "Zinazoendelea" : "In progress",
                        active.length,
                      ],
                      [
                        CheckCircle2,
                        sw ? "Zimekamilika" : "Delivered",
                        delivered.length,
                      ],
                      [
                        Wallet,
                        admin
                          ? "Sales on this page"
                          : sw
                            ? "Mapato ya usafirishaji"
                            : "Delivery earnings",
                        money(
                          delivered.reduce(
                            (a, o) => a + (driver ? 2000 : o.subtotal),
                            0,
                          ),
                        ),
                      ],
                    ].map(([Icon, label, value]: any) => (
                      <div className="metric-card" key={label}>
                        <span>
                          <Icon size={20} />
                        </span>
                        <small>{label}</small>
                        <strong>{value}</strong>
                        <p>{sw ? "Ukurasa wa sasa" : "Current results"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="panel">
                    <div className="panel-heading">
                      <h2>{sw ? "Oda za hivi karibuni" : "Recent orders"}</h2>
                      <button
                        className="text-button"
                        onClick={() => setTab("orders")}
                      >
                        {sw ? "Ona zote" : "View all"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <OrderList
                      orders={orders.slice(0, 5)}
                      lang={admin ? "en" : lang}
                      surface={surface}
                      onAction={status}
                    />
                  </div>
                  {admin && (
                    <div className="notice">
                      <Radio size={18} />
                      Orders refresh every 30 seconds.
                      <button
                        className="text-button"
                        onClick={() => {
                          if ("Notification" in window)
                            Notification.requestPermission();
                        }}
                      >
                        Enable browser alerts
                      </button>
                    </div>
                  )}
                </>
              )}
              {tab === "orders" && (
                <>
                  <div className="table-toolbar">
                    <div className="filter-pills">
                      {[
                        "all",
                        "placed",
                        "ready",
                        "picked_up",
                        "delivered",
                        "cancelled",
                      ].map((s) => (
                        <button
                          className={filter === s ? "selected" : ""}
                          key={s}
                          onClick={() => setFilter(s)}
                        >
                          {recordLabel(s, admin ? "en" : lang)}
                        </button>
                      ))}
                    </div>
                    {admin && (
                      <a
                        className="secondary"
                        href="/api/admin/export/orders.csv"
                      >
                        <Download size={15} />
                        Export CSV
                      </a>
                    )}
                  </div>
                  <OrderList
                    orders={orders.filter(
                      (o) => filter === "all" || o.status === filter,
                    )}
                    lang={admin ? "en" : lang}
                    surface={surface}
                    onAction={status}
                  />
                </>
              )}
              {tab === "wallet" && (
                <>
                  <div className="wallet-banner">
                    <div>
                      <span>{sw ? "Salio la pochi" : "Wallet balance"}</span>
                      <h1>{money(wallet?.balance || 0)}</h1>
                      <p>
                        {sw
                          ? "Kila muamala unarekodiwa salama."
                          : "Every earning and payout, recorded in your ledger."}
                      </p>
                    </div>
                    <Wallet size={65} strokeWidth={1} />
                  </div>
                  <div className="onboarding-grid">
                    <div className="panel">
                      <h2>{sw ? "Omba malipo" : "Request a payout"}</h2>
                      <p className="muted">
                        {sw
                          ? "Kiwango cha chini TSh 1,000. Maombi yanayosubiri huhifadhi kiasi kutoka kwenye salio lako."
                          : "Minimum TSh 1,000. Pending payouts reserve your balance."}
                      </p>
                      <form
                        className="form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            await api("/withdrawals", {
                              amount: Number(amount),
                            });
                            setAmount("");
                            notify(sw ? "Ombi limetumwa" : "Payout requested");
                            refresh();
                          } catch (e: any) {
                            setError(e.message);
                          }
                        }}
                      >
                        <label>
                          {sw ? "Kiasi (TSh)" : "Amount (TSh)"}
                          <input
                            type="number"
                            min="1000"
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                          />
                        </label>
                        <button className="primary">
                          {sw ? "Omba malipo" : "Request payout"}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                      {driver && (
                        <>
                          <h3>
                            {sw ? "Rekodi matumizi" : "Record an expense"}
                          </h3>
                          <form
                            className="form"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const f = Object.fromEntries(
                                new FormData(e.currentTarget),
                              );
                              try {
                                await api("/expenses", {
                                  amount: Number(f.expense),
                                  note: f.note,
                                  key: crypto.randomUUID(),
                                });
                                notify(
                                  sw
                                    ? "Matumizi yamehifadhiwa"
                                    : "Expense recorded",
                                );
                                refresh();
                              } catch (e: any) {
                                setError(e.message);
                              }
                            }}
                          >
                            <label>
                              {sw ? "Kiasi (TSh)" : "Amount (TSh)"}
                              <input
                                type="number"
                                name="expense"
                                min="1"
                                required
                              />
                            </label>
                            <label>
                              {sw ? "Maelezo" : "Description"}
                              <input name="note" minLength={3} required />
                            </label>
                            <button className="secondary">
                              {sw ? "Hifadhi matumizi" : "Record expense"}
                            </button>
                          </form>
                        </>
                      )}
                      <h3>{sw ? "Maombi ya malipo" : "Payout requests"}</h3>
                      {wallet?.withdrawals?.length ? (
                        wallet.withdrawals.map((w: any) => (
                          <div className="order-line" key={w.id}>
                            <span>
                              #{w.id} · {money(w.amount)}
                            </span>
                            <span
                              className={
                                "status status-" +
                                (w.status === "paid" ? "delivered" : "placed")
                              }
                            >
                              {recordLabel(w.status, admin ? "en" : lang)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="muted">
                          {sw
                            ? "Hakuna maombi bado."
                            : "No payout requests yet."}
                        </p>
                      )}
                    </div>
                    <div className="panel">
                      <h2>
                        {sw ? "Historia ya miamala" : "Transaction history"}
                      </h2>
                      {wallet?.ledger?.length ? (
                        wallet.ledger.map((l: any) => (
                          <div className="ledger-row" key={l.id}>
                            <span className="order-icon">
                              <Wallet size={18} />
                            </span>
                            <div>
                              <b>{recordLabel(l.kind, lang)}</b>
                              <small>
                                {new Date(l.created_at).toLocaleString(
                                  sw ? "sw-TZ" : "en-TZ",
                                  { timeZone: "Africa/Dar_es_Salaam" },
                                )}
                              </small>
                              <small>{l.reference}</small>
                            </div>
                            <strong className={l.amount > 0 ? "positive" : ""}>
                              {l.amount > 0 ? "+" : ""}
                              {money(l.amount)}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <Empty
                          icon={<Wallet size={28} />}
                          title={
                            sw
                              ? "Pochi yako inaanza hapa"
                              : "Your wallet starts here"
                          }
                          text={
                            sw
                              ? "Mapato yataonekana hapa baada ya oda kufikishwa."
                              : "Earnings appear when an order is delivered."
                          }
                        />
                      )}
                    </div>
                  </div>
                  {partner && (
                    <div className="panel">
                      <div className="panel-heading">
                        <h2>{sw ? "Mapato ya siku" : "Daily earnings"}</h2>
                        <input
                          type="date"
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                        />
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {[
                                t.orderColumn,
                                t.saleColumn,
                                t.commissionColumn,
                                t.driverFeeColumn,
                                t.ownerShareColumn,
                              ].map((x) => (
                                <th key={x}>{x}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(earnings?.rows || []).map((o: any) => (
                              <tr key={o.id}>
                                <td>DBD-{o.id}</td>
                                <td>{money(o.subtotal)}</td>
                                <td>
                                  {money(
                                    Math.floor(
                                      (o.subtotal * o.commission_rate) / 100,
                                    ),
                                  )}
                                </td>
                                <td>{money(2000)}</td>
                                <td>
                                  {money(
                                    o.subtotal -
                                      Math.floor(
                                        (o.subtotal * o.commission_rate) / 100,
                                      ),
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="daily-totals">
                        <b>
                          {sw ? "Jumla ya siku" : "Daily totals"} ·{" "}
                          {earnings?.totals?.orders || 0}{" "}
                          {sw ? "oda" : "orders"}
                        </b>
                        <span>
                          {sw ? "Mauzo" : "Sales"}:{" "}
                          {money(earnings?.totals?.sales || 0)}
                        </span>
                        <span>
                          {sw ? "Kamisheni" : "Commission"}:{" "}
                          {money(earnings?.totals?.commission || 0)}
                        </span>
                        <strong>
                          {sw ? "Sehemu yako" : "Owner cash share"}:{" "}
                          {money(earnings?.totals?.owner_share || 0)}
                        </strong>
                      </div>
                      <p className="muted">
                        {sw
                          ? "Jumla inajumuisha oda zote za siku iliyochaguliwa."
                          : "Totals include all delivered orders for the selected Dar es Salaam day."}
                      </p>
                    </div>
                  )}
                </>
              )}
              {partner && tab === "shop" && (
                <div className="onboarding-grid">
                  <div className="panel">
                    <h2>{sw ? "Maelezo ya duka" : "Shop details"}</h2>
                    <form className="form" onSubmit={onboarding}>
                      <input type="hidden" name="name" value={user.name} />
                      <input type="hidden" name="type" value={me?.shop?.type} />
                      {[
                        [
                          "businessName",
                          sw ? "Jina la biashara" : "Business name",
                          me?.shop?.name,
                        ],
                        ["phone", t.phone, me?.shop?.phone],
                        [
                          "address",
                          sw ? "Anwani" : "Address",
                          me?.shop?.address,
                        ],
                        [
                          "description",
                          sw ? "Maelezo" : "Description",
                          me?.shop?.description,
                        ],
                        [
                          "hours",
                          sw ? "Saa za kazi" : "Opening hours",
                          me?.shop?.hours,
                        ],
                      ].map(([name, label, value]) => (
                        <label key={name}>
                          {label}
                          <input
                            name={name}
                            defaultValue={value}
                            required={name !== "description"}
                          />
                        </label>
                      ))}
                      <button className="primary">{t.save}</button>
                    </form>
                  </div>
                  <div className="panel">
                    <h2>{sw ? "Kiwango cha kamisheni" : "Commission rate"}</h2>
                    <strong className="big-number">
                      {me?.shop?.commission}%
                    </strong>
                    <p className="muted">
                      {sw
                        ? "Mabadiliko yanahitaji idhini ya msimamizi."
                        : "Proposed changes only take effect after administrator approval."}
                    </p>
                    {me?.shop?.proposed_commission != null && (
                      <p className="notice">
                        {t.pendingProposal}: {me.shop.proposed_commission}%
                      </p>
                    )}
                    <form
                      className="form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await api("/partner/commission", {
                            rate: Number(
                              new FormData(e.currentTarget).get("rate"),
                            ),
                          });
                          setMe(await api("/me"));
                          notify(t.proposalSubmitted);
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    >
                      <label>
                        {sw ? "Pendekeza kiwango (%)" : "Propose a rate (%)"}
                        <input
                          name="rate"
                          min="0"
                          max="100"
                          type="number"
                          required
                        />
                      </label>
                      <button className="secondary">
                        {sw ? "Tuma pendekezo" : "Submit proposal"}
                      </button>
                    </form>
                  </div>
                </div>
              )}
              {partner && tab === "products" && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>
                      {t.products}{" "}
                      <span className="muted">({data.length})</span>
                    </h2>
                    <button
                      className="primary"
                      onClick={() =>
                        setEditor({
                          name: "",
                          sw: "",
                          price: 0,
                          stock: 0,
                          unit: "1 piece",
                          category: "Main dishes",
                          sku: "",
                          available: true,
                        })
                      }
                    >
                      <Plus size={17} />
                      {sw ? "Ongeza bidhaa" : "Add product"}
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {[
                            t.productColumn,
                            "SKU",
                            t.priceColumn,
                            t.stockColumn,
                            t.availabilityColumn,
                            "",
                          ].map((x) => (
                            <th key={x}>{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <b>{p.name}</b>
                              <small>{p.category}</small>
                            </td>
                            <td>{p.sku}</td>
                            <td>{money(p.price)}</td>
                            <td>{p.stock}</td>
                            <td>
                              <span
                                className={
                                  "status status-" +
                                  (p.available ? "delivered" : "cancelled")
                                }
                              >
                                {p.available ? t.available : t.unavailable}
                              </span>
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => setEditor(p)}
                              >
                                {sw ? "Hariri" : "Edit"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.length && (
                    <Empty
                      icon={<Boxes size={35} />}
                      title={
                        sw
                          ? "Ongeza bidhaa yako ya kwanza"
                          : "Add your first product"
                      }
                      text={
                        sw
                          ? "Bidhaa zitaonekana kwenye duka lako."
                          : "Your products appear in your shop after you add them."
                      }
                    />
                  )}
                </div>
              )}
              {admin && !["overview", "orders"].includes(tab) && (
                <div className="panel">
                  <div className="panel-heading">
                    <h2>{tabs.find((x) => x[2] === tab)?.[1] as string}</h2>
                    <span className="muted">25 results per page</span>
                    {tab === "wallets" && (
                      <button
                        className="secondary"
                        onClick={() =>
                          setEditor({
                            action: "expense",
                            title: "Record a driver expense",
                          })
                        }
                      >
                        Record expense
                      </button>
                    )}
                    {tab === "analytics" && (
                      <a
                        className="secondary"
                        href="/api/admin/export/orders.csv"
                      >
                        <Download size={14} />
                        Export CSV
                      </a>
                    )}
                  </div>
                  {tab === "analytics" && data.length > 0 && (
                    <div
                      className="analytics-bars"
                      aria-label="Daily sales by shop"
                    >
                      {data.slice(0, 12).map((r, i) => (
                        <div key={i}>
                          <span>
                            {String(r.day).slice(0, 10)} · Shop {r.shop_id}
                          </span>
                          <div>
                            <i
                              style={{
                                width:
                                  Math.max(
                                    2,
                                    (Number(r.revenue) /
                                      Math.max(
                                        ...data.map((x) => Number(x.revenue)),
                                        1,
                                      )) *
                                      100,
                                  ) + "%",
                              }}
                            />
                          </div>
                          <b>{money(r.revenue)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === "dispatch" && (
                    <LiveMap
                      label="Live driver positions in Dar es Salaam"
                      pins={data
                        .filter((d) => d.lat != null && d.lng != null)
                        .map((d) => ({
                          id: d.user_id,
                          name: d.name,
                          lat: d.lat,
                          lng: d.lng,
                          stale:
                            !d.position_at ||
                            Date.now() - new Date(d.position_at).getTime() >
                              120000,
                        }))}
                    />
                  )}
                  {tab === "settings" ? (
                    <form
                      className="form settings-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        action(
                          "speed",
                          null,
                          Number(new FormData(e.currentTarget).get("speed")),
                        );
                      }}
                    >
                      <label>
                        City speed (km/h)
                        <input
                          name="speed"
                          type="number"
                          min="1"
                          max="100"
                          defaultValue={
                            data.find((s) => s.key === "city_speed")?.value ||
                            22
                          }
                        />
                      </label>
                      <p className="muted">
                        Used for arrival estimates. Default 22 km/h, with a 1.35
                        road-distance factor.
                      </p>
                      <button className="primary">Save settings</button>
                    </form>
                  ) : data.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {(tab === "stores"
                              ? ["Store", "Status", "Commission", "Actions"]
                              : tab === "drivers"
                                ? [
                                    "Driver",
                                    "Background check",
                                    "Status",
                                    "Actions",
                                  ]
                                : tab === "documents"
                                  ? ["Document", "Owner", "Status", "Actions"]
                                  : tab === "wallets"
                                    ? [
                                        "Request",
                                        "Owner",
                                        "Amount",
                                        "Status",
                                        "Actions",
                                      ]
                                    : tab === "problems"
                                      ? [
                                          "Order",
                                          "Problem",
                                          "Status",
                                          "Actions",
                                        ]
                                      : tab === "stock"
                                        ? [
                                            "Product",
                                            "Shop",
                                            "Stock",
                                            "Actions",
                                          ]
                                        : tab === "dispatch"
                                          ? [
                                              "Driver",
                                              "Availability",
                                              "GPS",
                                              "Dispatch",
                                            ]
                                          : [
                                              "Day (Dar)",
                                              "Shop",
                                              "Orders",
                                              "Sales",
                                              "Commission",
                                            ]
                            ).map((x) => (
                              <th key={x}>{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((r: any, i) => (
                            <tr key={r.id || r.user_id || i}>
                              {tab === "stores" ? (
                                <>
                                  <td>
                                    <b>{r.name}</b>
                                    <small>{r.address}</small>
                                  </td>
                                  <td>
                                    <span className="status">{r.status}</span>
                                  </td>
                                  <td>
                                    {r.commission}%
                                    {r.proposed_commission != null && (
                                      <button
                                        className="text-button"
                                        onClick={() =>
                                          action("commission", r.id)
                                        }
                                      >
                                        Approve {r.proposed_commission}%
                                      </button>
                                    )}
                                  </td>
                                  <td>
                                    <div className="table-actions">
                                      <button
                                        onClick={() =>
                                          action(
                                            "storeStatus",
                                            r.id,
                                            r.status === "approved"
                                              ? "suspended"
                                              : "approved",
                                          )
                                        }
                                      >
                                        {r.status === "approved"
                                          ? "Suspend"
                                          : "Approve"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          setEditor({
                                            action: "assignOwner",
                                            id: r.id,
                                            title:
                                              "Assign owner by verified email",
                                            label: "Email address",
                                            type: "email",
                                          })
                                        }
                                      >
                                        Assign owner
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : tab === "drivers" ? (
                                <>
                                  <td>
                                    <b>{r.name}</b>
                                    <small>{r.phone}</small>
                                  </td>
                                  <td>
                                    <button
                                      className="status"
                                      onClick={() =>
                                        action(
                                          "driverBackground",
                                          r.user_id,
                                          !r.background_passed,
                                        )
                                      }
                                    >
                                      {r.background_passed
                                        ? "Passed"
                                        : "Mark passed"}
                                    </button>
                                  </td>
                                  <td>{r.status}</td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        action("approveDriver", r.user_id)
                                      }
                                    >
                                      Approve driver
                                    </button>
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        setInspector({
                                          userId: r.user_id,
                                          name: r.name,
                                        });
                                        setInspectorPage(0);
                                      }}
                                    >
                                      Earnings &amp; settlements
                                    </button>
                                  </td>
                                </>
                              ) : tab === "documents" ? (
                                <>
                                  <td>
                                    <a
                                      href={"/api/documents/" + r.id}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {r.kind.replaceAll("_", " ")} ↗
                                    </a>
                                  </td>
                                  <td>{r.user_id.slice(0, 12)}…</td>
                                  <td>{r.status}</td>
                                  <td>
                                    <div className="table-actions">
                                      <button
                                        onClick={() =>
                                          action("document", r.id, "approved")
                                        }
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() =>
                                          action("document", r.id, "rejected")
                                        }
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : tab === "wallets" ? (
                                <>
                                  <td>#{r.id}</td>
                                  <td>{r.user_id.slice(0, 12)}…</td>
                                  <td>{money(r.amount)}</td>
                                  <td>{r.status}</td>
                                  <td>
                                    {r.status === "pending" && (
                                      <button
                                        className="text-button"
                                        onClick={() => action("pay", r.id)}
                                      >
                                        Mark paid
                                      </button>
                                    )}
                                  </td>
                                </>
                              ) : tab === "problems" ? (
                                <>
                                  <td>DBD-{r.order_id}</td>
                                  <td>{r.message}</td>
                                  <td>{r.status}</td>
                                  <td>
                                    {r.status === "open" && (
                                      <button
                                        className="text-button"
                                        onClick={() =>
                                          setEditor({
                                            action: "resolve",
                                            id: r.id,
                                            title: "Resolve customer problem",
                                            label: "Resolution",
                                            type: "text",
                                          })
                                        }
                                      >
                                        Resolve
                                      </button>
                                    )}
                                  </td>
                                </>
                              ) : tab === "stock" ? (
                                <>
                                  <td>
                                    <b>{r.name}</b>
                                    <small>{r.sku}</small>
                                  </td>
                                  <td>#{r.shop_id}</td>
                                  <td>{r.stock}</td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        setEditor({
                                          action: "stock",
                                          id: r.id,
                                          title: "Update stock",
                                          label: "Stock quantity",
                                          type: "number",
                                          value: r.stock,
                                        })
                                      }
                                    >
                                      Update stock
                                    </button>
                                  </td>
                                </>
                              ) : tab === "dispatch" ? (
                                <>
                                  <td>
                                    <b>{r.name}</b>
                                  </td>
                                  <td>{r.online ? "Online" : "Offline"}</td>
                                  <td>
                                    {r.lat ? (
                                      <a
                                        target="_blank"
                                        rel="noreferrer"
                                        href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=15/${r.lat}/${r.lng}`}
                                      >
                                        View position{" "}
                                        {Date.now() -
                                          new Date(r.position_at).getTime() >
                                        120000
                                          ? "(stale)"
                                          : ""}
                                      </a>
                                    ) : (
                                      "No GPS"
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        setEditor({
                                          action: "dispatch",
                                          driverId: r.user_id,
                                          title: "Assign a ready order",
                                          label: "Order number",
                                          type: "number",
                                        })
                                      }
                                    >
                                      Assign order
                                    </button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td>{String(r.day).slice(0, 10)}</td>
                                  <td>#{r.shop_id}</td>
                                  <td>{r.orders}</td>
                                  <td>{money(r.revenue)}</td>
                                  <td>{money(r.commission)}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      icon={<FileCheck size={35} />}
                      title="All clear for now"
                      text="Records appear here as your platform gets moving."
                    />
                  )}
                </div>
              )}
              {!["overview", "shop", "products", "settings"].includes(tab) && (
                <div className="pagination">
                  <button disabled={!page} onClick={() => setPage(page - 1)}>
                    {sw ? "Rudi" : "Previous"}
                  </button>
                  <span>
                    {sw ? "Ukurasa" : "Page"} {page + 1}
                  </span>
                  <button
                    disabled={
                      (admin
                        ? tab === "orders"
                          ? orders.length
                          : data.length
                        : tab === "wallet"
                          ? Math.max(
                              wallet?.ledger?.length || 0,
                              wallet?.withdrawals?.length || 0,
                              earnings?.rows?.length || 0,
                            )
                          : orders.length) < 25
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    {sw ? "Ifuatayo" : "Next"}
                  </button>
                </div>
              )}
            </>
          )}
          <div className="dashboard-footer">
            Daily Basis Delivery <span>Dar es Salaam, Tanzania · TSh</span>
          </div>
        </main>
      </div>
      {inspector && (
        <Modal lang={admin ? "en" : lang} onClose={() => setInspector(null)}>
          <span className="section-kicker">DRIVER SETTLEMENTS</span>
          <h2>{inspector.name}</h2>
          <div className="wallet-banner">
            <div>
              <span>Ledger balance</span>
              <h1>{money(inspector.wallet?.balance || 0)}</h1>
            </div>
          </div>
          {inspector.wallet?.ledger?.map((l: any) => (
            <div className="order-line" key={l.id}>
              <span>
                {l.kind}
                <small className="muted"> · {l.reference}</small>
              </span>
              <b>{money(l.amount)}</b>
            </div>
          ))}
          <h3 style={{ marginTop: 20 }}>Withdrawals</h3>
          {inspector.wallet?.withdrawals?.map((w: any) => (
            <div className="order-line" key={w.id}>
              <span>
                #{w.id} · {money(w.amount)} ·{" "}
                {recordLabel(w.status, admin ? "en" : lang)}
              </span>
              {w.status === "pending" && (
                <button
                  className="text-button"
                  onClick={async () => {
                    await action("pay", w.id);
                    const wallet = await api(
                      "/admin/drivers/" +
                        encodeURIComponent(inspector.userId) +
                        "/wallet?page=" +
                        inspectorPage,
                    );
                    setInspector({ ...inspector, wallet });
                  }}
                >
                  Mark paid
                </button>
              )}
            </div>
          ))}
          <div className="pagination">
            <button
              disabled={!inspectorPage}
              onClick={() => setInspectorPage(inspectorPage - 1)}
            >
              Previous
            </button>
            <span>{inspectorPage + 1}</span>
            <button
              disabled={
                Math.max(
                  inspector.wallet?.ledger?.length || 0,
                  inspector.wallet?.withdrawals?.length || 0,
                ) < 25
              }
              onClick={() => setInspectorPage(inspectorPage + 1)}
            >
              Next
            </button>
          </div>
        </Modal>
      )}
      {editor && (
        <Modal lang={admin ? "en" : lang} onClose={() => setEditor(null)}>
          <h2>
            {editor.title || (sw ? "Maelezo ya bidhaa" : "Product details")}
          </h2>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              try {
                if (editor.action) {
                  if (editor.action === "expense")
                    await api("/expenses", {
                      userId: f.userId,
                      amount: Number(f.amount),
                      note: f.note,
                      key: crypto.randomUUID(),
                    });
                  else if (editor.action === "dispatch")
                    await action("dispatch", Number(f.value), editor.driverId);
                  else
                    await action(
                      editor.action,
                      editor.id,
                      editor.type === "number" ? Number(f.value) : f.value,
                    );
                } else
                  await api("/partner/products", {
                    ...editor,
                    ...f,
                    price: Number(f.price),
                    stock: Number(f.stock),
                    available: f.available === "on",
                  });
                setEditor(null);
                refresh();
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            {editor.action === "expense" ? (
              <>
                <label>
                  Driver account ID
                  <input name="userId" required />
                </label>
                <label>
                  Amount (TSh)
                  <input name="amount" type="number" min="1" required />
                </label>
                <label>
                  Expense note
                  <input name="note" minLength={3} required />
                </label>
              </>
            ) : editor.action ? (
              <label>
                {editor.label}
                <input
                  name="value"
                  type={editor.type}
                  defaultValue={editor.value}
                  min={editor.type === "number" ? 0 : undefined}
                  required
                />
              </label>
            ) : (
              <>
                {[
                  ["name", sw ? "Jina (EN)" : "Name (English)", "text"],
                  ["sw", sw ? "Jina (SW)" : "Name (Kiswahili)", "text"],
                  ["price", sw ? "Bei (TSh)" : "Price (TSh)", "number"],
                  ["stock", sw ? "Idadi" : "Stock quantity", "number"],
                  ["category", sw ? "Aina" : "Category / section", "text"],
                  ["unit", sw ? "Kipimo" : "Unit", "text"],
                  ["sku", "SKU", "text"],
                ].map(([name, label, type]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type={type}
                      defaultValue={editor[name]}
                      min={type === "number" ? 0 : undefined}
                      required={name !== "sku"}
                    />
                  </label>
                ))}
                {editor.id && (
                  <label>
                    {sw ? "Picha ya bidhaa" : "Product photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await api(
                            "/partner/products/" + editor.id + "/photo",
                            file,
                          );
                          notify(
                            sw ? "Picha imehifadhiwa" : "Product photo saved",
                          );
                          refresh();
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                    />
                  </label>
                )}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="available"
                    defaultChecked={editor.available}
                  />
                  {sw ? "Inapatikana" : "Available"}
                </label>
              </>
            )}
            <button className="primary">{t.save}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
