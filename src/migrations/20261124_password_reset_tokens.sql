CREATE TABLE IF NOT EXISTS `PasswordResetTokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_token_hash` (`tokenHash`),
  KEY `password_reset_user_expiry` (`userId`, `expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
