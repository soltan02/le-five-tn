-- Server-side backstop against a race where two concurrent "confirm" calls
-- both succeed for the same slot. The app also checks this client-side
-- (declining competitors on confirm), but this is the hard guarantee.
CREATE UNIQUE INDEX "bookings_one_confirmed_per_slot"
  ON "Booking" ("dayKey", "pitchId", "slotStart")
  WHERE "status" = 'confirmed';
