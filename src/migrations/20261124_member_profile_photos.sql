-- Apply once to existing MySQL installations before deploying this version.
ALTER TABLE `Members`
  ADD COLUMN `profilePhoto` MEDIUMBLOB NULL,
  ADD COLUMN `profilePhotoType` VARCHAR(40) NULL;
