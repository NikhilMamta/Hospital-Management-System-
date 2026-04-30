CREATE TABLE public.store_out (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp timestamp with time zone DEFAULT now(),
  indent_no text UNIQUE,
  indenter_name text,
  indent_type text DEFAULT 'Store Out',
  approval_needed text,
  ward_name text,
  group_of_head text,
  issue_date date,
  medicines jsonb, -- Array of { product_name, quantity, uom }
  status text DEFAULT 'completed',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT store_out_pkey PRIMARY KEY (id)
);
