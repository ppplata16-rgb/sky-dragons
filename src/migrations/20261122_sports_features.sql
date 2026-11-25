-- Apply once to existing MySQL installations before deploying this version.
ALTER TABLE `Trainings`
  ADD COLUMN `distanceM` INTEGER NULL,
  ADD COLUMN `durationMinutes` INTEGER NULL,
  ADD COLUMN `strokeRate` INTEGER NULL,
  ADD COLUMN `waterConditions` VARCHAR(120) NULL,
  ADD COLUMN `safetyChecks` JSON NULL;

ALTER TABLE `Lineups`
  MODIFY COLUMN `raceId` INTEGER NULL,
  ADD COLUMN `boatType` ENUM('DB12', 'DB22') NOT NULL DEFAULT 'DB12',
  ADD COLUMN `category` VARCHAR(80) NOT NULL DEFAULT 'Open 1';

ALTER TABLE `Competitions`
  MODIFY COLUMN `scope` ENUM('local', 'nacional', 'internacional') NOT NULL DEFAULT 'local';
