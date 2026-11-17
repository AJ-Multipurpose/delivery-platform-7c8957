import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";
export const profiles = pgTable("profiles", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text(),
  verified: boolean().default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const roles = pgTable("roles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => profiles.id),
  role: text().notNull(),
});
export const shops = pgTable("shops", {
  id: serial().primaryKey(),
  ownerId: text("owner_id")
    .unique()
    .references(() => profiles.id),
  name: text().notNull(),
  type: text().notNull(),
  address: text().notNull(),
  phone: text(),
  description: text(),
  hours: text(),
  image: text(),
  cuisine: text(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  status: text().default("pending").notNull(),
  commission: integer().default(10).notNull(),
  proposedCommission: integer("proposed_commission"),
});
export const products = pgTable("products", {
  id: serial().primaryKey(),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id),
  name: text().notNull(),
  sw: text().notNull(),
  price: integer().notNull(),
  oldPrice: integer("old_price"),
  unit: text().notNull(),
  category: text().notNull(),
  image: text(),
  sku: text().unique(),
  stock: integer().default(0).notNull(),
  available: boolean().default(true).notNull(),
});
export const drivers = pgTable("drivers", {
  userId: text("user_id")
    .primaryKey()
    .references(() => profiles.id),
  name: text().notNull(),
  phone: text().notNull(),
  dob: text().notNull(),
  address: text().notNull(),
  status: text().default("pending").notNull(),
  backgroundPassed: boolean("background_passed").default(false).notNull(),
  online: boolean().default(false).notNull(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  positionAt: timestamp("position_at", { withTimezone: true }),
});
export const orders = pgTable("orders", {
  id: serial().primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => profiles.id),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id),
  driverId: text("driver_id").references(() => drivers.userId),
  status: text().default("placed").notNull(),
  items: jsonb().notNull(),
  subtotal: integer().notNull(),
  deliveryFee: integer("delivery_fee").default(2000).notNull(),
  commissionRate: integer("commission_rate").notNull(),
  address: text().notNull(),
  notes: text(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  proofId: integer("proof_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
});
export const documents = pgTable("documents", {
  id: serial().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id),
  kind: text().notNull(),
  key: text().notNull().unique(),
  mime: text().notNull(),
  status: text().default("pending").notNull(),
  orderId: integer("order_id").references(() => orders.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const ledger = pgTable("ledger", {
  id: serial().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id),
  amount: integer().notNull(),
  kind: text().notNull(),
  reference: text().unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const withdrawals = pgTable("withdrawals", {
  id: serial().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id),
  amount: integer().notNull(),
  status: text().default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});
export const ratings = pgTable("ratings", {
  orderId: integer("order_id")
    .primaryKey()
    .references(() => orders.id),
  userId: text("user_id").notNull(),
  stars: integer().notNull(),
  comment: text(),
});
export const disputes = pgTable("disputes", {
  id: serial().primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  userId: text("user_id").notNull(),
  message: text().notNull(),
  status: text().default("open").notNull(),
  resolution: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
});
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: serial().primaryKey(),
    recipient: text().notNull(),
    event: text().notNull(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    status: text().default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("email_event_order").on(t.event, t.orderId)],
);
