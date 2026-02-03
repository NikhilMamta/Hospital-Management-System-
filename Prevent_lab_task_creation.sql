CREATE OR REPLACE FUNCTION prevent_lab_tasks_unpaid()
RETURNS TRIGGER AS $$
BEGIN
  -- If explicitly unpaid → clear workflow
  IF NEW.payment_status = 'No' THEN
    NEW.planned1 := NULL;
    NEW.actual1 := NULL;
    NEW.planned2 := NULL;
    NEW.actual2 := NULL;
    NEW.delay1 := NULL;
    NEW.delay2 := NULL;
    NEW.planned3 := NULL;
    NEW.actual3 := NULL;
    NEW.delay3 := NULL;
    NEW.planned4 := NULL;
    NEW.actual4 := NULL;
    NEW.receive_sample := NULL;
    NEW.bill_image_url := NULL;
  END IF;

  -- When payment becomes Yes → allow workflow
  IF NEW.payment_status = 'Yes'
     AND OLD.payment_status IS DISTINCT FROM 'Yes' THEN
    NEW.planned1 := COALESCE(
      NEW.planned1,
      NOW()::timestamp(0)::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
