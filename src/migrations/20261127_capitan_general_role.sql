-- Production role enum update; the API startup applies this idempotently.
ALTER TABLE `Users`
  MODIFY COLUMN `role` ENUM('admin', 'capitan', 'capitan_general', 'tesorero', 'lector') DEFAULT 'lector';
