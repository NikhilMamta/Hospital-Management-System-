CREATE OR REPLACE FUNCTION fn_block_unpaid_lab_start()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.actual1 IS DISTINCT FROM OLD.actual1
       AND NEW.payment_status IS DISTINCT FROM 'Yes' THEN
        RAISE EXCEPTION 'Payment not completed. Cannot start lab process.';
    END IF;

    RETURN NEW;
END;
$$;
