CREATE TABLE IF NOT EXISTS `PhysicalMetrics` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `memberId` INT NOT NULL,
  `date` DATE NOT NULL,
  `metricName` VARCHAR(100) NOT NULL,
  `value` DECIMAL(10,2) NOT NULL,
  `unit` VARCHAR(30) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `physical_metrics_member_name_date` (`memberId`, `metricName`, `date`),
  CONSTRAINT `physical_metrics_member_fk` FOREIGN KEY (`memberId`) REFERENCES `Members` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
