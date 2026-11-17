CREATE FUNCTION dbd_uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'') $$;
CREATE FUNCTION dbd_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM roles WHERE user_id=dbd_uid() AND role='admin') $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','roles','shops','products','drivers','orders','documents','ledger','withdrawals','ratings','disputes','settings','email_outbox'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t); EXECUTE format('CREATE POLICY admin_access ON %I FOR ALL USING (dbd_admin()) WITH CHECK (dbd_admin())',t); END LOOP; END $$;
CREATE POLICY profile_self ON profiles FOR SELECT USING(id=dbd_uid());
CREATE POLICY role_self ON roles FOR SELECT USING(user_id=dbd_uid());
CREATE POLICY shop_read ON shops FOR SELECT USING(status='approved' OR owner_id=dbd_uid());
CREATE POLICY product_read ON products FOR SELECT USING(EXISTS(SELECT 1 FROM shops s WHERE s.id=shop_id AND (s.status='approved' OR s.owner_id=dbd_uid())));
CREATE POLICY driver_self ON drivers FOR SELECT USING(user_id=dbd_uid());
CREATE POLICY order_read ON orders FOR SELECT USING(customer_id=dbd_uid() OR driver_id=dbd_uid() OR EXISTS(SELECT 1 FROM shops s WHERE s.id=shop_id AND s.owner_id=dbd_uid()));
CREATE POLICY doc_self ON documents FOR SELECT USING(user_id=dbd_uid());
CREATE POLICY ledger_self ON ledger FOR SELECT USING(user_id=dbd_uid());
CREATE POLICY withdrawal_self ON withdrawals FOR SELECT USING(user_id=dbd_uid());
CREATE POLICY rating_self ON ratings FOR SELECT USING(user_id=dbd_uid());
CREATE POLICY dispute_self ON disputes FOR SELECT USING(user_id=dbd_uid());
ALTER TABLE products ADD CONSTRAINT valid_product CHECK(price>=0 AND stock>=0);
ALTER TABLE shops ADD CONSTRAINT valid_commission CHECK(commission BETWEEN 0 AND 100);
ALTER TABLE ratings ADD CONSTRAINT valid_rating CHECK(stars BETWEEN 1 AND 5);
ALTER TABLE withdrawals ADD CONSTRAINT valid_withdrawal CHECK(amount>=1000);
ALTER TABLE orders ADD CONSTRAINT valid_status CHECK(status IN ('placed','accepted','ready','picked_up','delivered','cancelled'));
CREATE INDEX orders_customer ON orders(customer_id,created_at DESC);
CREATE INDEX orders_driver ON orders(driver_id,created_at DESC);
CREATE INDEX orders_shop ON orders(shop_id,created_at DESC);
CREATE INDEX ledger_user ON ledger(user_id,created_at DESC);
CREATE FUNCTION place_order(p_shop integer,p_items jsonb,p_address text,p_notes text,p_lat float8,p_lng float8,p_key text) RETURNS orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s shops; p products; line jsonb; cart jsonb='[]'; total integer=0; qty integer; o orders; BEGIN
IF dbd_uid() IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=dbd_uid() AND verified) THEN RAISE EXCEPTION 'Verified account required'; END IF;
SELECT * INTO o FROM orders WHERE idempotency_key=p_key; IF FOUND THEN IF o.customer_id<>dbd_uid() THEN RAISE EXCEPTION 'Invalid request'; END IF; RETURN o; END IF;
IF length(trim(p_address))<8 OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Address and cart required'; END IF;
SELECT * INTO s FROM shops WHERE id=p_shop AND status='approved' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Shop unavailable'; END IF;
FOR line IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY (value->>'id')::integer LOOP
qty=(line->>'quantity')::integer; IF qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
SELECT * INTO p FROM products WHERE id=(line->>'id')::integer AND shop_id=p_shop AND available FOR UPDATE;
IF NOT FOUND OR p.stock<qty THEN RAISE EXCEPTION 'Item unavailable or insufficient stock'; END IF;
UPDATE products SET stock=stock-qty WHERE id=p.id; total=total+p.price*qty;
cart=cart||jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name,'sw',p.sw,'price',p.price,'quantity',qty,'image',p.image,'unit',p.unit));
END LOOP;
INSERT INTO orders(customer_id,shop_id,items,subtotal,delivery_fee,commission_rate,address,notes,lat,lng,idempotency_key,status,accepted_at,ready_at) VALUES(dbd_uid(),p_shop,cart,total,2000,s.commission,p_address,p_notes,p_lat,p_lng,p_key,CASE WHEN s.type='grocery' THEN 'ready' ELSE 'placed' END,CASE WHEN s.type='grocery' THEN now() END,CASE WHEN s.type='grocery' THEN now() END) RETURNING * INTO o;
INSERT INTO email_outbox(recipient,event,order_id) SELECT email,'order_confirmation',o.id FROM profiles WHERE id=dbd_uid(); RETURN o; END $$;
CREATE FUNCTION accept_delivery(p_order integer) RETURNS orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; BEGIN
IF NOT EXISTS(SELECT 1 FROM drivers WHERE user_id=dbd_uid() AND status='approved' AND online) THEN RAISE EXCEPTION 'Approved online driver required'; END IF;
PERFORM 1 FROM drivers WHERE user_id=dbd_uid() FOR UPDATE;
IF EXISTS(SELECT 1 FROM orders WHERE driver_id=dbd_uid() AND status IN ('ready','picked_up')) THEN RAISE EXCEPTION 'Complete your current delivery first'; END IF;
UPDATE orders SET driver_id=dbd_uid() WHERE id=p_order AND status='ready' AND driver_id IS NULL RETURNING * INTO o; IF NOT FOUND THEN RAISE EXCEPTION 'Delivery already assigned or unavailable'; END IF; RETURN o; END $$;
CREATE FUNCTION update_order_status(p_order integer,p_status text,p_proof integer DEFAULT NULL) RETURNS orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE o orders; s shops; line jsonb; is_owner boolean; BEGIN
SELECT * INTO o FROM orders WHERE id=p_order FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
SELECT * INTO s FROM shops WHERE id=o.shop_id; is_owner=s.owner_id=dbd_uid() AND s.status='approved';
IF NOT coalesce((dbd_admin() OR (coalesce(is_owner,false) AND p_status IN ('accepted','ready','cancelled')) OR (o.driver_id=dbd_uid() AND EXISTS(SELECT 1 FROM drivers WHERE user_id=dbd_uid() AND status='approved') AND p_status IN ('picked_up','delivered')) OR (o.customer_id=dbd_uid() AND o.status='placed' AND p_status='cancelled')),false) THEN RAISE EXCEPTION 'Permission denied'; END IF;
IF o.status=p_status THEN RETURN o; END IF;
IF NOT ((o.status='placed' AND p_status IN ('accepted','cancelled')) OR (o.status='accepted' AND p_status IN ('ready','cancelled')) OR (o.status='ready' AND p_status IN ('picked_up','cancelled')) OR (o.status='picked_up' AND p_status='delivered')) THEN RAISE EXCEPTION 'Invalid status transition'; END IF;
IF p_status='picked_up' AND o.driver_id IS NULL THEN RAISE EXCEPTION 'Assign a driver first'; END IF;
IF p_status='delivered' AND NOT EXISTS(SELECT 1 FROM documents WHERE id=p_proof AND kind='delivery_proof' AND order_id=o.id AND user_id=o.driver_id) THEN RAISE EXCEPTION 'Delivery photo required'; END IF;
IF p_status='cancelled' THEN FOR line IN SELECT value FROM jsonb_array_elements(o.items) LOOP UPDATE products SET stock=stock+(line->>'quantity')::integer WHERE id=(line->>'id')::integer; END LOOP; END IF;
UPDATE orders SET status=p_status,proof_id=coalesce(p_proof,proof_id),accepted_at=CASE WHEN p_status='accepted' THEN now() ELSE accepted_at END,ready_at=CASE WHEN p_status='ready' THEN now() ELSE ready_at END,picked_up_at=CASE WHEN p_status='picked_up' THEN now() ELSE picked_up_at END,delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END WHERE id=o.id RETURNING * INTO o;
IF p_status='delivered' THEN
INSERT INTO ledger(user_id,amount,kind,reference) VALUES(o.driver_id,2000,'delivery','delivery:'||o.id) ON CONFLICT(reference) DO NOTHING;
IF s.owner_id IS NOT NULL THEN INSERT INTO ledger(user_id,amount,kind,reference) VALUES(s.owner_id,o.subtotal-floor(o.subtotal*o.commission_rate/100.0)::integer,'sale','sale:'||o.id) ON CONFLICT(reference) DO NOTHING; END IF;
END IF;
INSERT INTO email_outbox(recipient,event,order_id) SELECT email,CASE WHEN p_status='delivered' THEN 'delivery_confirmation' ELSE 'status_'||p_status END,o.id FROM profiles WHERE id=o.customer_id ON CONFLICT(event,order_id) DO NOTHING;
RETURN o; END $$;
CREATE FUNCTION request_withdrawal(p_amount integer) RETURNS withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE balance bigint; pending bigint; w withdrawals; BEGIN
PERFORM 1 FROM profiles WHERE id=dbd_uid() FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF NOT (EXISTS(SELECT 1 FROM drivers WHERE user_id=dbd_uid() AND status='approved') OR EXISTS(SELECT 1 FROM shops WHERE owner_id=dbd_uid() AND status='approved')) THEN RAISE EXCEPTION 'Approved account required'; END IF;
SELECT coalesce(sum(amount),0) INTO balance FROM ledger WHERE user_id=dbd_uid(); SELECT coalesce(sum(amount),0) INTO pending FROM withdrawals WHERE user_id=dbd_uid() AND status='pending';
IF p_amount<1000 OR p_amount>balance-pending THEN RAISE EXCEPTION 'Minimum TSh 1,000; insufficient available balance'; END IF;
INSERT INTO withdrawals(user_id,amount) VALUES(dbd_uid(),p_amount) RETURNING * INTO w; RETURN w; END $$;
CREATE FUNCTION pay_withdrawal(p_id integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE w withdrawals; BEGIN
IF NOT dbd_admin() THEN RAISE EXCEPTION 'Admin required'; END IF;
SELECT * INTO w FROM withdrawals WHERE id=p_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF; IF w.status='paid' THEN RETURN; END IF;
PERFORM 1 FROM profiles WHERE id=w.user_id FOR UPDATE;
INSERT INTO ledger(user_id,amount,kind,reference) VALUES(w.user_id,-w.amount,'withdrawal','withdrawal:'||w.id);
UPDATE withdrawals SET status='paid',paid_at=now() WHERE id=w.id; END $$;
REVOKE EXECUTE ON FUNCTION place_order(integer,jsonb,text,text,float8,float8,text), accept_delivery(integer), update_order_status(integer,text,integer),request_withdrawal(integer),pay_withdrawal(integer) FROM PUBLIC;
INSERT INTO settings(key,value) VALUES('city_speed','22'),('road_factor','1.35');

ALTER TABLE ledger ADD CONSTRAINT ledger_nonzero CHECK(amount<>0);
ALTER TABLE drivers ADD CONSTRAINT driver_status CHECK(status IN ('pending','approved','suspended'));
ALTER TABLE documents ADD CONSTRAINT document_status CHECK(status IN ('pending','approved','rejected'));
ALTER TABLE shops ADD CONSTRAINT shop_status CHECK(status IN ('pending','approved','suspended'));
ALTER TABLE drivers ADD CONSTRAINT approved_background CHECK(status<>'approved' OR background_passed=true);
CREATE FUNCTION record_expense(p_user text,p_amount integer,p_note text,p_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT dbd_admin() AND (p_user IS DISTINCT FROM dbd_uid() OR NOT EXISTS(SELECT 1 FROM drivers WHERE user_id=dbd_uid() AND status='approved')) THEN RAISE EXCEPTION 'Permission denied'; END IF;
IF p_amount<1 OR length(trim(p_note))<3 THEN RAISE EXCEPTION 'Positive amount and expense note required'; END IF;
PERFORM 1 FROM profiles WHERE id=p_user FOR UPDATE;
IF p_amount>(SELECT coalesce(sum(amount),0) FROM ledger WHERE user_id=p_user)-(SELECT coalesce(sum(amount),0) FROM withdrawals WHERE user_id=p_user AND status='pending') THEN RAISE EXCEPTION 'Insufficient available balance'; END IF;
INSERT INTO ledger(user_id,amount,kind,reference) VALUES(p_user,-p_amount,'expense: '||left(p_note,200),'expense:'||p_key) ON CONFLICT(reference) DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION record_expense(text,integer,text,text) FROM PUBLIC;
