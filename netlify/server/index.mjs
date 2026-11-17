import express from "express";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import { createServer } from "node:http";
import { experience, csvCell, eta } from "../../shared/rules.mjs";
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
const database = getDatabase();
const identityOrigin = "https://delivery-platform-7c8957.netlify.app";
app.use("/api", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.get("origin") &&
      new URL(req.get("origin")).host !== req.get("host")
    )
      return res.status(403).json({ error: "Cross-origin request refused" });
    req.surface = experience(req.hostname);
    if (
      (req.path.startsWith("/admin/") && req.surface !== "admin") ||
      (req.path.startsWith("/partner/") && req.surface !== "partner") ||
      (req.path.startsWith("/driver/") && req.surface !== "driver")
    )
      return res.status(404).json({ error: "Not found" });
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("nf_jwt="));
    const token =
      req.get("authorization")?.replace(/^Bearer /, "") || cookie?.slice(7);
    if (token) {
      const r = await fetch(identityOrigin + "/.netlify/identity/user", {
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(7000),
      });
      if (r.ok) {
        const u = await r.json();
        if (u.confirmed_at || u.email_confirmed_at) {
          req.user = {
            id: u.id,
            email: u.email,
            name: u.user_metadata?.full_name || u.email,
            phone: u.user_metadata?.phone || "",
          };
        }
      }
    }
    next();
  } catch {
    res
      .status(503)
      .json({ error: "Unable to verify your session. Please try again." });
  }
});
async function tx(req, fn) {
  const c = await database.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.user_id',$1,true)", [
      req.user?.id || "",
    ]);
    if (req.user)
      await c.query(
        "INSERT INTO profiles(id,name,email,phone,verified) VALUES($1,$2,$3,$4,true) ON CONFLICT(id) DO UPDATE SET email=excluded.email,verified=true",
        [req.user.id, req.user.name, req.user.email, req.user.phone],
      );
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
const route = (method, path, fn) =>
  app[method](path, async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      const allowed =
        /required|unavailable|insufficient|Invalid|denied|already|first|Minimum|photo|Assign|approved|not found|Complete|Choose/.test(
          e.message,
        );
      res.status(allowed ? 400 : 500).json({
        error: allowed
          ? e.message
          : "This action could not be completed. Please try again.",
      });
    }
  });
function signed(req) {
  if (!req.user) throw Error("Verified sign-in required");
}
async function admin(c) {
  if (!(await c.query("SELECT dbd_admin() AS ok")).rows[0].ok)
    throw Error("Admin permission required");
}
async function driver(c, req) {
  const d = (
    await c.query(
      "SELECT * FROM drivers WHERE user_id=$1 AND status='approved'",
      [req.user.id],
    )
  ).rows[0];
  if (!d) throw Error("Approved driver required");
  return d;
}
async function owner(c, req) {
  const s = (
    await c.query(
      "SELECT * FROM shops WHERE owner_id=$1 AND status='approved'",
      [req.user.id],
    )
  ).rows[0];
  if (!s) throw Error("Approved shop required");
  return s;
}
const page = (req) => Math.max(0, Math.floor(Number(req.query.page) || 0)) * 25;
const camel = (p) =>
  Object.fromEntries(
    Object.entries(p).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()),
      v,
    ]),
  );
route("get", "/api/events", async (req, res) => {
  signed(req);
  const isAdmin = await tx(
    req,
    async (c) => (await c.query("SELECT dbd_admin() ok")).rows[0].ok,
  );
  const client = await database.pool.connect();
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    client.removeListener("notification", notification);
    client.removeListener("error", failed);
    client
      .query("UNLISTEN dbd_changes")
      .catch(() => {})
      .finally(() => client.release());
  };
  const failed = () => {
    cleanup();
    res.end();
  };
  const notification = (message) => {
    try {
      const payload = JSON.parse(message.payload || "{}");
      if (
        isAdmin ||
        payload.targets?.includes(req.user.id) ||
        (req.surface === "driver" && payload.jobs_changed === true)
      )
        res.write("event: change\ndata: {}\n\n");
    } catch {}
  };
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);
  res.on("close", cleanup);
  client.on("error", failed);
  client.on("notification", notification);
  try {
    await client.query("LISTEN dbd_changes");
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    res.write("retry: 3000\n\n");
  } catch {
    cleanup();
    res.status(503).end();
  }
});
route("get", "/api/catalog", async (req, res) => {
  const r = await tx(req, async (c) => ({
    products: (
      await c.query(
        "SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.status='approved' ORDER BY p.id",
      )
    ).rows.map(camel),
    shops: (
      await c.query(
        "SELECT id,name,type,address,phone,description,hours,image,cuisine,lat,lng FROM shops WHERE status='approved' ORDER BY id",
      )
    ).rows.map(camel),
  }));
  res.json(r);
});
route("get", "/api/geocode", async (req, res) => {
  signed(req);
  const q = String(req.query.q || "").slice(0, 250);
  if (q.length < 8) throw Error("Complete address required");
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({
    q: q + ", Dar es Salaam, Tanzania",
    format: "json",
    limit: "1",
    countrycodes: "tz",
    viewbox: "39.0,-6.5,39.6,-7.2",
    bounded: "1",
  });
  const r = await fetch(u, {
    headers: {
      "User-Agent": "DailyBasisDelivery/1.0 (dailybasicdelivery.com)",
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok)
    throw Error("Choose your current GPS location to confirm your address");
  const rows = await r.json();
  if (!rows[0])
    throw Error(
      "Choose your current GPS location or enter a more specific address",
    );
  res.json({ lat: Number(rows[0].lat), lng: Number(rows[0].lon) });
});
route("get", "/api/me", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => ({
      user: req.user,
      driver: (
        await c.query("SELECT * FROM drivers WHERE user_id=$1", [req.user.id])
      ).rows[0],
      shop: (
        await c.query("SELECT * FROM shops WHERE owner_id=$1", [req.user.id])
      ).rows[0],
      admin: (await c.query("SELECT dbd_admin() AS ok")).rows[0].ok,
      documents: (
        await c.query("SELECT id,kind,status FROM documents WHERE user_id=$1", [
          req.user.id,
        ])
      ).rows,
    })),
  );
});
route("get", "/api/orders", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => {
      let where,
        args = [req.user.id];
      if (req.surface === "admin") {
        await admin(c);
        where = "true";
        args = [];
      } else if (req.surface === "partner") {
        await owner(c, req);
        where = "s.owner_id=$1";
      } else if (req.surface === "driver") {
        await driver(c, req);
        where =
          "(o.driver_id=$1 OR (o.driver_id IS NULL AND o.status='ready'))";
      } else where = "o.customer_id=$1";
      args.push(page(req));
      const speed = Number(
        (await c.query("SELECT value FROM settings WHERE key='city_speed'"))
          .rows[0]?.value || 22,
      );
      return (
        await c.query(
          `SELECT o.*,${req.surface === "admin" ? "ARRAY(SELECT doc.id FROM documents doc WHERE doc.order_id=o.id AND doc.kind='delivery_proof' AND doc.user_id=o.driver_id ORDER BY doc.id DESC) AS delivery_proofs," : ""}s.name shop_name,s.address pickup_address,s.lat pickup_lat,s.lng pickup_lng,CASE WHEN o.status='picked_up' THEN d.lat END driver_lat,CASE WHEN o.status='picked_up' THEN d.lng END driver_lng,CASE WHEN o.status='picked_up' THEN d.position_at END position_at,d.name driver_name FROM orders o JOIN shops s ON s.id=o.shop_id LEFT JOIN drivers d ON d.user_id=o.driver_id WHERE ${where} ORDER BY o.created_at DESC LIMIT 25 OFFSET $${args.length}`,
          args,
        )
      ).rows.map((o) => ({
        ...o,
        arrival:
          o.status === "picked_up" && o.driver_lat != null && o.lat != null
            ? eta(
                { lat: o.driver_lat, lng: o.driver_lng },
                { lat: o.lat, lng: o.lng },
                speed,
              )
            : null,
      }));
    }),
  );
});
route("post", "/api/orders", async (req, res) => {
  signed(req);
  if (req.surface !== "customer") throw Error("Customer app required");
  const b = req.body;
  res.json(
    await tx(
      req,
      async (c) =>
        (
          await c.query(
            "SELECT * FROM place_order($1,$2::jsonb,$3,$4,$5,$6,$7)",
            [
              b.shopId,
              JSON.stringify(b.items),
              b.address,
              b.notes || "",
              b.lat ?? null,
              b.lng ?? null,
              b.key,
            ],
          )
        ).rows[0],
    ),
  );
});
route("post", "/api/orders/:id/status", async (req, res) => {
  signed(req);
  res.json(
    await tx(
      req,
      async (c) =>
        (
          await c.query("SELECT * FROM update_order_status($1,$2,$3)", [
            req.params.id,
            req.body.status,
            req.body.proofId || null,
          ])
        ).rows[0],
    ),
  );
});
route("post", "/api/orders/:id/accept", async (req, res) => {
  signed(req);
  if (req.surface !== "driver") throw Error("Driver app required");
  res.json(
    await tx(
      req,
      async (c) =>
        (await c.query("SELECT * FROM accept_delivery($1)", [req.params.id]))
          .rows[0],
    ),
  );
});
route("post", "/api/orders/:id/rating", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    const o = (
      await c.query(
        "SELECT id FROM orders WHERE id=$1 AND customer_id=$2 AND status='delivered'",
        [req.params.id, req.user.id],
      )
    ).rows[0];
    if (!o) throw Error("Delivered order required");
    await c.query(
      "INSERT INTO ratings(order_id,user_id,stars,comment) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET stars=excluded.stars,comment=excluded.comment",
      [
        o.id,
        req.user.id,
        req.body.stars,
        String(req.body.comment || "").slice(0, 2000),
      ],
    );
  });
  res.json({ ok: true });
});
route("post", "/api/orders/:id/dispute", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    const o = (
      await c.query(
        "SELECT id FROM orders WHERE id=$1 AND customer_id=$2 AND status NOT IN ('delivered','cancelled')",
        [req.params.id, req.user.id],
      )
    ).rows[0];
    if (!o || !req.body.message?.trim())
      throw Error("Active order and message required");
    await c.query(
      "INSERT INTO disputes(order_id,user_id,message) VALUES($1,$2,$3)",
      [o.id, req.user.id, String(req.body.message).slice(0, 3000)],
    );
  });
  res.json({ ok: true });
});
route("post", "/api/onboarding", async (req, res) => {
  signed(req);
  const b = req.body;
  if (!b.name || !b.phone || !b.address)
    throw Error("Name, phone and address required");
  await tx(req, async (c) => {
    if (req.surface === "driver") {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(b.dob) ||
        new Date(b.dob) >
          new Date(new Date().setFullYear(new Date().getFullYear() - 18))
      )
        throw Error("Valid birth date, age 18 or older required");
      await c.query(
        "INSERT INTO drivers(user_id,name,phone,dob,address) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,phone=excluded.phone,dob=excluded.dob,address=excluded.address",
        [req.user.id, b.name, b.phone, b.dob, b.address],
      );
    } else if (req.surface === "partner") {
      if (!b.businessName) throw Error("Business name required");
      await c.query(
        "INSERT INTO shops(owner_id,name,type,address,phone,description,hours) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,address=excluded.address,phone=excluded.phone,description=excluded.description,hours=excluded.hours",
        [
          req.user.id,
          b.businessName,
          b.type === "grocery" ? "grocery" : "restaurant",
          b.address,
          b.phone,
          b.description || "",
          b.hours || "",
        ],
      );
    } else throw Error("Onboarding unavailable");
  });
  res.json({ ok: true });
});
route("post", "/api/driver/position", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    await driver(c, req);
    const { lat, lng } = req.body;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      throw Error("Invalid position");
    await c.query(
      "UPDATE drivers SET lat=$1,lng=$2,position_at=now() WHERE user_id=$3",
      [lat, lng, req.user.id],
    );
  });
  res.json({ ok: true });
});
route("post", "/api/driver/online", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    await driver(c, req);
    await c.query("UPDATE drivers SET online=$1 WHERE user_id=$2", [
      req.body.online === true,
      req.user.id,
    ]);
  });
  res.json({ ok: true });
});
route("get", "/api/wallet", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => ({
      balance: Number(
        (
          await c.query(
            "SELECT coalesce(sum(amount),0) balance FROM ledger WHERE user_id=$1",
            [req.user.id],
          )
        ).rows[0].balance,
      ),
      ledger: (
        await c.query(
          "SELECT * FROM ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $2",
          [req.user.id, page(req)],
        )
      ).rows,
      withdrawals: (
        await c.query(
          "SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY id DESC LIMIT 25 OFFSET $2",
          [req.user.id, page(req)],
        )
      ).rows,
    })),
  );
});
route("post", "/api/expenses", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    if (req.body.userId && req.body.userId !== req.user.id) await admin(c);
    await c.query("SELECT record_expense($1,$2,$3,$4)", [
      req.body.userId || req.user.id,
      req.body.amount,
      req.body.note,
      req.body.key,
    ]);
  });
  res.json({ ok: true });
});
route("post", "/api/withdrawals", async (req, res) => {
  signed(req);
  res.json(
    await tx(
      req,
      async (c) =>
        (
          await c.query("SELECT * FROM request_withdrawal($1)", [
            req.body.amount,
          ])
        ).rows[0],
    ),
  );
});
route("get", "/api/partner/products", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => {
      const s = await owner(c, req);
      return (
        await c.query("SELECT * FROM products WHERE shop_id=$1 ORDER BY id", [
          s.id,
        ])
      ).rows;
    }),
  );
});
route("post", "/api/partner/products", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    const s = await owner(c, req);
    const b = req.body;
    if (
      !b.name ||
      !Number.isInteger(b.price) ||
      b.price < 0 ||
      !Number.isInteger(b.stock) ||
      b.stock < 0
    )
      throw Error("Valid name, price and stock required");
    if (b.id)
      await c.query(
        "UPDATE products SET name=$1,sw=$2,price=$3,stock=$4,available=$5,category=$6,unit=$7,sku=$8 WHERE id=$9 AND shop_id=$10",
        [
          b.name,
          b.sw || b.name,
          b.price,
          b.stock,
          b.available,
          b.category,
          b.unit,
          b.sku,
          b.id,
          s.id,
        ],
      );
    else
      await c.query(
        "INSERT INTO products(shop_id,name,sw,price,stock,available,category,unit,sku,image) VALUES($1,$2,$3,$4,$5,true,$6,$7,$8,$9)",
        [
          s.id,
          b.name,
          b.sw || b.name,
          b.price,
          b.stock,
          b.category,
          b.unit,
          b.sku || null,
          "vegetables",
        ],
      );
  });
  res.json({ ok: true });
});
app.post(
  "/api/partner/products/:id/photo",
  express.raw({ type: ["image/jpeg", "image/png"], limit: "8mb" }),
  async (req, res) => {
    try {
      signed(req);
      if (
        !Buffer.isBuffer(req.body) ||
        !(
          (req.body[0] === 0xff && req.body[1] === 0xd8) ||
          (req.body[0] === 0x89 && req.body[1] === 0x50)
        )
      )
        throw Error("Valid JPEG or PNG photo required");
      await tx(req, async (c) => {
        const shop = await owner(c, req);
        const p = (
          await c.query("SELECT id FROM products WHERE id=$1 AND shop_id=$2", [
            req.params.id,
            shop.id,
          ])
        ).rows[0];
        if (!p) throw Error("Product not found");
        await getStore("dbd-product-photos").set("product-" + p.id, req.body);
        await c.query("UPDATE products SET image=$1 WHERE id=$2", [
          "/img/products/" + p.id + "?v=" + Date.now(),
          p.id,
        ]);
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  },
);
app.get("/img/products/:id", async (req, res) => {
  try {
    const p =
      await database.sql`SELECT p.id FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.id=${Number(req.params.id)} AND s.status='approved'`;
    if (!p.length) return res.status(404).end();
    const photo = await getStore("dbd-product-photos").get(
      "product-" + Number(req.params.id),
      { type: "arrayBuffer" },
    );
    if (!photo) return res.status(404).end();
    const buffer = Buffer.from(photo);
    res
      .set({
        "Content-Type": buffer[0] === 0x89 ? "image/png" : "image/jpeg",
        "Cache-Control": "public,max-age=3600",
      })
      .send(buffer);
  } catch {
    res.status(404).end();
  }
});
route("get", "/api/partner/earnings", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => {
      const s = await owner(c, req);
      const day = String(req.query.day);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error("Invalid date");
      const filter =
        "shop_id=$1 AND status='delivered' AND (delivered_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date=$2::date";
      const rows = (
        await c.query(
          `SELECT * FROM orders WHERE ${filter} ORDER BY delivered_at DESC,id DESC LIMIT 25 OFFSET $3`,
          [s.id, day, page(req)],
        )
      ).rows;
      const totals = (
        await c.query(
          `SELECT count(*) orders,coalesce(sum(subtotal),0) sales,coalesce(sum(floor(subtotal*commission_rate/100.0)),0) commission,coalesce(sum(delivery_fee),0) driver_fees,coalesce(sum(subtotal-floor(subtotal*commission_rate/100.0)),0) owner_share FROM orders WHERE ${filter}`,
          [s.id, day],
        )
      ).rows[0];
      return { rows, totals };
    }),
  );
});
route("post", "/api/partner/commission", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    const s = await owner(c, req);
    const rate = Number(req.body.rate);
    if (!Number.isInteger(rate) || rate < 0 || rate > 100)
      throw Error("Invalid commission rate");
    await c.query("UPDATE shops SET proposed_commission=$1 WHERE id=$2", [
      rate,
      s.id,
    ]);
  });
  res.json({ ok: true });
});
app.post(
  "/api/uploads",
  express.raw({
    type: ["image/jpeg", "image/png", "application/pdf"],
    limit: "8mb",
  }),
  async (req, res) => {
    try {
      signed(req);
      const kind = String(req.query.kind);
      if (
        ![
          "national_id",
          "licence",
          "registration",
          "insurance",
          "business_licence",
          "tax_certificate",
          "delivery_proof",
        ].includes(kind) ||
        !Buffer.isBuffer(req.body)
      )
        throw Error("Invalid document");
      const doc = await tx(req, async (c) => {
        if (kind === "delivery_proof") {
          const o = (
            await c.query(
              "SELECT id FROM orders WHERE id=$1 AND driver_id=$2 AND status='picked_up'",
              [req.query.orderId, req.user.id],
            )
          ).rows[0];
          if (!o || !req.is("image/*"))
            throw Error("Active delivery photo required");
        }
        const key = req.user.id + "/" + crypto.randomUUID();
        await getStore({
          name: "dbd-private-documents",
          consistency: "strong",
        }).set(key, req.body);
        return (
          await c.query(
            "INSERT INTO documents(user_id,kind,key,mime,order_id) VALUES($1,$2,$3,$4,$5) RETURNING id,kind,status",
            [
              req.user.id,
              kind,
              key,
              req.get("content-type"),
              kind === "delivery_proof" ? req.query.orderId : null,
            ],
          )
        ).rows[0];
      });
      res.json(doc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  },
);
route("get", "/api/documents/:id", async (req, res) => {
  signed(req);
  const doc = await tx(req, async (c) => {
    const d = (
      await c.query("SELECT * FROM documents WHERE id=$1", [req.params.id])
    ).rows[0];
    if (!d) throw Error("Document not found");
    if (d.user_id !== req.user.id) await admin(c);
    return d;
  });
  const value = await getStore({
    name: "dbd-private-documents",
    consistency: "strong",
  }).get(doc.key, { type: "arrayBuffer" });
  res
    .set({
      "Content-Type": doc.mime,
      "Content-Disposition": 'attachment; filename="document-' + doc.id + '"',
      "Cache-Control": "no-store",
    })
    .send(Buffer.from(value));
});
route("get", "/api/admin/drivers/:id/wallet", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => {
      await admin(c);
      const id = req.params.id;
      return {
        balance: Number(
          (
            await c.query(
              "SELECT coalesce(sum(amount),0) balance FROM ledger WHERE user_id=$1",
              [id],
            )
          ).rows[0].balance,
        ),
        ledger: (
          await c.query(
            "SELECT * FROM ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $2",
            [id, page(req)],
          )
        ).rows,
        withdrawals: (
          await c.query(
            "SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY id DESC LIMIT 25 OFFSET $2",
            [id, page(req)],
          )
        ).rows,
      };
    }),
  );
});
route("get", "/api/admin/:tab", async (req, res) => {
  signed(req);
  res.json(
    await tx(req, async (c) => {
      await admin(c);
      const tab = req.params.tab;
      const tables = {
        stores: "shops",
        drivers: "drivers",
        documents: "documents",
        wallets: "withdrawals",
        problems: "disputes",
        stock: "products",
        settings: "settings",
      };
      if (tables[tab])
        return (
          await c.query(
            `SELECT * FROM ${tables[tab]} ORDER BY 1 LIMIT 25 OFFSET $1`,
            [page(req)],
          )
        ).rows;
      if (tab === "analytics")
        return (
          await c.query(
            "SELECT (delivered_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day,shop_id,count(*) orders,sum(subtotal) revenue,sum(floor(subtotal*commission_rate/100.0)) commission FROM orders WHERE status='delivered' GROUP BY 1,2 ORDER BY 1 DESC LIMIT 25 OFFSET $1",
            [page(req)],
          )
        ).rows;
      if (tab === "dispatch")
        return (
          await c.query(
            "SELECT user_id,name,online,lat,lng,position_at FROM drivers WHERE status='approved' ORDER BY name LIMIT 25 OFFSET $1",
            [page(req)],
          )
        ).rows;
      throw Error("Invalid tab");
    }),
  );
});
route("post", "/api/admin/action", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    await admin(c);
    const { action, id, value } = req.body;
    if (action === "driverBackground")
      await c.query(
        "UPDATE drivers SET background_passed=$1 WHERE user_id=$2",
        [value === true, id],
      );
    else if (action === "approveDriver") {
      const docs = (
        await c.query(
          "SELECT count(DISTINCT kind) n FROM documents WHERE user_id=$1 AND kind IN ('national_id','licence','registration','insurance') AND status='approved'",
          [id],
        )
      ).rows[0];
      if (Number(docs.n) !== 4)
        throw Error("All four approved documents required");
      const r = await c.query(
        "UPDATE drivers SET status='approved' WHERE user_id=$1 AND background_passed=true RETURNING user_id",
        [id],
      );
      if (!r.rowCount) throw Error("Passed background check required");
    } else if (action === "storeStatus") {
      if (!["approved", "suspended"].includes(value))
        throw Error("Invalid status");
      if (value === "approved") {
        const s = (
          await c.query("SELECT owner_id FROM shops WHERE id=$1", [id])
        ).rows[0];
        if (s?.owner_id) {
          const d = (
            await c.query(
              "SELECT count(DISTINCT kind) n FROM documents WHERE user_id=$1 AND kind IN ('business_licence','tax_certificate') AND status='approved'",
              [s.owner_id],
            )
          ).rows[0];
          if (Number(d.n) < 2) throw Error("Approved legal documents required");
        }
      }
      await c.query("UPDATE shops SET status=$1 WHERE id=$2", [value, id]);
    } else if (action === "assignOwner") {
      const p = (
        await c.query(
          "SELECT id FROM profiles WHERE lower(email)=lower($1) AND verified=true",
          [value],
        )
      ).rows[0];
      if (!p) throw Error("Verified account required");
      await c.query("UPDATE shops SET owner_id=$1 WHERE id=$2", [p.id, id]);
    } else if (action === "commission")
      await c.query(
        "UPDATE shops SET commission=proposed_commission,proposed_commission=NULL WHERE id=$1 AND proposed_commission IS NOT NULL",
        [id],
      );
    else if (action === "document") {
      if (!["approved", "rejected"].includes(value))
        throw Error("Invalid review");
      await c.query("UPDATE documents SET status=$1 WHERE id=$2", [value, id]);
    } else if (action === "pay")
      await c.query("SELECT pay_withdrawal($1)", [id]);
    else if (action === "resolve")
      await c.query(
        "UPDATE disputes SET status='resolved',resolution=$1 WHERE id=$2",
        [String(value).slice(0, 2000), id],
      );
    else if (action === "stock") {
      if (!Number.isInteger(value) || value < 0) throw Error("Invalid stock");
      await c.query("UPDATE products SET stock=$1 WHERE id=$2", [value, id]);
    } else if (action === "speed") {
      if (!Number.isFinite(value) || value < 1 || value > 100)
        throw Error("Invalid city speed");
      await c.query(
        "UPDATE settings SET value=$1::jsonb WHERE key='city_speed'",
        [JSON.stringify(value)],
      );
    } else if (action === "dispatch") {
      await c.query("SELECT user_id FROM drivers WHERE user_id=$1 FOR UPDATE", [
        value,
      ]);
      if (
        (
          await c.query(
            "SELECT 1 FROM orders WHERE driver_id=$1 AND status IN ('ready','picked_up')",
            [value],
          )
        ).rowCount
      )
        throw Error("Driver already has an active delivery");
      const r = await c.query(
        "UPDATE orders SET driver_id=$1 WHERE id=$2 AND status='ready' AND driver_id IS NULL AND EXISTS(SELECT 1 FROM drivers WHERE user_id=$1 AND status='approved' AND online) RETURNING id",
        [value, id],
      );
      if (!r.rowCount)
        throw Error("Available approved driver and ready order required");
    } else throw Error("Invalid action");
  });
  res.json({ ok: true });
});
route("get", "/api/admin/export/orders.csv", async (req, res) => {
  signed(req);
  await tx(req, async (c) => {
    await admin(c);
    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="dbd-orders.csv"',
    });
    res.write("Order,Date,Shop,Status,Subtotal,Delivery fee,Address\r\n");
    let offset = 0;
    while (true) {
      const { rows } = await c.query(
        "SELECT id,created_at,shop_id,status,subtotal,delivery_fee,address FROM orders ORDER BY id LIMIT 500 OFFSET $1",
        [offset],
      );
      for (const o of rows)
        res.write(Object.values(o).map(csvCell).join(",") + "\r\n");
      if (rows.length < 500) break;
      offset += 500;
    }
    res.end();
  });
});
app.get("/manifest.webmanifest", (req, res) => {
  const surface = experience(req.hostname);
  if (!["customer", "driver"].includes(surface)) return res.status(404).end();
  res.type("application/manifest+json").send({
    name: surface === "driver" ? "DBD Driver" : "DBD App",
    short_name: "DBD",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffdf8",
    theme_color: "#ed6a27",
    icons: [
      {
        src: "/img/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/img/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  });
});
route("get", "/sitemap.xml", async (req, res) => {
  const surface = experience(req.hostname);
  const paths =
    surface === "customer"
      ? ["/", "/grocery", "/restaurants", "/privacy", "/terms"]
      : ["/"];
  if (surface === "customer") {
    const detailPaths = await tx(req, async (c) => {
      const products = await c.query(
        "SELECT p.id FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.status='approved' ORDER BY p.id",
      );
      const restaurants = await c.query(
        "SELECT id FROM shops WHERE status='approved' AND type='restaurant' ORDER BY id",
      );
      return [
        ...products.rows.map((p) => "/products/" + p.id),
        ...restaurants.rows.map((s) => "/restaurants/" + s.id),
      ];
    });
    paths.push(...detailPaths);
  }
  const escapeXml = (value) =>
    value.replace(
      /[<>&"']/g,
      (ch) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[ch],
    );
  const base = "https://" + req.hostname;
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${escapeXml(base + p)}</loc></url>`).join("")}</urlset>`,
    );
});
app.get("/robots.txt", (req, res) =>
  res
    .type("text")
    .send(
      "User-agent: *\nDisallow: /api/\nDisallow: /orders\nDisallow: /account\nSitemap: https://" +
        req.hostname +
        "/sitemap.xml",
    ),
);
app.use(express.static("dist"));
app.get("/{*path}", async (req, res) => {
  try {
    const surface = experience(req.hostname);
    const { render } = await import("../../dist-server/entry-server.js");
    let catalog;
    if (surface === "customer")
      try {
        catalog = await tx(req, async (c) => ({
          products: (
            await c.query(
              "SELECT p.* FROM products p JOIN shops s ON s.id=p.shop_id WHERE s.status='approved' ORDER BY p.id",
            )
          ).rows.map(camel),
          shops: (
            await c.query(
              "SELECT id,name,type,address,phone,description,hours,image,cuisine,lat,lng FROM shops WHERE status='approved' ORDER BY id",
            )
          ).rows.map(camel),
        }));
      } catch {}
    const html = render(surface, req.path, catalog);
    res.type("html").send(html);
  } catch {
    res.status(503).send("DBD is getting ready. Please try again shortly.");
  }
});
export default createServer(app);
