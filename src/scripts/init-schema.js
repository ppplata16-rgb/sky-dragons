require('dotenv').config();
const { sequelize } = require('../models');

async function initializeEmptyDatabase() {
  await sequelize.authenticate();
  const [tables] = await sequelize.query('SHOW TABLES');
  if (tables.length) {
    throw new Error('La base ya contiene tablas. No se modificó; aplica las migraciones versionadas correspondientes.');
  }

  await sequelize.sync();
  console.log('Esquema inicial creado en la base vacía.');
}

initializeEmptyDatabase()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
