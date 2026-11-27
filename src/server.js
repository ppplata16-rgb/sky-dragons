require('dotenv').config();
const bcrypt = require('bcryptjs');
const { DataTypes } = require('sequelize');
const app = require('./app');
const { sequelize, User } = require('./models');

async function ensureCaptainRosterSchema() {
  const [columns] = await sequelize.query("SHOW COLUMNS FROM `Users` LIKE 'teamCategory'");
  if (columns.length) return;
  try {
    await sequelize.getQueryInterface().addColumn('Users', 'teamCategory', {
      type: DataTypes.STRING(30),
      allowNull: true,
    });
    console.log('Esquema actualizado: Users.teamCategory');
  } catch (error) {
    if (error.original?.code !== 'ER_DUP_FIELDNAME') throw error;
  }
}

function validateEnvironment() {
  const required = ['JWT_SECRET', 'DB_NAME', 'DB_USER', 'DB_PASS'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  const jwtSecret = process.env.JWT_SECRET;
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32 || /^(cambia_esto|replace_with|reemplaza_con|generar_con)/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET debe ser un secreto aleatorio propio de al menos 32 bytes. Genera uno con: openssl rand -hex 32');
  }
}

async function start() {
  validateEnvironment();
  await sequelize.authenticate();
  await ensureCaptainRosterSchema();

  if (process.env.NODE_ENV !== 'production') {
    await sequelize.sync({ alter: true });
  }

  if ((await User.count()) === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await User.create({
      name: 'Administrador',
      email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
      role: 'admin',
    });
    console.log(`Usuario admin creado: ${process.env.ADMIN_EMAIL}`);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Sky Dragons API en http://localhost:${port}`));
}

start().catch((e) => { console.error(e); process.exit(1); });
