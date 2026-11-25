-- Apply once to existing MySQL installations before deploying this version.
CREATE TABLE IF NOT EXISTS `GalleryPhotos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(80) NULL,
  `photoDate` DATE NULL,
  `image` MEDIUMBLOB NOT NULL,
  `imageType` VARCHAR(40) NOT NULL,
  `createdBy` INTEGER NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `GalleryPhotos_photoDate` (`photoDate`)
);
