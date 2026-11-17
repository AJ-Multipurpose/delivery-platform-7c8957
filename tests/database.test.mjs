// Run against a disposable, migrated Netlify Database branch only. Every fixture is rolled back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDatabase } from "@netlify/database";
const enabled = process.env.DBD_DATABASE_TESTS === "1";
async function scenario(fn) {
  const c = await getDatabase().pool.connect();
  try {
    await c.query("BEGIN");
    const suffix = crypto.randomUUID();
    const customer = "test-c-" + suffix,
      driver = "test-d-" + suffix,
      other = "test-o-" + suffix,
      admin = "test-a-" + suffix;
    for (const id of [customer, driver, other, admin])
      await c.query(
        "INSERT INTO profiles(id,name,email,verified) VALUES($1,$1,$2,true)",
        [id, id + "@example.test"],
      );
    await c.query("INSERT INTO roles(user_id,role) VALUES($1,'admin')", [
      admin,
    ]);
    await c.query(
      "INSERT INTO drivers(user_id,name,phone,dob,address,status,background_passed,online) VALUES($1,'Test driver','0712345678','1990-01-01','Dar','approved',true,true)",
      [driver],
    );
    const s = (
      await c.query(
        "INSERT INTO shops(name,type,address,status,commission) VALUES('Test','grocery','Dar','approved',10) RETURNING id",
      )
    ).rows[0].id;
    const p = (
      await c.query(
        "INSERT INTO products(shop_id,name,sw,price,unit,category,stock) VALUES($1,'Test','Jaribio',4500,'1 kg','Test',10) RETURNING id",
        [s],
      )
    ).rows[0].id;
    const as = async (id) =>
      c.query("SELECT set_config('app.user_id',$1,true)", [id]);
    const order = async (qty = 2) => {
      await as(customer);
      return (
        await c.query(
          "SELECT * FROM place_order($1,$2,'Mikocheni, Dar es Salaam','',-6.77,39.24,$3)",
          [s, JSON.stringify([{ id: p, quantity: qty }]), crypto.randomUUID()],
        )
      ).rows[0];
    };
    const rejects = async (sql) => {
      await c.query("SAVEPOINT attempt");
      try {
        await assert.rejects(sql);
      } finally {
        await c.query("ROLLBACK TO SAVEPOINT attempt");
      }
    };
    await fn({ c, customer, driver, other, admin, s, p, as, order, rejects });
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}
test(
  "place_order takes current database price, decrements stock and auto-readies grocery",
  { skip: !enabled },
  () =>
    scenario(async ({ c, p, order }) => {
      const o = await order();
      assert.equal(o.subtotal, 9000);
      assert.equal(o.delivery_fee, 2000);
      assert.equal(o.status, "ready");
      assert(o.accepted_at && o.ready_at);
      assert.equal(
        (await c.query("SELECT stock FROM products WHERE id=$1", [p])).rows[0]
          .stock,
        8,
      );
    }),
);
test(
  "insufficient stock and zero/negative quantities fail atomically",
  { skip: !enabled },
  () =>
    scenario(async ({ c, p, order, rejects }) => {
      for (const q of [0, -1, 11]) await rejects(() => order(q));
      assert.equal(
        (await c.query("SELECT stock FROM products WHERE id=$1", [p])).rows[0]
          .stock,
        10,
      );
    }),
);
test(
  "unrelated customer cannot cancel or update another order",
  { skip: !enabled },
  () =>
    scenario(async ({ c, as, other, order, rejects }) => {
      const o = await order();
      await as(other);
      await rejects(() =>
        c.query("SELECT * FROM update_order_status($1,'cancelled')", [o.id]),
      );
      assert.equal(
        (await c.query("SELECT status FROM orders WHERE id=$1", [o.id])).rows[0]
          .status,
        "ready",
      );
    }),
);
test(
  "driver assignment is exclusive and driver cannot take two active jobs",
  { skip: !enabled },
  () =>
    scenario(async ({ c, as, driver, order, rejects }) => {
      const a = await order(),
        b = await order();
      await as(driver);
      await c.query("SELECT * FROM accept_delivery($1)", [a.id]);
      await rejects(() => c.query("SELECT * FROM accept_delivery($1)", [a.id]));
      await rejects(() => c.query("SELECT * FROM accept_delivery($1)", [b.id]));
    }),
);
test(
  "delivery requires pickup and private proof; credits wallet exactly once",
  { skip: !enabled },
  () =>
    scenario(async ({ c, as, driver, order, rejects }) => {
      const o = await order();
      await as(driver);
      await c.query("SELECT * FROM accept_delivery($1)", [o.id]);
      await rejects(() =>
        c.query("SELECT * FROM update_order_status($1,'delivered')", [o.id]),
      );
      await c.query("SELECT * FROM update_order_status($1,'picked_up')", [
        o.id,
      ]);
      await rejects(() =>
        c.query("SELECT * FROM update_order_status($1,'delivered')", [o.id]),
      );
      const d = (
        await c.query(
          "INSERT INTO documents(user_id,kind,key,mime,order_id) VALUES($1,'delivery_proof',$2,'image/jpeg',$3) RETURNING id",
          [driver, crypto.randomUUID(), o.id],
        )
      ).rows[0];
      await c.query("SELECT * FROM update_order_status($1,'delivered',$2)", [
        o.id,
        d.id,
      ]);
      await c.query("SELECT * FROM update_order_status($1,'delivered',$2)", [
        o.id,
        d.id,
      ]);
      assert.equal(
        Number(
          (
            await c.query(
              "SELECT sum(amount) total FROM ledger WHERE user_id=$1",
              [driver],
            )
          ).rows[0].total,
        ),
        2000,
      );
      assert(
        (await c.query("SELECT delivered_at FROM orders WHERE id=$1", [o.id]))
          .rows[0].delivered_at,
      );
    }),
);
test("cancellation restores stock exactly once", { skip: !enabled }, () =>
  scenario(async ({ c, as, admin, p, order }) => {
    const o = await order();
    await as(admin);
    await c.query("SELECT * FROM update_order_status($1,'cancelled')", [o.id]);
    await c.query("SELECT * FROM update_order_status($1,'cancelled')", [o.id]);
    assert.equal(
      (await c.query("SELECT stock FROM products WHERE id=$1", [p])).rows[0]
        .stock,
      10,
    );
  }),
);
test(
  "withdrawal minimum, reservations, permission and idempotent payment",
  { skip: !enabled },
  () =>
    scenario(async ({ c, as, admin, driver, other, rejects }) => {
      await c.query(
        "INSERT INTO ledger(user_id,amount,kind,reference) VALUES($1,5000,'delivery',$2)",
        [driver, crypto.randomUUID()],
      );
      await as(driver);
      await rejects(() => c.query("SELECT * FROM request_withdrawal(999)"));
      const w = (await c.query("SELECT * FROM request_withdrawal(4000)"))
        .rows[0];
      await rejects(() => c.query("SELECT * FROM request_withdrawal(2000)"));
      await as(other);
      await rejects(() => c.query("SELECT pay_withdrawal($1)", [w.id]));
      await as(admin);
      await c.query("SELECT pay_withdrawal($1)", [w.id]);
      await c.query("SELECT pay_withdrawal($1)", [w.id]);
      assert.equal(
        Number(
          (
            await c.query(
              "SELECT sum(amount) total FROM ledger WHERE user_id=$1",
              [driver],
            )
          ).rows[0].total,
        ),
        1000,
      );
    }),
);
test(
  "initial administrator grant requires the reserved confirmed email and cannot regrant after revocation",
  { skip: !enabled },
  async () => {
    const c = await getDatabase().pool.connect();
    try {
      await c.query("BEGIN");
      // Disposable branch only; rollback restores the real one-time marker.
      await c.query("DELETE FROM settings WHERE key='initial_admin_claim'");
      const id = "test-bootstrap-" + crypto.randomUUID();
      await c.query(
        "INSERT INTO profiles(id,name,email,verified) VALUES($1,'Operator','ajecknorbertm@gmail.com',false)",
        [id],
      );
      assert.equal(
        (await c.query("SELECT * FROM roles WHERE user_id=$1", [id])).rowCount,
        0,
      );
      await c.query(
        "UPDATE profiles SET email='other@example.test',verified=true WHERE id=$1",
        [id],
      );
      assert.equal(
        (await c.query("SELECT * FROM roles WHERE user_id=$1", [id])).rowCount,
        0,
      );
      await c.query(
        "UPDATE profiles SET email='ajecknorbertm@gmail.com' WHERE id=$1",
        [id],
      );
      assert.equal(
        (await c.query("SELECT role FROM roles WHERE user_id=$1", [id])).rows[0]
          ?.role,
        "admin",
      );
      await c.query("DELETE FROM roles WHERE user_id=$1", [id]);
      await c.query("UPDATE profiles SET verified=true WHERE id=$1", [id]);
      assert.equal(
        (await c.query("SELECT * FROM roles WHERE user_id=$1", [id])).rowCount,
        0,
      );
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  },
);

test(
  "administrator delivery confirmation still requires the assigned driver's proof for this order",
  { skip: !enabled },
  () =>
    scenario(async ({ c, as, admin, driver, other, order, rejects }) => {
      const o = await order();
      await as(driver);
      await c.query("SELECT * FROM accept_delivery($1)", [o.id]);
      await c.query("SELECT * FROM update_order_status($1,'picked_up')", [
        o.id,
      ]);
      const proof = async (userId, orderId) =>
        (
          await c.query(
            "INSERT INTO documents(user_id,kind,key,mime,order_id) VALUES($1,'delivery_proof',$2,'image/jpeg',$3) RETURNING id",
            [userId, crypto.randomUUID(), orderId],
          )
        ).rows[0].id;
      const wrongOwner = await proof(other, o.id);
      const wrongOrder = await proof(driver, null);
      const valid = await proof(driver, o.id);
      await as(admin);
      await rejects(() =>
        c.query("SELECT * FROM update_order_status($1,'delivered')", [o.id]),
      );
      for (const id of [wrongOwner, wrongOrder])
        await rejects(() =>
          c.query("SELECT * FROM update_order_status($1,'delivered',$2)", [
            o.id,
            id,
          ]),
        );
      await c.query("SELECT * FROM update_order_status($1,'delivered',$2)", [
        o.id,
        valid,
      ]);
      assert.equal(
        (
          await c.query("SELECT status,proof_id FROM orders WHERE id=$1", [
            o.id,
          ])
        ).rows[0].proof_id,
        valid,
      );
      assert.equal(
        Number(
          (
            await c.query(
              "SELECT sum(amount) amount FROM ledger WHERE user_id=$1",
              [driver],
            )
          ).rows[0].amount,
        ),
        2000,
      );
    }),
);

test(
  "restaurant order flows through owner acceptance, proof, shop earnings and both payouts",
  { skip: !enabled },
  () =>
    scenario(
      async ({
        c,
        as,
        admin,
        customer,
        driver,
        other,
        s,
        p,
        order,
        rejects,
      }) => {
        await c.query(
          "UPDATE shops SET type='restaurant',owner_id=$1 WHERE id=$2",
          [other, s],
        );
        const o = await order();
        assert.equal(o.customer_id, customer);
        assert.equal(o.status, "placed");
        assert.equal(o.subtotal, 9000);
        await as(driver);
        await rejects(() =>
          c.query("SELECT * FROM accept_delivery($1)", [o.id]),
        );
        await as(other);
        await c.query("SELECT * FROM update_order_status($1,'accepted')", [
          o.id,
        ]);
        await c.query("SELECT * FROM update_order_status($1,'ready')", [o.id]);
        await as(driver);
        await c.query("SELECT * FROM accept_delivery($1)", [o.id]);
        await c.query("SELECT * FROM update_order_status($1,'picked_up')", [
          o.id,
        ]);
        const proof = (
          await c.query(
            "INSERT INTO documents(user_id,kind,key,mime,order_id) VALUES($1,'delivery_proof',$2,'image/jpeg',$3) RETURNING id",
            [driver, crypto.randomUUID(), o.id],
          )
        ).rows[0].id;
        await c.query("SELECT * FROM update_order_status($1,'delivered',$2)", [
          o.id,
          proof,
        ]);
        const final = (
          await c.query("SELECT * FROM orders WHERE id=$1", [o.id])
        ).rows[0];
        for (const key of [
          "created_at",
          "accepted_at",
          "ready_at",
          "picked_up_at",
          "delivered_at",
        ])
          assert(final[key]);
        assert.equal(
          (await c.query("SELECT stock FROM products WHERE id=$1", [p])).rows[0]
            .stock,
          8,
        );
        const balance = async (id) =>
          Number(
            (
              await c.query(
                "SELECT coalesce(sum(amount),0) amount FROM ledger WHERE user_id=$1",
                [id],
              )
            ).rows[0].amount,
          );
        assert.equal(await balance(driver), 2000);
        assert.equal(await balance(other), 8100);
        for (const [user, amount] of [
          [driver, 2000],
          [other, 8100],
        ]) {
          await as(user);
          const withdrawal = (
            await c.query("SELECT * FROM request_withdrawal($1)", [amount])
          ).rows[0];
          await as(admin);
          await c.query("SELECT pay_withdrawal($1)", [withdrawal.id]);
          await c.query("SELECT pay_withdrawal($1)", [withdrawal.id]);
          assert.equal(await balance(user), 0);
          assert.equal(
            (
              await c.query(
                "SELECT count(*) count FROM ledger WHERE reference=$1",
                ["withdrawal:" + withdrawal.id],
              )
            ).rows[0].count,
            "1",
          );
        }
      },
    ),
);
