-- The trusted server writes profiles only after checking the canonical Identity user.
-- The unique settings key makes this an irreversible one-time claim, so revoking
-- the role later does not silently grant it again on the next sign-in.
CREATE FUNCTION dbd_provision_initial_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed text;
BEGIN
  IF NEW.verified IS NOT TRUE OR lower(NEW.email) <> 'ajecknorbertm@gmail.com' THEN
    RETURN NEW;
  END IF;
  INSERT INTO settings(key,value) VALUES('initial_admin_claim',to_jsonb(NEW.id))
    ON CONFLICT(key) DO NOTHING RETURNING key INTO claimed;
  IF claimed IS NOT NULL THEN
    INSERT INTO roles(user_id,role) VALUES(NEW.id,'admin') ON CONFLICT(user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION dbd_provision_initial_admin() FROM PUBLIC;
CREATE TRIGGER provision_initial_admin AFTER INSERT OR UPDATE OF email,verified ON profiles
FOR EACH ROW EXECUTE FUNCTION dbd_provision_initial_admin();
-- Provision an already verified profile as well, without selecting ambiguously.
DO $$ DECLARE chosen text; claimed text; BEGIN
  IF (SELECT count(*) FROM profiles WHERE verified IS TRUE AND lower(email)='ajecknorbertm@gmail.com')=1 THEN
    SELECT id INTO chosen FROM profiles WHERE verified IS TRUE AND lower(email)='ajecknorbertm@gmail.com';
    INSERT INTO settings(key,value) VALUES('initial_admin_claim',to_jsonb(chosen))
      ON CONFLICT(key) DO NOTHING RETURNING key INTO claimed;
    IF claimed IS NOT NULL THEN
      INSERT INTO roles(user_id,role) VALUES(chosen,'admin') ON CONFLICT(user_id) DO NOTHING;
    END IF;
  END IF;
END $$;
