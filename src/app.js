const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { Op } = require('sequelize');
const { authenticate, allow } = require('./middleware/auth');
const crud = require('./routes/crud');
const authRoutes = require('./routes/auth');
const special = require('./routes/special');
const ergdata = require('./routes/ergdata');
const M = require('./models');

const app = express();
app.disable('x-powered-by');
app.use(helmet());

// Serverless deployments do not run src/server.js on startup. Create the
// initial admin lazily on the first API request, once per warm function.
let initialAdminPromise;
async function ensureInitialAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (!initialAdminPromise) {
    initialAdminPromise = (async () => {
      if (await M.User.count()) return;
      try {
        const bcrypt = require('bcryptjs');
        await M.User.create({
          name: 'Administrador',
          email,
          passwordHash: await bcrypt.hash(password, 12),
          role: 'admin',
        });
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError' || !(await M.User.findOne({ where: { email } }))) {
          throw error;
        }
      }
    })().catch((error) => {
      initialAdminPromise = null;
      throw error;
    });
  }
  await initialAdminPromise;
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // Requests through a single public tunnel can share one proxy IP. Keep the
  // brute-force limit per account so one teammate cannot lock out everyone.
  keyGenerator(req) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email || 'unknown-account';
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Inténtalo más tarde.' },
});

const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator(req) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email || ipKeyGenerator(req.ip);
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Has solicitado varios enlaces. Inténtalo más tarde.' },
});

const passwordResetIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
});

const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta conexión. Inténtalo más tarde.' },
});

const signupAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator(req) {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email || ipKeyGenerator(req.ip);
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Has solicitado varios registros para este correo. Inténtalo más tarde.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Solicita un enlace nuevo más tarde.' },
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res, next) => {
  ensureInitialAdmin().then(() => next()).catch(next);
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', passwordResetIpLimiter);
app.use('/api/auth/forgot-password', passwordResetRequestLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api/auth/signup', signupRateLimiter);
app.use('/api/auth/signup', signupAccountLimiter);
app.use('/api/auth', authRoutes);

// Todo lo demás requiere sesión
const api = express.Router();
api.use(authenticate);

// Rutas especiales primero (reportes, pasar lista, balance)
api.use(special);
api.use('/ergdata', ergdata.protectedRouter);

const equipo = ['capitan'];
const finanzas = ['tesorero'];

api.get('/members/:id/health', allow(...equipo), async (req, res, next) => {
  try {
    const member = await M.Member.findByPk(req.params.id, { attributes: ['id', 'allergies', 'medicalNotes', 'medicalClearanceUntil'] });
    if (!member) return res.status(404).json({ error: 'Integrante no encontrado.' });
    res.json(member);
  } catch (error) { next(error); }
});
api.put('/members/:id/health', allow(...equipo), async (req, res, next) => {
  try {
    const member = await M.Member.findByPk(req.params.id);
    if (!member) return res.status(404).json({ error: 'Integrante no encontrado.' });
    await member.update({ allergies: req.body?.allergies || null, medicalNotes: req.body?.medicalNotes || null, medicalClearanceUntil: req.body?.medicalClearanceUntil || null });
    res.json({ id: member.id, saved: true });
  } catch (error) { next(error); }
});
const canManageMemberPhoto = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'capitan' || Number(req.user.memberId) === Number(req.params.id)) return next();
  res.status(403).json({ error: 'Solo el remero vinculado, un capitán o un administrador puede cambiar esta foto.' });
};
api.post('/members/:id/profile-photo', canManageMemberPhoto, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Selecciona una foto JPG, PNG o WebP.' });
    const member = await M.Member.findByPk(req.params.id);
    if (!member) return res.status(404).json({ error: 'Integrante no encontrado.' });
    await member.update({ profilePhoto: req.body, profilePhotoType: req.headers['content-type'] });
    res.json({ saved: true, memberId: member.id });
  } catch (error) { next(error); }
});
api.get('/members/:id/profile-photo', async (req, res, next) => {
  try {
    const member = await M.Member.findByPk(req.params.id, { attributes: ['id', 'profilePhoto', 'profilePhotoType'] });
    if (!member?.profilePhoto) return res.status(404).json({ error: 'Este integrante no tiene foto de perfil.' });
    res.set('Content-Type', member.profilePhotoType || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(member.profilePhoto);
  } catch (error) { next(error); }
});
api.delete('/members/:id/profile-photo', canManageMemberPhoto, async (req, res, next) => {
  try {
    const member = await M.Member.findByPk(req.params.id);
    if (!member) return res.status(404).json({ error: 'Integrante no encontrado.' });
    await member.update({ profilePhoto: null, profilePhotoType: null });
    res.status(204).end();
  } catch (error) { next(error); }
});
api.use('/members', crud(M.Member, { write: equipo, exclude: ['allergies', 'medicalNotes', 'medicalClearanceUntil', 'profilePhoto', 'profilePhotoType'] }));
api.use('/trainings', crud(M.Training, { write: equipo }));
api.use('/attendances', crud(M.Attendance, { write: equipo, include: [M.Member, M.Training] }));
api.use('/erg-scores', crud(M.ErgScore, { write: equipo, include: [M.Member] }));
api.use('/physical-metrics', crud(M.PhysicalMetric, { write: equipo, include: [M.Member] }));
api.use('/competitions', crud(M.Competition, { write: equipo }));
api.put('/races/:id', allow(...equipo), async (req, res, next) => {
  try {
    const race = await M.Race.findByPk(req.params.id);
    if (!race) return res.status(404).json({ error: 'Resultado no encontrado.' });
    const attachedLineup = await M.Lineup.findOne({ where: { raceId: race.id } });
    if (attachedLineup && req.body?.category && req.body.category !== attachedLineup.category) {
      return res.status(409).json({ error: `La categoría del resultado debe coincidir con la alineación asociada (${attachedLineup.category}).` });
    }
    await race.update(req.body, { fields: ['competitionId', 'category', 'distanceM', 'timeSeconds', 'position', 'notes'] });
    res.json(race);
  } catch (error) { next(error); }
});
api.use('/races', crud(M.Race, { write: equipo, include: [M.Competition, { model: M.Lineup, as: 'lineups', include: [{ model: M.LineupSeat, as: 'seats', include: [M.Member] }] }], exclude: ['medalPhoto'] }));
api.post('/races/:id/medal-photo', allow('capitan'), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '15mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Selecciona una foto JPG, PNG o WebP.' });
    const race = await M.Race.findByPk(req.params.id);
    if (!race) return res.status(404).json({ error: 'Resultado no encontrado.' });
    if (![1, 2, 3].includes(Number(race.position))) return res.status(400).json({ error: 'Solo puedes adjuntar fotos a resultados con medalla.' });
    await race.update({ medalPhoto: req.body, medalPhotoType: req.headers['content-type'] });
    res.json({ saved: true, raceId: race.id });
  } catch (error) { next(error); }
});
api.get('/races/:id/medal-photo', async (req, res, next) => {
  try {
    const race = await M.Race.findByPk(req.params.id, { attributes: ['id', 'medalPhoto', 'medalPhotoType'] });
    if (!race?.medalPhoto) return res.status(404).json({ error: 'Este resultado no tiene foto.' });
    res.set('Content-Type', race.medalPhotoType || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(race.medalPhoto);
  } catch (error) { next(error); }
});
api.delete('/races/:id/medal-photo', allow('capitan'), async (req, res, next) => {
  try {
    const race = await M.Race.findByPk(req.params.id);
    if (!race) return res.status(404).json({ error: 'Resultado no encontrado.' });
    await race.update({ medalPhoto: null, medalPhotoType: null });
    res.status(204).end();
  } catch (error) { next(error); }
});
api.get('/gallery', async (req, res, next) => {
  try {
    const photos = await M.GalleryPhoto.findAll({
      attributes: { exclude: ['image'] },
      order: [['photoDate', 'DESC'], ['id', 'DESC']],
      limit: 500,
    });
    res.json({ data: photos });
  } catch (error) { next(error); }
});
api.post('/gallery', allow('capitan'), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '15mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Selecciona una foto JPG, PNG o WebP.' });
    const title = String(req.query.title || '').trim().slice(0, 160);
    if (!title) return res.status(400).json({ error: 'El título de la foto es obligatorio.' });
    const photo = await M.GalleryPhoto.create({
      title,
      description: String(req.query.description || '').trim().slice(0, 2000) || null,
      category: String(req.query.category || '').trim().slice(0, 80) || null,
      photoDate: req.query.photoDate || null,
      image: req.body,
      imageType: req.headers['content-type'],
      createdBy: req.user.id,
    });
    const safePhoto = photo.get({ plain: true });
    delete safePhoto.image;
    res.status(201).json(safePhoto);
  } catch (error) { next(error); }
});
api.get('/gallery/:id/image', async (req, res, next) => {
  try {
    const photo = await M.GalleryPhoto.findByPk(req.params.id, { attributes: ['id', 'image', 'imageType'] });
    if (!photo?.image) return res.status(404).json({ error: 'La foto no está disponible.' });
    res.set('Content-Type', photo.imageType || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(photo.image);
  } catch (error) { next(error); }
});
api.delete('/gallery/:id', allow('capitan'), async (req, res, next) => {
  try {
    const photo = await M.GalleryPhoto.findByPk(req.params.id);
    if (!photo) return res.status(404).json({ error: 'La foto no existe.' });
    await photo.destroy();
    res.status(204).end();
  } catch (error) { next(error); }
});
api.use('/lineups', crud(M.Lineup, { write: equipo, include: [{ model: M.LineupSeat, as: 'seats' }] }));
api.use('/lineup-seats', crud(M.LineupSeat, { write: equipo, include: [M.Member] }));
api.use('/fee-plans', crud(M.FeePlan, { read: finanzas, write: finanzas }));
api.use('/payments', crud(M.Payment, { read: finanzas, write: finanzas, include: [M.Member, M.FeePlan] }));
api.use('/expenses', crud(M.Expense, { read: finanzas, write: finanzas }));
api.use('/sponsors', crud(M.Sponsor, { read: [...finanzas, ...equipo], write: finanzas,
  include: [{ model: M.SponsorContribution, as: 'contributions' }] }));
api.use('/sponsor-contributions', crud(M.SponsorContribution, { read: finanzas, write: finanzas }));
api.use('/inventory-items', crud(M.InventoryItem, { write: equipo }));
api.use('/inventory-assignments', crud(M.InventoryAssignment, { write: equipo, include: [M.InventoryItem, M.Member] }));
api.use('/fleet-assets', crud(M.FleetAsset, { write: equipo }));
api.use('/fleet-maintenance', crud(M.FleetMaintenance, { write: equipo, include: [M.FleetAsset] }));
api.get('/fleet-bookings', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.assetId) where.assetId = req.query.assetId;
    if (req.query.date) where.date = req.query.date;
    res.json(await M.FleetBooking.findAll({ where, include: [M.FleetAsset, M.Member], order: [['date', 'ASC'], ['startTime', 'ASC']] }));
  } catch (error) { next(error); }
});
api.post('/fleet-bookings', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    const { assetId, memberId, date, startTime, endTime, purpose, notes } = req.body || {};
    if (!assetId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || '') || startTime >= endTime || !purpose?.trim()) {
      return res.status(400).json({ error: 'Completa el recurso, fecha, horario y propósito de la reserva.' });
    }
    transaction = await M.FleetAsset.sequelize.transaction();
    const asset = await M.FleetAsset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ error: 'El recurso seleccionado no existe.' }); }
    if (asset.status !== 'disponible') { await transaction.rollback(); return res.status(409).json({ error: 'Este recurso no está disponible para reservar.' }); }
    const openMaintenance = await M.FleetMaintenance.findOne({ where: { assetId, status: { [Op.ne]: 'completado' } }, transaction });
    if (openMaintenance) { await transaction.rollback(); return res.status(409).json({ error: 'Este recurso tiene un mantenimiento abierto.' }); }
    const conflict = await M.FleetBooking.findOne({ where: {
      assetId, date, status: { [Op.ne]: 'cancelada' },
      startTime: { [Op.lt]: endTime }, endTime: { [Op.gt]: startTime },
    }, transaction, lock: transaction.LOCK.UPDATE });
    if (conflict) { await transaction.rollback(); return res.status(409).json({ error: 'Ese recurso ya está reservado en ese horario.' }); }
    const booking = await M.FleetBooking.create({ assetId, memberId: memberId || null, date, startTime, endTime, purpose: purpose.trim(), notes }, { transaction });
    await transaction.commit();
    res.status(201).json(await M.FleetBooking.findByPk(booking.id, { include: [M.FleetAsset, M.Member] }));
  } catch (error) { if (transaction && !transaction.finished) await transaction.rollback(); next(error); }
});
api.put('/fleet-bookings/:id', allow('capitan'), async (req, res, next) => {
  try {
    const booking = await M.FleetBooking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
    if (!['reservada', 'realizada', 'cancelada'].includes(req.body?.status)) return res.status(400).json({ error: 'Estado de reserva no válido.' });
    await booking.update({ status: req.body.status });
    res.json(await M.FleetBooking.findByPk(booking.id, { include: [M.FleetAsset, M.Member] }));
  } catch (error) { next(error); }
});
api.delete('/fleet-bookings/:id', allow('capitan'), async (req, res, next) => {
  try {
    const booking = await M.FleetBooking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });
    await booking.destroy();
    res.status(204).end();
  } catch (error) { next(error); }
});

app.use('/api/ergdata', ergdata.publicRouter);
app.use('/api', api);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejo de errores
app.use((err, req, res, next) => {
  if (err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ error: err.message });
  }
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ error: 'Referencia inválida o registro en uso' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El cuerpo de la solicitud es demasiado grande' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
