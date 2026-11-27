const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { Op } = require('sequelize');
const { User, PasswordResetToken, sequelize } = require('../models');
const { authenticate, allow } = require('../middleware/auth');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(72),
  role: z.enum(['admin', 'capitan', 'tesorero', 'lector']).default('lector'),
  memberId: z.coerce.number().int().positive().nullable().optional(),
  teamCategory: z.enum(['Open 1', 'Open 2', 'Master', 'Femenino', 'Mixta', 'Rookie']).nullable().optional(),
});

const resetRequestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(160) });
const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  password: z.string().min(12).max(72),
});
const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(12).max(72),
});

const genericResetMessage = 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.';
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

async function sendPasswordResetEmail(user, token) {
  const resetUrl = new URL('/', process.env.FRONTEND_URL || 'http://localhost:5173');
  resetUrl.searchParams.set('resetToken', token);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [user.email],
      subject: 'Restablece tu contraseña de Sky Dragons',
      text: `Hola ${user.name},\n\nRecibimos una solicitud para restablecer tu contraseña. Abre este enlace antes de 30 minutos:\n${resetUrl}\n\nSi no lo solicitaste, ignora este correo.`,
      html: `<p>Hola ${escapeHtml(user.name)},</p><p>Recibimos una solicitud para restablecer tu contraseña de Sky Dragons.</p><p><a href="${escapeHtml(resetUrl)}">Crear una contraseña nueva</a></p><p>El enlace vence en 30 minutos y solo puede usarse una vez. Si no lo solicitaste, ignora este correo.</p>`,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Resend HTTP ${response.status}: ${body.message || body.name || 'no se pudo enviar el correo'}`);
  }
}

router.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = resetRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Escribe un correo válido.' });
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      return res.status(503).json({ error: 'El restablecimiento por correo aún no está configurado. Contacta al administrador.' });
    }
    const user = await User.findOne({ where: { email: parsed.data.email } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      await PasswordResetToken.destroy({ where: { userId: user.id, usedAt: null } });
      const resetToken = await PasswordResetToken.create({
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      try {
        await sendPasswordResetEmail(user, rawToken);
      } catch (mailError) {
        await resetToken.destroy();
        console.error(`No se pudo enviar correo de restablecimiento: ${mailError.message}`);
      }
    }
    res.json({ message: genericResetMessage });
  } catch (error) { next(error); }
});

router.post('/reset-password', async (req, res, next) => {
  let transaction;
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Usa un enlace válido y una contraseña de al menos 12 caracteres.' });
    transaction = await sequelize.transaction();
    const record = await PasswordResetToken.findOne({
      where: { tokenHash: hashResetToken(parsed.data.token), usedAt: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record || record.expiresAt <= new Date()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'El enlace venció o ya fue utilizado. Solicita uno nuevo.' });
    }
    const user = await User.findByPk(record.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) {
      await transaction.rollback();
      return res.status(400).json({ error: 'El enlace venció o ya fue utilizado. Solicita uno nuevo.' });
    }
    user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await user.save({ transaction });
    record.usedAt = new Date();
    await record.save({ transaction });
    await PasswordResetToken.destroy({ where: { userId: user.id, id: { [Op.ne]: record.id } }, transaction });
    await transaction.commit();
    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Email o contraseña inválidos' });
    const { email, password } = parsed.data;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (!user.isApproved) return res.status(403).json({ error: 'Tu registro fue recibido y está pendiente de aprobación por el administrador.' });
    const payload = { id: user.id, name: user.name, role: user.role, memberId: user.memberId, teamCategory: user.teamCategory };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: payload });
  } catch (e) { next(e); }
});

router.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Escribe tu nombre, un correo válido y una contraseña de al menos 12 caracteres.' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({ ...parsed.data, passwordHash, role: 'lector', memberId: null, isApproved: false });
    res.status(201).json({ message: 'Registro recibido. Un administrador debe aprobar tu acceso antes de que puedas iniciar sesión.', email: user.email });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    next(error);
  }
});

// Solo el admin crea usuarios
router.post('/register', authenticate, allow(), async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, email, password, role, memberId, teamCategory } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role, memberId, teamCategory: role === 'capitan' ? teamCategory || null : null });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, teamCategory: user.teamCategory });
  } catch (e) { next(e); }
});

router.get('/users', authenticate, allow(), async (req, res, next) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role', 'teamCategory', 'isApproved'], order: [['isApproved', 'ASC'], ['id', 'ASC']] });
    res.json(users);
  } catch (e) { next(e); }
});

router.put('/users/:id/role', authenticate, allow(), async (req, res, next) => {
  try {
    const role = req.body?.role;
    if (!['admin', 'capitan', 'tesorero', 'lector'].includes(role)) {
      return res.status(400).json({ error: 'Elige un rol válido para el usuario.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount <= 1) return res.status(400).json({ error: 'No se puede cambiar el rol del último administrador.' });
    }
    const teamCategory = role === 'capitan' ? (req.body?.teamCategory || user.teamCategory || null) : null;
    if (teamCategory && !['Open 1', 'Open 2', 'Master', 'Femenino', 'Mixta', 'Rookie'].includes(teamCategory)) {
      return res.status(400).json({ error: 'Elige un roster válido para el capitán.' });
    }
    await user.update({ role, teamCategory });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, teamCategory: user.teamCategory, isApproved: user.isApproved });
  } catch (error) { next(error); }
});

router.put('/users/:id/team', authenticate, allow(), async (req, res, next) => {
  try {
    const { teamCategory } = req.body || {};
    if (!['Open 1', 'Open 2', 'Master', 'Femenino', 'Mixta', 'Rookie'].includes(teamCategory)) {
      return res.status(400).json({ error: 'Elige un roster válido.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role !== 'capitan') return res.status(400).json({ error: 'Asigna un roster solo a usuarios con rol de capitán.' });
    await user.update({ teamCategory });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, teamCategory: user.teamCategory, isApproved: user.isApproved });
  } catch (error) { next(error); }
});

router.put('/users/:id/approval', authenticate, allow(), async (req, res, next) => {
  try {
    if (typeof req.body?.isApproved !== 'boolean') return res.status(400).json({ error: 'Indica si se aprueba o rechaza la cuenta.' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.role === 'admin' && !req.body.isApproved) return res.status(400).json({ error: 'No se puede suspender a un administrador desde esta acción.' });
    await user.update({ isApproved: req.body.isApproved });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, teamCategory: user.teamCategory, isApproved: user.isApproved });
  } catch (error) { next(error); }
});

router.delete('/users/:id', authenticate, allow(), async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes borrar tu propia cuenta.' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    await user.destroy();
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/me', authenticate, (req, res) => res.json(req.user));

module.exports = router;
