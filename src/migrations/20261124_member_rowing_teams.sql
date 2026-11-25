-- Apply once to existing MySQL installations before deploying this version.
ALTER TABLE `Members`
  ADD COLUMN `rowingTeams` TEXT NULL;
