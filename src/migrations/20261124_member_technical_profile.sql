-- Apply once to existing MySQL installations before deploying this version.
ALTER TABLE `Members`
  ADD COLUMN `biography` TEXT NULL,
  ADD COLUMN `palmares` TEXT NULL;
