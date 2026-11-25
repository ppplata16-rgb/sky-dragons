-- Apply once to existing MySQL installations before deploying this version.
CREATE TABLE `FleetAssets` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `type` ENUM('bote','ergometro','otro') NOT NULL DEFAULT 'bote',
  `status` ENUM('disponible','mantenimiento','fuera_servicio') NOT NULL DEFAULT 'disponible',
  `notes` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fleet_assets_code_unique` (`code`)
) ENGINE=InnoDB;

CREATE TABLE `FleetBookings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `assetId` INTEGER NOT NULL,
  `memberId` INTEGER NULL,
  `date` DATE NOT NULL,
  `startTime` VARCHAR(5) NOT NULL,
  `endTime` VARCHAR(5) NOT NULL,
  `purpose` VARCHAR(160) NOT NULL,
  `status` ENUM('reservada','realizada','cancelada') NOT NULL DEFAULT 'reservada',
  `notes` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fleet_bookings_resource_time` (`assetId`,`date`,`startTime`,`endTime`,`status`),
  CONSTRAINT `fleet_bookings_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `FleetAssets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fleet_bookings_member_fk` FOREIGN KEY (`memberId`) REFERENCES `Members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `FleetMaintenances` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `assetId` INTEGER NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `reportedAt` DATE NOT NULL,
  `nextDue` DATE NULL,
  `status` ENUM('pendiente','en_proceso','completado') NOT NULL DEFAULT 'pendiente',
  `notes` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fleet_maintenance_asset_status` (`assetId`,`status`,`nextDue`),
  CONSTRAINT `fleet_maintenance_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `FleetAssets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
