CREATE TABLE IF NOT EXISTS `ErgScores` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `memberId` INT NOT NULL,
  `date` DATE NOT NULL,
  `distanceM` INT NOT NULL,
  `durationSeconds` INT NOT NULL,
  `averageWatts` DECIMAL(7,2) NULL,
  `bodyWeightKg` DECIMAL(5,2) NULL,
  `contributionPercent` DECIMAL(5,2) NULL,
  `notes` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `erg_scores_member_distance_date` (`memberId`, `distanceM`, `date`),
  CONSTRAINT `erg_scores_member_fk` FOREIGN KEY (`memberId`) REFERENCES `Members` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
