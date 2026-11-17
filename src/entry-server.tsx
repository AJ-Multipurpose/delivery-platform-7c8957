import React from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { products, menu, shops } from "../shared/catalog.mjs";
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function render(surface: any, path: string, catalog?: any) {
  const siteName =
    surface === "driver"
      ? "DBD Driver"
      : surface === "partner"
        ? "DBD Partner Portal"
        : surface === "admin"
          ? "DBD Admin"
          : "Daily Basis Delivery";
  const siteDescription =
    surface === "customer"
      ? "Fresh groceries and your favourite restaurant meals, delivered to your door in Dar es Salaam. Shop local and pay cash on delivery with Daily Basis Delivery."
      : surface === "driver"
        ? "Manage your Daily Basis Delivery jobs, share delivery progress, and track your earnings in Dar es Salaam."
        : surface === "partner"
          ? "Manage your shop, products, orders and earnings with the Daily Basis Delivery Partner Portal."
          : "Manage Daily Basis Delivery orders, dispatch, stores, drivers and settlements in Dar es Salaam.";
  const titles: Record<string, string> = {
    "/": "Fresh groceries & food delivery in Dar es Salaam",
    "/grocery": "Shop fresh groceries",
    "/restaurants": "Discover local restaurants",
    "/orders": "Your orders",
    "/help": "Help & support",
    "/privacy": "Privacy policy",
    "/terms": "Terms of service",
    "/account": "Your account",
  };
  const product = path.startsWith("/products/")
    ? (catalog?.products || [...products, ...menu]).find(
        (p) => p.id === Number(path.split("/")[2]),
      )
    : null;
  const shop = path.startsWith("/restaurants/")
    ? (catalog?.shops || shops).find((s) => s.id === Number(path.split("/")[2]))
    : null;
  if (product) titles[path] = product.name + " · " + product.unit;
  if (shop) titles[path] = shop.name + " · " + shop.cuisine;
  const title =
    surface === "customer"
      ? (titles[path] || "Local restaurant menu") + " | " + siteName
      : siteName + " | Dar es Salaam";
  const description =
    path === "/"
      ? siteDescription
      : (titles[path] || "Restaurant menu") + ". " + siteDescription;
  const sub = surface === "customer" ? "app" : surface;
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/><title>' +
    esc(title) +
    '</title><meta name="description" content="' +
    esc(description) +
    '"/><meta property="og:site_name" content="' +
    esc(siteName) +
    '"/><meta property="og:title" content="' +
    esc(title) +
    '"/><meta property="og:description" content="' +
    esc(description) +
    '"/><meta property="og:type" content="website"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="' +
    esc(title) +
    '"/><meta name="twitter:description" content="' +
    esc(description) +
    '"/><meta name="theme-color" content="#eb6b2a"/><link rel="canonical" href="https://' +
    sub +
    ".dailybasicdelivery.com" +
    esc(path) +
    '"/><link rel="icon" type="image/svg+xml" href="/img/icon.svg"/>' +
    (["customer", "driver", "partner"].includes(surface)
      ? '<link rel="manifest" href="/manifest.webmanifest"/>'
      : "") +
    '<link rel="stylesheet" href="/assets/app.css"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;450;500;550;600;650;700;750;800&amp;family=Sora:wght@400;500;550;600;650;700;750;800&amp;display=swap"/></head><body><div id="root">' +
    renderToString(
      <App surface={surface} initialPath={path} initialCatalog={catalog} />,
    ) +
    '</div><script id="dbd-bootstrap" type="application/json">' +
    JSON.stringify({ surface, path, catalog }).replaceAll("<", "\\u003c") +
    '</script><script type="module" src="/assets/app.js"></script></body></html>'
  );
}
