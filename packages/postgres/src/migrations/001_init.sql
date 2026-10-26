-- Apiary PostgreSQL schema (migration 001)
-- The exclusion constraint uses GiST with btree_gist so that double-booking
-- is prevented per provider rather than globally across all providers.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Dynamic business hours (weekly recurring rules, expressed in local
-- wall-clock time; the caller supplies the IANA timezone when reading).
-- provider_id NULL = global/default rule applying to all providers.
CREATE TABLE scheduling_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_hours_valid_span CHECK (end_time > start_time)
);

CREATE INDEX scheduling_business_hours_provider_idx
  ON scheduling_business_hours (provider_id);

-- Explicit admin-approved shifts. Only published shifts generate availability.
CREATE TABLE scheduling_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  shift_window TSTZRANGE NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX scheduling_shifts_provider_published_idx
  ON scheduling_shifts (provider_id, is_published);

-- Bookings and holds. The exclusion constraint is the database-level
-- race-condition guard: overlapping holds/confirmed bookings are rejected
-- atomically per provider. Holds expire via hold_expires_at and no longer
-- block once past.
CREATE TABLE scheduling_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  booking_window TSTZRANGE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'hold'
    CHECK (status IN ('hold', 'confirmed', 'cancelled', 'expired')),
  customer_id UUID,
  customer_details JSONB,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  EXCLUDE USING GIST (
    provider_id WITH =,
    booking_window WITH &&
  ) WHERE (status IN ('hold', 'confirmed'))
);

CREATE INDEX scheduling_bookings_provider_idx
  ON scheduling_bookings (provider_id);
