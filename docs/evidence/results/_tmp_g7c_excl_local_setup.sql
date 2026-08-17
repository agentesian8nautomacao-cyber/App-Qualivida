-- Local disposable harness for G7-C exclusion deep review (NOT LIVE)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL,
  resident_id uuid NOT NULL,
  resident_name varchar NOT NULL,
  unit varchar NOT NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status varchar NOT NULL DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT reservations_status_check CHECK (
    status::text = ANY (ARRAY['scheduled','active','completed','canceled']::varchar[])
  )
);

-- Constraint under review (same as migration 007 body)
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_area_date_slot_excl
  EXCLUDE USING gist (
    area_id WITH =,
    "date" WITH =,
    tsrange(
      ("date"::timestamp + start_time),
      ("date"::timestamp + end_time),
      '[)'
    ) WITH &&
  )
  WHERE (status IN ('scheduled', 'active'));
