import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  ShoppingBasket,
  House,
  UtensilsCrossed,
  Carrot,
  Package,
  Headphones,
  MapPin,
  ChevronDown,
  Search,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  X,
  Check,
  Clock,
  Leaf,
  ShieldCheck,
  Truck,
  Star,
  SlidersHorizontal,
  Heart,
  Menu,
  Download,
  User,
  LogOut,
  ChevronRight,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import {
  products as initialProducts,
  shops as initialShops,
  menu as initialMenu,
  categories,
  image,
  money,
} from "../shared/catalog.mjs";
import { strings, recordLabel, locationErrorLabel } from "./i18n";
import { Dashboard } from "./Dashboard";
import { LiveMap } from "./LiveMap";
import { useLiveEvents } from "./useLiveEvents";
export type Surface = "customer" | "driver" | "partner" | "admin";
export async function api(path: string, body?: any) {
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body instanceof File
        ? { "Content-Type": body.type }
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof File
          ? body
          : JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "Please try again");
  return j;
}
export function Logo({ suffix = "" }: { suffix?: string }) {
  return (
    <a className="brand" href="/" aria-label="Daily Basis Delivery home">
      <span className="brand-icon">
        <ShoppingBag size={27} strokeWidth={2} />
        <span className="brand-dot" />
      </span>
      <span>
        <b>
          dbd<span className="brand-period">.</span>
        </b>
        <small>{suffix || "DAILY BASIS DELIVERY"}</small>
      </span>
    </a>
  );
}
export function App({
  surface = "customer",
  initialPath = "/",
  initialCatalog,
}: {
  surface?: Surface;
  initialPath?: string;
  initialCatalog?: any;
}) {
  const [lang, setLang] = useState<"en" | "sw">("en"),
    [path, setPath] = useState(initialPath),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("recommended"),
    [page, setPage] = useState(0);
  const [products, setProducts] = useState<any[]>(
      initialCatalog?.products || [...initialProducts, ...initialMenu],
    ),
    [shops, setShops] = useState<any[]>(initialCatalog?.shops || initialShops),
    [groceryShopId, setGroceryShopId] = useState(1),
    [catalogError, setCatalogError] = useState(""),
    [user, setUser] = useState<any>(null),
    [me, setMe] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]),
    [cartOpen, setCartOpen] = useState(false),
    [checkout, setCheckout] = useState(false),
    [auth, setAuth] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [location, setLocation] = useState("Mikocheni, Dar es Salaam"),
    [address, setAddress] = useState(""),
    [notes, setNotes] = useState(""),
    [coords, setCoords] = useState<any>(null),
    [installed, setInstalled] = useState(false),
    [installPrompt, setInstallPrompt] = useState<any>(null),
    [navOpen, setNavOpen] = useState(false),
    [replaceItem, setReplaceItem] = useState<any>(null),
    [allOrders, setAllOrders] = useState<any[]>([]),
    [orderPage, setOrderPage] = useState(0);
  const t = strings[surface === "admin" ? "en" : lang];
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 3500);
  };
  function go(p: string) {
    setPath(p);
    history.pushState({}, "", p);
    setQuery("");
    setCategory("all");
    setPage(0);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  useEffect(() => {
    setLang(
      surface !== "admin" &&
        (localStorage.getItem("dbd-language") ||
          navigator.language.split("-")[0]) === "sw"
        ? "sw"
        : "en",
    );
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        !!(window as any).Capacitor?.isNativePlatform?.(),
    );
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    const pop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", pop);
    api("/catalog")
      .then((d) => {
        setProducts(d.products);
        setShops(d.shops);
        if (
          !d.shops.some(
            (s: any) => s.id === groceryShopId && s.type === "grocery",
          )
        )
          setGroceryShopId(
            d.shops.find((s: any) => s.type === "grocery")?.id || 1,
          );
      })
      .catch(() =>
        setCatalogError(
          "Live availability is temporarily unavailable. Please refresh before ordering.",
        ),
      );
    import("@netlify/identity").then(async (identity) => {
      try {
        const cb = await identity.handleAuthCallback();
        const u = await identity.getUser();
        setUser(u);
        if (u)
          api("/me")
            .then(setMe)
            .catch(() => {});
        if (cb?.type === "recovery") setAuth("reset");
      } catch (e: any) {
        setError(e.message);
      }
      identity.onAuthChange((_event, u) => {
        setUser(u);
        if (u)
          api("/me")
            .then(setMe)
            .catch(() => {});
        else setMe(null);
      });
    });
    if (
      "serviceWorker" in navigator &&
      ["customer", "driver"].includes(surface)
    )
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Fresh groceries & food delivery in Dar es Salaam",
      "/grocery": "Shop fresh groceries",
      "/restaurants": "Restaurants near you",
      "/orders": "Your orders",
      "/help": "Help & support",
      "/privacy": "Privacy policy",
      "/terms": "Terms of service",
    };
    const product = path.startsWith("/products/")
      ? products.find((p) => p.id === Number(path.split("/")[2]))
      : null;
    const shop = path.startsWith("/restaurants/")
      ? shops.find((s) => s.id === Number(path.split("/")[2]))
      : null;
    if (product) titles[path] = product.name + " · " + product.unit;
    if (shop) titles[path] = shop.name + " · " + shop.cuisine;
    if (surface !== "customer") {
      document.title =
        (surface === "driver"
          ? "DBD Driver"
          : surface === "partner"
            ? "DBD Partner Portal"
            : "DBD Admin") + " | Dar es Salaam";
      return;
    }
    document.title =
      (titles[path] || "Your neighbourhood delivery") +
      " | Daily Basis Delivery";
  }, [path]);
  useEffect(() => {
    if (path.startsWith("/orders") && user) {
      const load = () =>
        api("/orders?page=" + orderPage)
          .then(setAllOrders)
          .catch((e) => setError(e.message));
      load();
      const timer = setInterval(load, 15000);
      return () => clearInterval(timer);
    }
  }, [path, user, orderPage]);
  useLiveEvents(!!user, () => {
    api("/me")
      .then(setMe)
      .catch(() => {});
    if (path.startsWith("/orders"))
      api("/orders?page=" + orderPage)
        .then(setAllOrders)
        .catch(() => {});
    window.dispatchEvent(new Event("dbd-live-update"));
  });
  const cartShop = shops.find((s) => s.id === cart[0]?.shopId),
    subtotal = cart.reduce((s, p) => s + p.price * p.quantity, 0),
    count = cart.reduce((s, p) => s + p.quantity, 0);
  function add(p: any) {
    if (!p.available || p.stock < 1) {
      notify(t.unavailable);
      return;
    }
    if (cart.length && cart[0].shopId !== p.shopId) {
      setReplaceItem(p);
      return;
    }
    setCart((c) => {
      const found = c.find((x) => x.id === p.id);
      if (found)
        return c.map((x) =>
          x.id === p.id
            ? { ...x, quantity: Math.min(x.quantity + 1, p.stock, 99) }
            : x,
        );
      return [...c, { ...p, quantity: 1 }];
    });
    notify(t.added);
  }
  function quantity(id: number, delta: number) {
    setCart((c) =>
      c
        .map((p) =>
          p.id === id
            ? { ...p, quantity: Math.min(p.quantity + delta, p.stock, 99) }
            : p,
        )
        .filter((p) => p.quantity > 0),
    );
  }
  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const i = await import("@netlify/identity");
      if (auth === "signup") {
        if (f.password !== f.confirm)
          throw Error(
            lang === "sw" ? "Manenosiri hayafanani" : "Passwords do not match",
          );
        await i.signup(String(f.email), String(f.password), {
          full_name: f.name,
          phone: f.phone,
        });
        notify(t.checkEmail);
        setAuth("login");
      } else if (auth === "forgot") {
        const recovery = await fetch(
          "/.netlify/identity/recover?redirect_to=" +
            encodeURIComponent(window.location.origin),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: String(f.email) }),
          },
        );
        if (!recovery.ok)
          throw Error(
            lang === "sw"
              ? "Imeshindikana kutuma kiungo"
              : "Unable to send the reset link",
          );
        notify(
          lang === "sw"
            ? "Angalia barua pepe yako."
            : "Check your email for a reset link.",
        );
        setAuth("login");
      } else if (auth === "reset") {
        await i.updateUser({ password: String(f.password) });
        setAuth("");
        notify("Password updated");
      } else {
        const u = await i.login(String(f.email), String(f.password));
        if (!u.confirmedAt) throw Error(t.checkEmail);
        setUser(u);
        setAuth("");
        api("/me").then(setMe);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setAuth("login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (catalogError) throw Error(catalogError);
      const deliveryCoords =
        coords || (await api("/geocode?q=" + encodeURIComponent(address)));
      const key =
        sessionStorage.getItem("dbd-order-key") || crypto.randomUUID();
      sessionStorage.setItem("dbd-order-key", key);
      await api("/orders", {
        shopId: cart[0].shopId,
        items: cart.map((p) => ({ id: p.id, quantity: p.quantity })),
        address,
        notes,
        ...deliveryCoords,
        key,
      });
      sessionStorage.removeItem("dbd-order-key");
      setCart([]);
      setCartOpen(false);
      setCheckout(false);
      go("/orders");
      notify(
        lang === "sw"
          ? "Oda yako imepokelewa!"
          : "Your order is on its way to the kitchen!",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function locate() {
    if (!navigator.geolocation) {
      setError(strings[lang].locationUnavailable);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        notify(
          lang === "sw"
            ? "Eneo limehifadhiwa"
            : "GPS location saved. Add your street address below.",
        );
      },
      (e) => setError(locationErrorLabel(e.code, lang)),
    );
  }
  const switchLang = () =>
    setLang((l) => {
      const n = l === "en" ? "sw" : "en";
      localStorage.setItem("dbd-language", n);
      return n;
    });
  const productCard = (p: any) => (
    <article className="product-card" key={p.id}>
      <button
        className="product-photo"
        onClick={() => go("/products/" + p.id)}
        aria-label={p.name}
      >
        <img
          src={image(p.image, 480)}
          alt={lang === "sw" ? p.sw : p.name}
          loading="lazy"
        />
        {p.oldPrice > p.price && (
          <span className="discount">
            −{Math.round((1 - p.price / p.oldPrice) * 100)}%
          </span>
        )}
      </button>
      <div className="product-info">
        <span className="product-unit">{p.unit}</span>
        <button
          className="product-name"
          onClick={() => go("/products/" + p.id)}
        >
          {lang === "sw" ? p.sw : p.name}
        </button>
        <div className="price-row">
          <div>
            <strong>{money(p.price)}</strong>
            {p.oldPrice > p.price && <del>{money(p.oldPrice)}</del>}
          </div>
          <button
            className="add-button"
            onClick={() => add(p)}
            aria-label={t.add + " " + p.name}
            disabled={!p.available || p.stock < 1}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  );
  const filtered = products
    .filter(
      (p) =>
        p.shopId === groceryShopId &&
        (category === "all" || p.category === category) &&
        (!query ||
          (p.name + " " + p.sw).toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : a.id - b.id,
    );
  const home = path === "/",
    grocery = home || path === "/grocery",
    restaurants = home || path === "/restaurants";
  const selectedRestaurant = path.startsWith("/restaurants/")
    ? shops.find((s) => s.id === Number(path.split("/")[2]))
    : null;
  return (
    <div className={"app surface-" + surface}>
      {surface === "customer" ? (
        <>
          <aside className={"sidebar " + (navOpen ? "is-open" : "")}>
            <Logo />
            <div className="sidebar-label">
              {lang === "sw" ? "KILA SIKU, KWA URAHISI" : "EVERYDAY, MADE EASY"}
            </div>
            <nav>
              {[
                [House, t.home, "/"],
                [ShoppingBasket, t.grocery, "/grocery"],
                [UtensilsCrossed, t.restaurant, "/restaurants"],
                [Package, t.orders, "/orders"],
              ].map(([Icon, label, url]: any) => (
                <button
                  key={url}
                  onClick={() => go(url)}
                  className={path === url ? "active" : ""}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                  {path === url && <span className="active-dot" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              {!installed && (
                <div className="app-promo">
                  <span className="mini-bag">
                    <ShoppingBag size={25} />
                  </span>
                  <h4>{t.download}</h4>
                  <p>{t.downloadText}</p>
                  <button
                    onClick={async () => {
                      if (installPrompt) {
                        await installPrompt.prompt();
                        if (
                          (await installPrompt.userChoice).outcome ===
                          "accepted"
                        )
                          setInstalled(true);
                      } else
                        notify(
                          lang === "sw"
                            ? "Chagua “Ongeza kwenye skrini ya mwanzo” katika menyu ya kivinjari."
                            : "Choose “Add to Home screen” in your browser menu.",
                        );
                    }}
                  >
                    {t.install}
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <button className="help-link" onClick={() => go("/help")}>
                <Headphones size={19} />
                {t.help}
                <ArrowUpRight />
              </button>
              <div className="sidebar-foot">
                Made for Dar. Made for you.
                <span>© {new Date().getFullYear()} DBD</span>
              </div>
            </div>
          </aside>
          <div className="workspace">
            <header className="topbar">
              <button
                className="icon-button mobile-menu"
                aria-label="Open menu"
                onClick={() => setNavOpen(!navOpen)}
              >
                <Menu />
              </button>
              <button
                className="delivery-location"
                onClick={() => {
                  setSelected({ location: true });
                }}
              >
                <span className="location-icon">
                  <MapPin size={21} />
                </span>
                <span>
                  <small>{t.location}</small>
                  <b>
                    {location}
                    <ChevronDown size={14} />
                  </b>
                </span>
              </button>
              <div className="top-search">
                <Search size={19} />
                <input
                  aria-label={t.search}
                  placeholder={t.search}
                  value={query}
                  onChange={(e) => {
                    if (!grocery) go("/grocery");
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
                <kbd>⌘ K</kbd>
              </div>
              <button className="language" onClick={switchLang}>
                <span className={lang === "sw" ? "current" : ""}>SW</span>
                <i /> <span className={lang === "en" ? "current" : ""}>EN</span>
              </button>
              <button
                className="signin"
                onClick={() => (user ? go("/account") : setAuth("login"))}
              >
                <User size={18} />
                <span>
                  {user ? user.name?.split(" ")[0] || t.account : t.login}
                </span>
              </button>
              <button
                className="header-cart"
                onClick={() => {
                  setCartOpen(true);
                  setCheckout(false);
                }}
              >
                <ShoppingBag size={20} />
                <span>{count}</span>
              </button>
            </header>
            <main className="main-content">
              {home && (
                <>
                  <div className="welcome-row">
                    <span>
                      <span className="live-dot" />
                      {lang === "sw"
                        ? "Maisha ya Dar, rahisi zaidi"
                        : "A little more local. A lot more convenient."}
                    </span>
                    <span>
                      <Truck size={15} />
                      {lang === "sw"
                        ? "Usafirishaji wa TSh 2,000"
                        : "Flat TSh 2,000 delivery"}
                    </span>
                  </div>
                  <div className="hero">
                    <div className="hero-copy">
                      <div className="eyebrow">
                        <span />
                        {t.heroSmall}
                      </div>
                      <h1>
                        {t.hero1}
                        <br />
                        <em>{t.hero2}</em>
                      </h1>
                      <p>{t.heroText}</p>
                      <div className="hero-buttons">
                        <button
                          className="primary"
                          onClick={() => {
                            document
                              .getElementById("grocery")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {t.shopNow}
                          <ArrowRight size={18} />
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            document
                              .getElementById("restaurants")
                              ?.scrollIntoView({ behavior: "smooth" })
                          }
                        >
                          {t.orderFood}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                      <div className="hero-note">
                        <span className="overlapping-avatars">
                          {[
                            "photo-1534528741775-53994a69daeb",
                            "photo-1506794778202-cad84cf45f1d",
                            "photo-1500648767791-00dcc994a43e",
                          ].map((id) => (
                            <img
                              key={id}
                              src={
                                "/.netlify/images?url=" +
                                encodeURIComponent(
                                  "https://images.unsplash.com/" + id,
                                ) +
                                "&w=50&h=50&fit=cover&fm=webp"
                              }
                              alt=""
                            />
                          ))}
                        </span>
                        <span>
                          <b>
                            {lang === "sw"
                              ? "Kutoka mtaani, kwa upendo"
                              : "From your neighbourhood, with love"}
                          </b>
                          <small>
                            <Star size={11} fill="currentColor" />
                            {lang === "sw"
                              ? "Vyakula vizuri. Watu wazuri."
                              : "Good food. Good people. Every day."}
                          </small>
                        </span>
                      </div>
                    </div>
                    <div className="hero-visual">
                      <img
                        className="hero-image"
                        src={image("hero", 1200)}
                        alt="An abundance of fresh vegetables and groceries at a local market"
                      />
                      <div className="hero-image-shade" />
                      <div className="fresh-stamp">
                        <Leaf size={22} />
                        <span>
                          FRESH &<br />
                          LOCAL
                        </span>
                      </div>
                      <div className="floating-delivery">
                        <span>
                          <ShoppingBasket size={26} />
                        </span>
                        <div>
                          <b>
                            {lang === "sw"
                              ? "Sokoni hadi nyumbani"
                              : "Market to doorstep"}
                          </b>
                          <small>
                            {lang === "sw"
                              ? "Tunachagua. Tunakuletea."
                              : "We pick it. We bring it. You enjoy it."}
                          </small>
                        </div>
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="hero-caption">
                        GOOD THINGS GROW CLOSE TO HOME.
                      </span>
                    </div>
                  </div>
                  <div className="trust-strip">
                    <span>
                      <Leaf />
                      {t.freshDaily}
                    </span>
                    <i />
                    <span>
                      <ShoppingBag />
                      {t.local}
                    </span>
                    <i />
                    <span>
                      <ShieldCheck />
                      {t.safe}
                    </span>
                    <div className="trust-city">
                      <MapPin size={15} />
                      Dar es Salaam, Tanzania
                    </div>
                  </div>
                </>
              )}
              {grocery && (
                <section id="grocery" className="grocery-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">
                        <ShoppingBasket size={15} />
                        {t.grocery.toUpperCase()}
                      </span>
                      <h2>{home ? t.fresh : t.grocery}</h2>
                      <p>{t.freshSub}</p>
                    </div>
                    <button
                      className="section-link"
                      onClick={() => go(home ? "/grocery" : "/restaurants")}
                    >
                      {home ? t.all : t.restaurant}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="categories">
                    {categories.map(([id, en, sw]) => (
                      <button
                        key={id}
                        className={
                          category === id ? "category selected" : "category"
                        }
                        onClick={() => {
                          setCategory(id);
                          setPage(0);
                        }}
                      >
                        <span className="category-image">
                          {id === "all" ? (
                            <ShoppingBasket size={30} />
                          ) : (
                            <img src={image(id, 180)} alt="" loading="lazy" />
                          )}
                        </span>
                        <b>{lang === "sw" ? sw : en}</b>
                      </button>
                    ))}
                  </div>
                  {!home && (
                    <label className="shop-selector">
                      {lang === "sw" ? "Duka" : "Your grocery shop"}
                      <select
                        value={groceryShopId}
                        onChange={(e) => {
                          setGroceryShopId(Number(e.target.value));
                          setPage(0);
                        }}
                      >
                        {shops
                          .filter((s) => s.type === "grocery")
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} · {s.address}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="product-heading">
                    <div>
                      <h3>
                        {query
                          ? `${lang === "sw" ? "Matokeo" : "Results"}: “${query}”`
                          : category === "all"
                            ? t.popular
                            : categories.find((c) => c[0] === category)?.[
                                lang === "sw" ? 2 : 1
                              ]}
                      </h3>
                      {home && <span>{t.popularSub}</span>}
                    </div>
                    <label className="sort">
                      <SlidersHorizontal size={15} />
                      <select
                        aria-label="Sort products"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="recommended">{t.sort}</option>
                        <option value="low">
                          {lang === "sw"
                            ? "Bei: chini kwenda juu"
                            : "Price: low to high"}
                        </option>
                        <option value="high">
                          {lang === "sw"
                            ? "Bei: juu kwenda chini"
                            : "Price: high to low"}
                        </option>
                        <option value="name">A – Z</option>
                      </select>
                    </label>
                  </div>
                  {catalogError && !home && (
                    <div className="notice error">
                      {catalogError}
                      <button onClick={() => window.location.reload()}>
                        {t.refresh}
                      </button>
                    </div>
                  )}
                  <div className="product-grid">
                    {filtered
                      .slice(page * 12, page * 12 + (home ? 6 : 12))
                      .map(productCard)}
                  </div>
                  {!filtered.length && (
                    <div className="empty-state">
                      <Search size={30} />
                      <p>{t.noResults}</p>
                    </div>
                  )}
                  {!home && filtered.length > 12 && (
                    <div className="pagination">
                      <button
                        disabled={!page}
                        onClick={() => setPage(page - 1)}
                      >
                        <ArrowLeft size={16} />
                        {t.back}
                      </button>
                      <span>
                        {page + 1} / {Math.ceil(filtered.length / 12)}
                      </span>
                      <button
                        disabled={(page + 1) * 12 >= filtered.length}
                        onClick={() => setPage(page + 1)}
                      >
                        {lang === "sw" ? "Ifuatayo" : "Next"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  {home && (
                    <div className="offer-banner">
                      <div className="offer-illustration">
                        <ShoppingBasket size={62} strokeWidth={1.2} />
                        <Leaf className="offer-leaf" size={35} />
                      </div>
                      <div>
                        <span>THE EVERYDAY GOOD STUFF</span>
                        <h3>{t.offer}</h3>
                        <p>{t.offerText}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSort("low");
                          go("/grocery");
                        }}
                      >
                        {t.offerButton}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              {restaurants && (
                <section id="restaurants" className="restaurant-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">
                        <UtensilsCrossed size={15} />
                        {t.restaurant.toUpperCase()}
                      </span>
                      <h2>{t.food}</h2>
                      <p>{t.foodSub}</p>
                    </div>
                    <button
                      className="section-link"
                      onClick={() => go(home ? "/restaurants" : "/grocery")}
                    >
                      {home ? t.all : t.grocery}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="restaurant-grid">
                    {shops
                      .filter((s) => s.type === "restaurant")
                      .map((s) => (
                        <article className="restaurant-card" key={s.id}>
                          <button
                            className="restaurant-photo"
                            onClick={() => go("/restaurants/" + s.id)}
                          >
                            <img
                              src={image(s.image, 700)}
                              alt={s.name}
                              loading="lazy"
                            />
                            <span>
                              <Clock size={13} />
                              {s.hours}
                            </span>
                            <b>
                              {money(2000)} {t.delivery.toLowerCase()}
                            </b>
                          </button>
                          <div className="restaurant-info">
                            <div>
                              <h3>
                                <button
                                  onClick={() => go("/restaurants/" + s.id)}
                                >
                                  {s.name}
                                </button>
                              </h3>
                              <p>{s.cuisine}</p>
                              <span>
                                <MapPin size={13} />
                                {s.address.split(",")[0]}
                              </span>
                            </div>
                            <button
                              className="round-arrow"
                              onClick={() => go("/restaurants/" + s.id)}
                              aria-label={t.seeMenu + " " + s.name}
                            >
                              <ArrowRight size={18} />
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                </section>
              )}
              {selectedRestaurant && (
                <section>
                  <button
                    className="text-button"
                    onClick={() => go("/restaurants")}
                  >
                    <ArrowLeft size={17} />
                    {t.back}
                  </button>
                  <div className="restaurant-detail">
                    <img
                      src={image(selectedRestaurant.image, 1200)}
                      alt={selectedRestaurant.name}
                    />
                    <div>
                      <span className="section-kicker">
                        {selectedRestaurant.cuisine}
                      </span>
                      <h1>{selectedRestaurant.name}</h1>
                      <p>{selectedRestaurant.description}</p>
                      <p>
                        <MapPin size={16} />
                        {selectedRestaurant.address} ·{" "}
                        {selectedRestaurant.hours}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go("/grocery")}
                      >
                        {t.grocery}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </div>
                  {[
                    ...new Set(
                      products
                        .filter((p) => p.shopId === selectedRestaurant.id)
                        .map((p) => p.category),
                    ),
                  ].map((c) => (
                    <div key={c}>
                      <h2>{c}</h2>
                      <div className="product-grid">
                        {products
                          .filter(
                            (p) =>
                              p.shopId === selectedRestaurant.id &&
                              p.category === c,
                          )
                          .map(productCard)}
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {path.startsWith("/products/") &&
                (() => {
                  const p = products.find(
                    (x) => x.id === Number(path.split("/")[2]),
                  );
                  return p ? (
                    <section className="product-detail-page">
                      <button
                        className="text-button"
                        onClick={() =>
                          go(
                            p.shopId === 1
                              ? "/grocery"
                              : "/restaurants/" + p.shopId,
                          )
                        }
                      >
                        <ArrowLeft size={17} />
                        {t.back}
                      </button>
                      <div className="restaurant-detail">
                        <img
                          src={image(p.image, 1000)}
                          alt={lang === "sw" ? p.sw : p.name}
                        />
                        <div>
                          <span className="section-kicker">{p.category}</span>
                          <h1>{lang === "sw" ? p.sw : p.name}</h1>
                          <p>
                            {p.unit} ·{" "}
                            {shops.find((s) => s.id === p.shopId)?.name}
                          </p>
                          <h2>{money(p.price)}</h2>
                          <p>
                            {lang === "sw"
                              ? "Tumechagua kwa makini na tunakuletea nyumbani."
                              : "Carefully selected, packed by your local shop, and delivered to your door."}
                          </p>
                          <button
                            className="primary"
                            disabled={!p.available || p.stock < 1}
                            onClick={() => add(p)}
                          >
                            <Plus size={17} />
                            {t.add}
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <Empty
                      icon={<ShoppingBag size={35} />}
                      title={t.unavailable}
                      text={t.noResults}
                    />
                  );
                })()}
              {path.startsWith("/orders") && (
                <section>
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">
                        DAILY BASIS DELIVERY
                      </span>
                      <h1>{t.orders}</h1>
                    </div>
                    <Package />
                  </div>
                  {!user ? (
                    <Empty
                      icon={<Package size={40} />}
                      title={
                        lang === "sw"
                          ? "Oda zako, sehemu moja"
                          : "Your orders, all in one place"
                      }
                      text={
                        lang === "sw"
                          ? "Ingia kufuatilia oda na kuona historia yako."
                          : "Sign in to track your delivery and see your order history."
                      }
                      action={t.login}
                      onClick={() => setAuth("login")}
                    />
                  ) : (
                    <>
                      <OrderList
                        orders={allOrders}
                        lang={lang}
                        onAction={async (id, status) => {
                          await api("/orders/" + id + "/status", { status });
                          setAllOrders(await api("/orders?page=" + orderPage));
                        }}
                        onReorder={async (o) => {
                          const live = await api("/catalog");
                          const next = o.items
                            .map((x: any) => {
                              const p = live.products.find(
                                (p: any) =>
                                  p.id === x.id && p.available && p.stock > 0,
                              );
                              return p
                                ? {
                                    ...p,
                                    quantity: Math.min(x.quantity, p.stock),
                                  }
                                : null;
                            })
                            .filter(Boolean);
                          if (!next.length) {
                            notify(t.unavailable);
                            return;
                          }
                          const apply = () => {
                            setCart(next);
                            setAddress(o.address);
                            setNotes(o.notes || "");
                            setCoords(
                              o.lat && o.lng
                                ? { lat: o.lat, lng: o.lng }
                                : null,
                            );
                            setCartOpen(true);
                          };
                          if (cart.length && cart[0].shopId !== o.shop_id)
                            setReplaceItem({ reorder: apply });
                          else apply();
                        }}
                      />
                      <div className="pagination">
                        <button
                          disabled={!orderPage}
                          onClick={() => setOrderPage(orderPage - 1)}
                        >
                          {t.back}
                        </button>
                        <span>{orderPage + 1}</span>
                        <button
                          disabled={allOrders.length < 25}
                          onClick={() => setOrderPage(orderPage + 1)}
                        >
                          {lang === "sw" ? "Ifuatayo" : "Next"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}
              {path === "/account" && (
                <Empty
                  icon={<User size={40} />}
                  title={user?.name || t.account}
                  text={user?.email || ""}
                  action={t.logout}
                  onClick={async () => {
                    await (await import("@netlify/identity")).logout();
                    setUser(null);
                    go("/");
                  }}
                />
              )}
              {path === "/help" && (
                <section className="reading-page">
                  <span className="section-kicker">{t.help}</span>
                  <h1>
                    {lang === "sw"
                      ? "Tupo kukusaidia."
                      : "A little help, right here."}
                  </h1>
                  {(lang === "sw"
                    ? [
                        [
                          "Ninawezaje kuagiza?",
                          "Chagua bidhaa au mgahawa, ongeza kwenye kikapu na weka anwani. Lipa ukipokea.",
                        ],
                        [
                          "Usafirishaji unagharimu kiasi gani?",
                          "Ada ni TSh 2,000 kwa oda, inalipwa kwa dereva.",
                        ],
                        [
                          "Nina tatizo na oda yangu.",
                          "Fungua Oda zangu na uchague “Ripoti tatizo” kwenye oda inayoendelea.",
                        ],
                        [
                          "Ninawezaje kufuatilia dereva?",
                          "Eneo la dereva linaonekana baada ya kuchukua oda.",
                        ],
                      ]
                    : [
                        [
                          "How do I place an order?",
                          "Pick your groceries or a restaurant, add items to your basket, and enter your delivery address. Pay cash when your order arrives.",
                        ],
                        [
                          "How much is delivery?",
                          "Every order has a TSh 2,000 delivery fee, earned by your driver.",
                        ],
                        [
                          "Something is wrong with my order.",
                          "Open My orders and choose “Report a problem” on the active order. Our team can review your report.",
                        ],
                        [
                          "How do I track my driver?",
                          "Your driver’s shared location appears in your order after pickup. Location availability depends on their device connection.",
                        ],
                      ]
                  ).map(([q, a]) => (
                    <details key={q}>
                      <summary>
                        {q}
                        <Plus size={18} />
                      </summary>
                      <p>{a}</p>
                    </details>
                  ))}
                </section>
              )}
              {["/terms", "/privacy"].includes(path) && (
                <section className="reading-page">
                  <span className="section-kicker">DAILY BASIS DELIVERY</span>
                  <h1>{path === "/terms" ? t.terms : t.privacy}</h1>
                  <p>{t.legalUpdated}</p>
                  {(path === "/terms"
                    ? [
                        [t.legalOrdering, t.legalOrderingText],
                        [t.legalAvailability, t.legalAvailabilityText],
                        [t.legalDelivery, t.legalDeliveryText],
                      ]
                    : [
                        [t.legalInformation, t.legalInformationText],
                        [t.legalDocuments, t.legalDocumentsText],
                        [t.legalChoices, t.legalChoicesText],
                      ]
                  ).map(([heading, body]) => (
                    <React.Fragment key={heading}>
                      <h3>{heading}</h3>
                      <p>{body}</p>
                    </React.Fragment>
                  ))}
                </section>
              )}
              <footer className="footer">
                <div>
                  <Logo />
                  <span>{t.footer}</span>
                </div>
                <div>
                  <span>
                    © {new Date().getFullYear()} Daily Basis Delivery.
                  </span>
                  <button onClick={() => go("/privacy")}>{t.privacy}</button>
                  <button onClick={() => go("/terms")}>{t.terms}</button>
                  <span className="footer-city">
                    <MapPin size={13} />
                    Made in Dar
                  </span>
                </div>
              </footer>
            </main>
          </div>
          {count > 0 && (
            <button
              className="sticky-cart"
              onClick={() => {
                setCartOpen(true);
                setCheckout(false);
              }}
            >
              <ShoppingBag size={20} />
              <span>
                {count} {lang === "sw" ? "bidhaa" : "items"} · {t.cart}
              </span>
              <b>{money(subtotal)}</b>
              <ArrowRight size={17} />
            </button>
          )}
        </>
      ) : (
        <Dashboard
          surface={surface}
          lang={lang}
          t={t}
          user={user}
          me={me}
          setMe={setMe}
          onLogin={() => setAuth("login")}
          notify={notify}
          switchLang={switchLang}
        />
      )}
      {auth && (
        <Modal
          lang={surface === "admin" ? "en" : lang}
          onClose={() => {
            setAuth("");
            setError("");
          }}
        >
          <div className="auth-heading">
            <Logo />
            <h2>
              {auth === "signup"
                ? t.signup
                : auth === "forgot"
                  ? t.forgot
                  : auth === "reset"
                    ? t.reset
                    : lang === "sw"
                      ? "Karibu tena."
                      : "Welcome back."}
            </h2>
            <p>
              {lang === "sw"
                ? "Mahitaji yako ya kila siku yanaanza hapa."
                : "Your everyday essentials start here."}
            </p>
          </div>
          {auth !== "resend" && (
            <form className="form" onSubmit={handleAuth}>
              {auth === "signup" && (
                <>
                  <label>
                    {t.name}
                    <input name="name" autoComplete="name" required />
                  </label>
                  <label>
                    {t.phone}{" "}
                    <small>({lang === "sw" ? "si lazima" : "optional"})</small>
                    <input name="phone" autoComplete="tel" type="tel" />
                  </label>
                </>
              )}
              {auth !== "reset" && auth !== "resend" && (
                <label>
                  {t.email}
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                  />
                </label>
              )}
              {auth !== "forgot" && auth !== "resend" && (
                <label>
                  {t.password}
                  <input
                    type="password"
                    name="password"
                    autoComplete={
                      auth === "login" ? "current-password" : "new-password"
                    }
                    minLength={8}
                    required
                  />
                  {auth === "login" && (
                    <button
                      type="button"
                      className="forgot"
                      onClick={() => {
                        setAuth("forgot");
                        setError("");
                      }}
                    >
                      {t.forgot}
                    </button>
                  )}
                </label>
              )}
              {auth === "signup" && (
                <label>
                  {t.confirm}
                  <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              )}
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary full" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={19} />
                ) : auth === "signup" ? (
                  t.signup
                ) : auth === "forgot" ? (
                  t.sendReset
                ) : auth === "reset" ? (
                  t.reset
                ) : (
                  t.login
                )}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {["signup", "login"].includes(auth) && (
            <>
              <div className="or">
                <span />
                {t.or}
                <span />
              </div>
              <button
                className="google-button"
                onClick={async () => {
                  try {
                    await (
                      await import("@netlify/identity")
                    ).oauthLogin("google");
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                <b>G</b>
                {t.google}
              </button>
              <p className="auth-switch">
                {auth === "signup"
                  ? lang === "sw"
                    ? "Una akaunti?"
                    : "Already have an account?"
                  : lang === "sw"
                    ? "Mgeni hapa?"
                    : "New around here?"}{" "}
                <button
                  onClick={() => {
                    setAuth(auth === "signup" ? "login" : "signup");
                    setError("");
                  }}
                >
                  {auth === "signup" ? t.login : t.signup}
                </button>
              </p>
              {auth === "login" && (
                <button
                  className="text-button full"
                  onClick={() => setAuth("resend")}
                >
                  {t.resend}
                </button>
              )}
            </>
          )}
          {auth === "resend" && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const email = new FormData(e.currentTarget).get("email");
                try {
                  const r = await fetch("/.netlify/identity/resend", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "signup", email }),
                  });
                  if (!r.ok) throw Error("Unable to resend confirmation");
                  notify(t.checkEmail);
                  setAuth("login");
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t.email}
                <input name="email" type="email" required />
              </label>
              <button className="primary" disabled={busy}>
                {t.resend}
              </button>
            </form>
          )}
        </Modal>
      )}
      {cartOpen && (
        <div className="drawer-overlay" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-heading">
              <div>
                <span className="section-kicker">
                  {cartShop?.name || "DAILY BASIS DELIVERY"}
                </span>
                <h2>
                  {checkout ? t.checkout : t.cart} <small>({count})</small>
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                <X />
              </button>
            </div>
            {!cart.length ? (
              <Empty
                icon={<ShoppingBasket size={48} />}
                title={t.empty}
                text={t.emptyText}
                action={t.continue}
                onClick={() => setCartOpen(false)}
              />
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((p) => (
                    <div className="cart-item" key={p.id}>
                      <img src={image(p.image, 150)} alt="" />
                      <div>
                        <b>{lang === "sw" ? p.sw : p.name}</b>
                        <small>{p.unit}</small>
                        <strong>{money(p.price * p.quantity)}</strong>
                      </div>
                      <div className="quantity">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => quantity(p.id, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{p.quantity}</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() => quantity(p.id, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {checkout && (
                    <form
                      id="checkout-form"
                      className="form checkout-form"
                      onSubmit={placeOrder}
                    >
                      <h3>{t.addressLabel}</h3>
                      <label>
                        {t.addressLabel}
                        <textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={
                            lang === "sw"
                              ? "Barabara, nyumba, eneo, Dar es Salaam"
                              : "Street, building, neighbourhood, Dar es Salaam"
                          }
                          minLength={8}
                          required
                        />
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        onClick={locate}
                      >
                        <MapPin size={15} />
                        {coords
                          ? lang === "sw"
                            ? "Eneo limehifadhiwa"
                            : "GPS location saved"
                          : lang === "sw"
                            ? "Tumia eneo langu"
                            : "Use my current location"}
                      </button>
                      <label>
                        {t.notes}
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={
                            lang === "sw"
                              ? "Alama ya karibu au maelekezo"
                              : "A landmark or instructions for your driver"
                          }
                        />
                      </label>
                      <div className="payment-choice">
                        <span>
                          <CheckCircle2 size={21} />
                          {t.cash}
                        </span>
                        <small>
                          {lang === "sw"
                            ? "Lipa dereva ukipokea oda yako."
                            : "Pay your driver when your order arrives."}
                        </small>
                      </div>
                      {error && <div className="notice error">{error}</div>}
                    </form>
                  )}
                </div>
                <div className="cart-totals">
                  <div>
                    <span>{t.subtotal}</span>
                    <b>{money(subtotal)}</b>
                  </div>
                  <div>
                    <span>{t.fee}</span>
                    <b>{money(2000)}</b>
                  </div>
                  <div className="grand-total">
                    <strong>{t.total}</strong>
                    <strong>{money(subtotal + 2000)}</strong>
                  </div>
                  {checkout ? (
                    <button
                      form="checkout-form"
                      className="primary full"
                      disabled={busy}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        t.place
                      )}
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button
                      className="primary full"
                      onClick={() => {
                        if (!user) setAuth("login");
                        else setCheckout(true);
                      }}
                    >
                      {t.checkout}
                      <ArrowRight size={18} />
                    </button>
                  )}
                  <small>
                    <ShieldCheck size={13} />
                    {t.safe} · TSh
                  </small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
      {selected && (
        <Modal lang={lang} onClose={() => setSelected(null)}>
          {selected.location ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                setSelected(null);
              }}
            >
              <MapPin size={30} />
              <h2>{t.location}</h2>
              <label>
                {t.addressLabel}
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </label>
              <button className="primary">{t.save}</button>
            </form>
          ) : (
            <>
              <img
                className="detail-photo"
                src={image(selected.image, 800)}
                alt={selected.name}
              />
              <span className="section-kicker">{selected.category}</span>
              <h2>{lang === "sw" ? selected.sw : selected.name}</h2>
              <p className="muted">
                {selected.unit} ·{" "}
                {shops.find((s) => s.id === selected.shopId)?.name}
              </p>
              <h3>{money(selected.price)}</h3>
              <p>
                {lang === "sw"
                  ? "Tumechagua kwa uangalifu kwa mahitaji yako ya kila siku."
                  : "Carefully selected for your everyday. Packed by your local shop and delivered to your door."}
              </p>
              <button
                className="primary full"
                onClick={() => {
                  add(selected);
                  setSelected(null);
                }}
                disabled={!selected.available || selected.stock < 1}
              >
                <Plus size={19} />
                {t.add}
              </button>
            </>
          )}
        </Modal>
      )}
      {replaceItem && (
        <Modal lang={lang} onClose={() => setReplaceItem(null)}>
          <ShoppingBasket size={35} />
          <h2>
            {lang === "sw" ? "Anza kikapu kipya?" : "Start a fresh basket?"}
          </h2>
          <p>
            {lang === "sw"
              ? "Unaweza kuagiza kutoka duka moja kwa wakati. Bidhaa hizi zitachukua nafasi ya kikapu chako."
              : "Your basket has items from another shop. Each order comes from one shop. Adding these items replaces your current basket."}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setReplaceItem(null)}>
              {t.cancel}
            </button>
            <button
              className="primary"
              onClick={() => {
                if (replaceItem.reorder) replaceItem.reorder();
                else setCart([{ ...replaceItem, quantity: 1 }]);
                setReplaceItem(null);
              }}
            >
              {lang === "sw" ? "Badilisha kikapu" : "Replace basket"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
}
function ArrowUpRight() {
  return <ArrowRight size={14} className="slant" />;
}
export function Modal({
  children,
  onClose,
  lang = "en",
}: {
  lang?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label={lang === "sw" ? strings.sw.close : strings.en.close}
        >
          <X size={21} />
        </button>
        {children}
      </div>
    </div>
  );
}
export function Empty({ icon, title, text, action, onClick }: any) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={onClick}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function OrderList({
  orders,
  lang,
  onAction,
  onReorder,
  surface = "customer",
}: any) {
  const [expanded, setExpanded] = useState<number | null>(null),
    [problem, setProblem] = useState(""),
    [stars, setStars] = useState(5),
    [comment, setComment] = useState(""),
    [message, setMessage] = useState(""),
    [proof, setProof] = useState<File | null>(null);
  const sw = lang === "sw";
  const t = sw ? strings.sw : strings.en;
  const statusName = (s: string) => recordLabel(s, lang);
  async function act(fn: () => Promise<any>) {
    setMessage("");
    try {
      await fn();
      setMessage(sw ? "Imehifadhiwa" : "Saved");
    } catch (e: any) {
      setMessage(e.message);
    }
  }
  return !orders.length ? (
    <Empty
      icon={<Package size={40} />}
      title={sw ? "Hakuna oda bado" : "No orders yet"}
      text={
        sw
          ? "Oda zako zitaonekana hapa."
          : "Your orders appear here as soon as they are placed."
      }
    />
  ) : (
    <div className="orders-list">
      {orders.map((o: any) => (
        <article className="order-card" key={o.id}>
          <button
            className="order-summary"
            onClick={() => setExpanded(expanded === o.id ? null : o.id)}
          >
            <span className="order-icon">
              <ShoppingBag size={23} />
            </span>
            <div>
              <b>
                DBD-{String(o.id).padStart(5, "0")} · {o.shop_name}
              </b>
              <small>
                {new Date(o.created_at).toLocaleString(sw ? "sw-TZ" : "en-TZ", {
                  timeZone: "Africa/Dar_es_Salaam",
                })}
              </small>
            </div>
            <span className={"status status-" + o.status}>
              {statusName(o.status)}
            </span>
            <strong>{money(o.subtotal + o.delivery_fee)}</strong>
            <ChevronDown size={17} />
          </button>
          {expanded === o.id && (
            <div className="order-expanded">
              <div className="status-steps">
                {["placed", "accepted", "ready", "picked_up", "delivered"].map(
                  (s, i) => {
                    const date =
                      o[
                        (
                          {
                            placed: "created_at",
                            accepted: "accepted_at",
                            ready: "ready_at",
                            picked_up: "picked_up_at",
                            delivered: "delivered_at",
                          } as any
                        )[s]
                      ];
                    return (
                      <div className={date ? "done" : ""} key={s}>
                        <span>{date ? <Check size={15} /> : i + 1}</span>
                        <b>{statusName(s)}</b>
                        <small>
                          {date
                            ? new Date(date).toLocaleTimeString(
                                sw ? "sw-TZ" : "en-TZ",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "Africa/Dar_es_Salaam",
                                },
                              )
                            : "—"}
                        </small>
                      </div>
                    );
                  },
                )}
              </div>
              {o.items.map((p: any) => (
                <div className="order-line" key={p.id}>
                  <span>
                    {p.quantity} × {sw ? p.sw : p.name}
                  </span>
                  <b>{money(p.price * p.quantity)}</b>
                </div>
              ))}
              <div className="address-panel">
                <p>
                  <MapPin size={16} />
                  <b>{sw ? "Kuchukua" : "Pickup"}:</b> {o.pickup_address}
                </p>
                <p>
                  <MapPin size={16} />
                  <b>{sw ? "Kufikisha" : "Drop-off"}:</b> {o.address}
                </p>
                {o.notes && <p>{o.notes}</p>}
                {surface !== "customer" && (
                  <div className="modal-actions">
                    <a
                      className="text-button"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        "https://www.google.com/maps/search/?api=1&query=" +
                        encodeURIComponent(o.pickup_address)
                      }
                    >
                      {t.pickupMap} <ArrowRight size={14} />
                    </a>
                    <a
                      className="text-button"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        "https://www.google.com/maps/search/?api=1&query=" +
                        encodeURIComponent(o.address)
                      }
                    >
                      {t.deliveryMap} <ArrowRight size={14} />
                    </a>
                  </div>
                )}
              </div>
              {o.status === "picked_up" && (
                <div className="tracking">
                  <Truck size={24} />
                  <div>
                    <b>
                      {o.driver_name || (sw ? "Dereva wako" : "Your driver")}
                    </b>
                    {o.driver_lat ? (
                      <>
                        {o.arrival && (
                          <p>
                            <b>
                              {o.arrival.km} km · ~{o.arrival.minutes}{" "}
                              {sw ? "dakika" : "min"}
                            </b>
                          </p>
                        )}
                        <LiveMap
                          lang={lang}
                          label={sw ? "Ramani ya dereva" : "Live driver map"}
                          pins={[
                            {
                              id: "driver",
                              name: o.driver_name || t.driverLabel,
                              lat: o.driver_lat,
                              lng: o.driver_lng,
                              stale:
                                !!o.position_at &&
                                Date.now() - new Date(o.position_at).getTime() >
                                  120000,
                            },
                            ...(o.lat != null
                              ? [
                                  {
                                    id: "destination",
                                    name: sw
                                      ? "Anwani yako"
                                      : "Your destination",
                                    lat: o.lat,
                                    lng: o.lng,
                                    kind: "destination" as const,
                                  },
                                ]
                              : []),
                          ]}
                        />
                        <p>
                          {o.position_at &&
                          Date.now() - new Date(o.position_at).getTime() >
                            120000
                            ? sw
                              ? "Eneo halijasasishwa kwa zaidi ya dakika 2"
                              : "Position stale — last update over 2 minutes ago"
                            : sw
                              ? "Eneo la dereva limesasishwa"
                              : "Driver location updated"}{" "}
                          · {new Date(o.position_at).toLocaleTimeString()}
                        </p>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.openstreetmap.org/?mlat=${o.driver_lat}&mlon=${o.driver_lng}#map=15/${o.driver_lat}/${o.driver_lng}`}
                        >
                          {sw ? "Ona kwenye ramani" : "View driver on map"}{" "}
                          <ArrowRight size={14} />
                        </a>
                      </>
                    ) : (
                      <p>
                        {sw
                          ? "Inasubiri eneo la dereva"
                          : "Waiting for driver GPS position"}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="modal-actions">
                {surface === "customer" && (
                  <>
                    {o.status === "delivered" ? (
                      <button
                        className="primary"
                        onClick={() => act(() => onReorder(o))}
                      >
                        {sw ? "Agiza tena" : "Order again"}
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      !["cancelled", "delivered"].includes(o.status) && (
                        <button
                          className="secondary"
                          onClick={() => setProblem(problem ? "" : "open")}
                        >
                          {sw ? "Ripoti tatizo" : "Report a problem"}
                        </button>
                      )
                    )}
                    {o.status === "placed" && (
                      <button
                        className="secondary"
                        onClick={() => act(() => onAction(o.id, "cancelled"))}
                      >
                        {sw ? "Ghairi oda" : "Cancel order"}
                      </button>
                    )}
                  </>
                )}
                {surface === "partner" && (
                  <>
                    {o.status === "placed" && (
                      <>
                        <button
                          className="primary"
                          onClick={() => act(() => onAction(o.id, "accepted"))}
                        >
                          {sw ? "Kubali" : "Accept"}
                        </button>
                        <button
                          className="secondary"
                          onClick={() => act(() => onAction(o.id, "cancelled"))}
                        >
                          {sw ? "Kataa" : "Reject"}
                        </button>
                      </>
                    )}
                    {o.status === "accepted" && (
                      <button
                        className="primary"
                        onClick={() => act(() => onAction(o.id, "ready"))}
                      >
                        {sw ? "Tayari kuchukuliwa" : "Ready for pickup"}
                      </button>
                    )}
                  </>
                )}
                {surface === "driver" && (
                  <>
                    {!o.driver_id ? (
                      <button
                        className="primary"
                        onClick={() => act(() => onAction(o.id, "assign"))}
                      >
                        {sw ? "Chukua kazi" : "Accept delivery"}
                      </button>
                    ) : o.status === "ready" ? (
                      <button
                        className="primary"
                        onClick={() => act(() => onAction(o.id, "picked_up"))}
                      >
                        {sw ? "Nimechukua" : "Confirm pickup"}
                      </button>
                    ) : o.status === "picked_up" ? (
                      <div className="form">
                        <label>
                          {sw
                            ? "Picha ya uthibitisho"
                            : "Proof of delivery photo"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            onChange={(e) =>
                              setProof(e.target.files?.[0] || null)
                            }
                            required
                          />
                        </label>
                        <button
                          disabled={!proof}
                          className="primary"
                          onClick={() =>
                            act(async () => {
                              const d = await api(
                                "/uploads?kind=delivery_proof&orderId=" + o.id,
                                proof,
                              );
                              await onAction(o.id, "delivered", d.id);
                              setProof(null);
                            })
                          }
                        >
                          {sw ? "Nimefikisha" : "Confirm delivered"}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
                {surface === "admin" && (
                  <>
                    {o.status === "placed" && (
                      <button
                        className="primary"
                        onClick={() => act(() => onAction(o.id, "accepted"))}
                      >
                        Accept
                      </button>
                    )}
                    {o.status === "picked_up" && (
                      <div className="form">
                        {o.delivery_proofs?.length ? (
                          <>
                            <label>
                              Driver proof of delivery
                              <select
                                id={"proof-" + o.id}
                                defaultValue={o.delivery_proofs[0]}
                              >
                                {o.delivery_proofs.map((id: number) => (
                                  <option key={id} value={id}>
                                    Photo #{id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="text-button"
                              onClick={() => {
                                const id = (
                                  document.getElementById(
                                    "proof-" + o.id,
                                  ) as HTMLSelectElement
                                ).value;
                                window.open(
                                  "/api/documents/" + encodeURIComponent(id),
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                            >
                              Review selected photo
                            </button>
                            <button
                              className="primary"
                              onClick={() =>
                                act(() => {
                                  const id = Number(
                                    (
                                      document.getElementById(
                                        "proof-" + o.id,
                                      ) as HTMLSelectElement
                                    ).value,
                                  );
                                  return onAction(o.id, "delivered", id);
                                })
                              }
                            >
                              Confirm delivered
                            </button>
                          </>
                        ) : (
                          <p className="muted">
                            The assigned driver must upload a proof photo before
                            delivery can be confirmed.
                          </p>
                        )}
                      </div>
                    )}
                    {["placed", "accepted", "ready"].includes(o.status) && (
                      <button
                        className="secondary"
                        onClick={() => act(() => onAction(o.id, "cancelled"))}
                      >
                        Cancel
                      </button>
                    )}
                  </>
                )}
              </div>
              {surface === "customer" && o.status === "delivered" && (
                <div className="rating-panel">
                  <b>
                    {sw ? "Uzoefu wako ulikuwaje?" : "How was your delivery?"}
                  </b>
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        aria-label={n + (sw ? " nyota" : " stars")}
                        onClick={() => setStars(n)}
                      >
                        <Star
                          size={24}
                          fill={n <= stars ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder={
                      sw ? "Maoni (si lazima)" : "Leave a comment (optional)"
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    className="secondary"
                    onClick={() =>
                      act(() =>
                        api("/orders/" + o.id + "/rating", { stars, comment }),
                      )
                    }
                  >
                    {sw ? "Hifadhi tathmini" : "Save rating"}
                  </button>
                </div>
              )}
              {problem &&
                surface === "customer" &&
                !["delivered", "cancelled"].includes(o.status) && (
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        await api("/orders/" + o.id + "/dispute", {
                          message: problem,
                        });
                        setProblem("");
                      });
                    }}
                  >
                    <textarea
                      placeholder={
                        sw ? "Eleza tatizo" : "Tell us what happened"
                      }
                      value={problem === "open" ? "" : problem}
                      onChange={(e) => setProblem(e.target.value)}
                      required
                    />
                    <button className="primary">
                      {sw ? "Tuma ripoti" : "Send report"}
                    </button>
                  </form>
                )}
              {message && (
                <p className="notice" role="status">
                  {message}
                </p>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
