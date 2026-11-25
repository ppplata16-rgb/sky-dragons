-- Apply once to existing MySQL installations before deploying this version.
ALTER TABLE `Races`
  ADD COLUMN `medalPhoto` MEDIUMBLOB NULL,
  ADD COLUMN `medalPhotoType` VARCHAR(40) NULL;
