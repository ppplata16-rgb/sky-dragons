ALTER TABLE `ErgScores`
  MODIFY COLUMN `durationSeconds` DECIMAL(9,1) NOT NULL,
  ADD COLUMN `source` VARCHAR(30) NOT NULL DEFAULT 'manual',
  ADD COLUMN `externalId` VARCHAR(80) NULL,
  ADD COLUMN `deviceSource` VARCHAR(60) NULL,
  ADD UNIQUE INDEX `erg_scores_member_source_external` (`memberId`, `source`, `externalId`);

CREATE TABLE IF NOT EXISTS `Concept2Connections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `memberId` INT NOT NULL,
  `logbookUserId` VARCHAR(80) NULL,
  `logbookUsername` VARCHAR(120) NULL,
  `accessTokenEncrypted` TEXT NOT NULL,
  `refreshTokenEncrypted` TEXT NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `lastSyncedAt` DATETIME NULL,
  `syncCursor` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `concept2_connections_member_unique` (`memberId`),
  CONSTRAINT `concept2_connections_member_fk` FOREIGN KEY (`memberId`) REFERENCES `Members` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
