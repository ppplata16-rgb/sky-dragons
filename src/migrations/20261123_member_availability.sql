-- Apply once to existing MySQL installations before deploying this version.
ALTER TABLE `Members`
  ADD COLUMN `availableDays` JSON NULL,
  ADD COLUMN `unavailableFrom` DATE NULL,
  ADD COLUMN `unavailableUntil` DATE NULL,
  ADD COLUMN `availabilityNotes` VARCHAR(255) NULL;
