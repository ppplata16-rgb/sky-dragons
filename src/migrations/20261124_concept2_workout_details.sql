ALTER TABLE `ErgScores`
  MODIFY COLUMN `durationSeconds` DECIMAL(9,1) NOT NULL,
  ADD COLUMN `workoutType` VARCHAR(60) NULL,
  ADD COLUMN `weightClass` VARCHAR(1) NULL,
  ADD COLUMN `averageStrokeRate` INTEGER NULL,
  ADD COLUMN `averageHeartRate` INTEGER NULL,
  ADD COLUMN `caloriesTotal` INTEGER NULL,
  ADD COLUMN `dragFactor` INTEGER NULL,
  ADD COLUMN `strokeCount` INTEGER NULL,
  ADD COLUMN `comments` TEXT NULL;
