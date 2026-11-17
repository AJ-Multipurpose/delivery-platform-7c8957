export const EMAIL_SENDER =
  "Daily Basis Delivery <notify@dailybasicdelivery.com>";
// The Identity SMTP sender must be configured to this same address for launch.
export const AUTH_EMAIL_SENDER = EMAIL_SENDER;
export function orderEmail(event, order) {
  const titles = {
    order_confirmation: "We received your order",
    delivery_confirmation: "Your order has arrived",
    status_accepted: "Your order is accepted",
    status_ready: "Your order is ready",
    status_picked_up: "Your order is on the way",
    status_cancelled: "Your order was cancelled",
  };
  const subject = titles[event] || "Your DBD order update";
  return {
    subject: `${subject} · DBD-${String(order.id).padStart(5, "0")}`,
    text: `${subject}.\n\nOrder: DBD-${order.id}\nTotal: TSh ${(order.subtotal + order.delivery_fee).toLocaleString("en-TZ")}\nPayment: Cash on delivery\n\nTrack your order: https://app.dailybasicdelivery.com/orders\n\nDaily Basis Delivery · Dar es Salaam`,
  };
}
