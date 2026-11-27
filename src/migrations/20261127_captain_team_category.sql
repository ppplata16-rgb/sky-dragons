-- Apply once to existing MySQL installations if Sequelize sync does not add the column.
ALTER TABLE `Users`
  ADD COLUMN `teamCategory` VARCHAR(30) NULL;
