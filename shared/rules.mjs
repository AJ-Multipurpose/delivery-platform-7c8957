export const DELIVERY_FEE = 2000;
export const MIN_WITHDRAWAL = 1000;
export function experience(host) {
  const hostname = host.toLowerCase().split(":")[0];
  return (
    ["driver", "partner", "admin"].find(
      (sub) => hostname === sub + ".dailybasicdelivery.com",
    ) || "customer"
  );
}
export function csvCell(value) {
  const s = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') +
    '"'
  );
}
export function eta(a, b, speed = 22) {
  const rad = (d) => (d * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1.35;
  return {
    km: Math.round(km * 10) / 10,
    minutes: Math.max(1, Math.ceil((km / Math.max(1, speed)) * 60)),
  };
}
export const transitions = {
  placed: ["accepted", "cancelled"],
  accepted: ["ready", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: ["delivered"],
  delivered: [],
  cancelled: [],
};
