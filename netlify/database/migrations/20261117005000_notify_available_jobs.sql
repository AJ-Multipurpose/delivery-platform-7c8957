CREATE OR REPLACE FUNCTION dbd_publish_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data jsonb=to_jsonb(NEW); targets text[]='{}'; owner_id text; BEGIN
IF TG_TABLE_NAME='orders' THEN
 SELECT s.owner_id INTO owner_id FROM shops s WHERE s.id=(row_data->>'shop_id')::integer;
 targets=ARRAY[row_data->>'customer_id',row_data->>'driver_id',owner_id];
 -- A fixed-size flag avoids Postgres's notification payload limit as the fleet grows.
ELSIF TG_TABLE_NAME='drivers' THEN
 targets=ARRAY[row_data->>'user_id'];
 targets=targets||ARRAY(SELECT customer_id FROM orders WHERE driver_id=row_data->>'user_id' AND status='picked_up');
ELSIF TG_TABLE_NAME='shops' THEN targets=ARRAY[row_data->>'owner_id'];
ELSE targets=ARRAY[row_data->>'user_id']; END IF;
PERFORM pg_notify('dbd_changes',json_build_object('targets',array_remove(targets,NULL),'jobs_changed',TG_TABLE_NAME='orders')::text);
RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION dbd_publish_change() FROM PUBLIC;
