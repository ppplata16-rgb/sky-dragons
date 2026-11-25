-- Apply once to add reserve seats to existing lineup databases.
ALTER TABLE `LineupSeats`
  MODIFY COLUMN `seatRole` ENUM('remero', 'timonel', 'tamborilero', 'suplente') NOT NULL DEFAULT 'remero';
