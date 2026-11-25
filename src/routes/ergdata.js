const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { authenticate, allow } = require('../middleware/auth');
const { Member, ErgScore, Concept2Connection } = require('../models');

const publicRouter = express.Router();
const protectedRouter = express.Router();
const scopes = 'user:read,results:read';
const apiRoot = 'https://log.concept2.com';
const optionalNumber = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Math.round(Number(value));

function envConfig() {
  const missing = ['CONCEPT2_CLIENT_ID', 'CONCEPT2_CLIENT_SECRET', 'CONCEPT2_REDIRECT_URI', 'CONCEPT2_TOKEN_KEY'].filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Falta configurar: ${missing.join(', ')}`);
  const key = Buffer.from(process.env.CONCEPT2_TOKEN_KEY, 'base64');
  if (key.length !== 32) throw new Error('CONCEPT2_TOKEN_KEY debe ser una clave Base64 de 32 bytes.');
  return { key, clientId: process.env.CONCEPT2_CLIENT_ID, clientSecret: process.env.CONCEPT2_CLIENT_SECRET, redirectUri: process.env.CONCEPT2_REDIRECT_URI };
}

function encrypt(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
}

function decrypt(value, key) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function tokenRequest(params, config) {
  const response = await fetch(`${apiRoot}/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, scope: scopes, ...params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.message || body.error || 'Concept2 no pudo completar la autorizaciÃ³n.');
  return body;
}

async function c2Request(url, accessToken) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.c2logbook.v1+json' },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error_description || body.error || `Concept2 respondiÃ³ HTTP ${response.status}.`);
  return body;
}

publicRouter.get('/callback', async (req, res) => {
  let frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const config = envConfig();
    if (req.query.error) throw new Error('Se cancelÃ³ la autorizaciÃ³n de Concept2.');
    if (!req.query.code || !req.query.state) throw new Error('Respuesta OAuth incompleta.');
    const state = jwt.verify(req.query.state, process.env.JWT_SECRET, { audience: 'concept2-oauth', issuer: 'sky-dragons' });
    const member = await Member.findByPk(state.memberId);
    if (!member) throw new Error('El integrante asociado ya no existe.');
    const token = await tokenRequest({ grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: config.redirectUri }, config);
    const profile = await c2Request(`${apiRoot}/api/users/me`, token.access_token);
    const user = profile.data || profile;
    await Concept2Connection.upsert({
      memberId: member.id, logbookUserId: String(user.id || ''), logbookUsername: user.username || null,
      accessTokenEncrypted: encrypt(token.access_token, config.key), refreshTokenEncrypted: encrypt(token.refresh_token, config.key),
      expiresAt: new Date(Date.now() + Number(token.expires_in || 0) * 1000),
    });
    const url = new URL(frontend);
    url.searchParams.set('ergdata', 'connected'); url.searchParams.set('memberId', String(member.id));
    res.redirect(url.toString());
  } catch (error) {
    const url = new URL(frontend);
    url.searchParams.set('ergdata', 'error'); url.searchParams.set('message', error.message);
    res.redirect(url.toString());
  }
});

protectedRouter.use(authenticate, allow('capitan'));
protectedRouter.post('/connect/:memberId', async (req, res, next) => {
  try {
    const config = envConfig();
    const member = await Member.findByPk(req.params.memberId, { attributes: ['id'] });
    if (!member) return res.status(404).json({ error: 'Integrante no encontrado.' });
    const state = jwt.sign({ memberId: member.id, actorId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '10m', audience: 'concept2-oauth', issuer: 'sky-dragons' });
    const authorize = new URL(`${apiRoot}/oauth/authorize`);
    authorize.search = new URLSearchParams({ client_id: config.clientId, scope: scopes, response_type: 'code', redirect_uri: config.redirectUri, state }).toString();
    res.json({ authorizationUrl: authorize.toString() });
  } catch (error) { next(error); }
});

protectedRouter.get('/status/:memberId', async (req, res, next) => {
  try {
    const connection = await Concept2Connection.findOne({ where: { memberId: req.params.memberId }, attributes: ['logbookUsername', 'lastSyncedAt', 'expiresAt'] });
    res.json({ connected: Boolean(connection), username: connection?.logbookUsername || null, lastSyncedAt: connection?.lastSyncedAt || null, expiresAt: connection?.expiresAt || null });
  } catch (error) { next(error); }
});

protectedRouter.delete('/connection/:memberId', async (req, res, next) => {
  try { await Concept2Connection.destroy({ where: { memberId: req.params.memberId } }); res.status(204).end(); }
  catch (error) { next(error); }
});

protectedRouter.post('/sync/:memberId', async (req, res, next) => {
  try {
    const config = envConfig();
    const connection = await Concept2Connection.findOne({ where: { memberId: req.params.memberId } });
    if (!connection) return res.status(404).json({ error: 'Este integrante aÃºn no conectÃ³ su Concept2 Logbook.' });
    let accessToken = decrypt(connection.accessTokenEncrypted, config.key);
    if (new Date(connection.expiresAt).getTime() < Date.now() + 60_000) {
      const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(connection.refreshTokenEncrypted, config.key) }, config);
      accessToken = refreshed.access_token;
      const refreshedRefreshToken = refreshed.refresh_token || decrypt(connection.refreshTokenEncrypted, config.key);
      connection.accessTokenEncrypted = encrypt(refreshed.access_token, config.key);
      connection.refreshTokenEncrypted = encrypt(refreshedRefreshToken, config.key);
      connection.expiresAt = new Date(Date.now() + Number(refreshed.expires_in || 0) * 1000);
      await connection.save();
    }
    const since = !connection.syncCursor && connection.lastSyncedAt ? new Date(new Date(connection.lastSyncedAt).getTime() - 86_400_000).toISOString().replace('T', ' ').slice(0, 19) : null;
    let next = connection.syncCursor ? new URL(connection.syncCursor) : new URL(`${apiRoot}/api/users/me/results`);
    if (!connection.syncCursor) { next.searchParams.set('type', 'rower'); next.searchParams.set('number', '250'); if (since) next.searchParams.set('updated_after', since); }
    let imported = 0; let updated = 0; let scanned = 0; let pages = 0;
    while (next && pages < 100) {
      const url = new URL(next);
      if (url.hostname !== 'log.concept2.com') throw new Error('Respuesta de paginaciÃ³n invÃ¡lida de Concept2.');
      url.protocol = 'https:';
      const response = await c2Request(url.toString(), accessToken);
      for (const result of (Array.isArray(response.data) ? response.data : [])) {
        scanned += 1;
        const distanceM = Number(result.distance);
        const timeTenths = Number(result.time);
        if (result.type !== 'rower' || !result.id || !result.date || !Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(timeTenths) || timeTenths <= 0) continue;
        const date = String(result.date).slice(0, 10);
        const durationSeconds = Number((timeTenths / 10).toFixed(1));
        const pacePer500 = durationSeconds / distanceM * 500;
        const averageWatts = pacePer500 > 0 ? Number((2.8 / ((pacePer500 / 500) ** 3)).toFixed(2)) : null;
        const averageHeartRate = optionalNumber(result.heart_rate?.average);
        const existing = await ErgScore.findOne({ where: { memberId: connection.memberId, source: 'concept2', externalId: String(result.id) }, attributes: ['id'] });
        await ErgScore.upsert({
          memberId: connection.memberId,
          date,
          distanceM: Math.round(distanceM),
          durationSeconds,
          averageWatts,
          source: 'concept2',
          externalId: String(result.id),
          deviceSource: result.source || null,
          workoutType: result.workout_type || null,
          weightClass: ['H', 'L'].includes(result.weight_class) ? result.weight_class : null,
          averageStrokeRate: optionalNumber(result.stroke_rate),
          averageHeartRate,
          caloriesTotal: optionalNumber(result.calories_total),
          dragFactor: optionalNumber(result.drag_factor),
          strokeCount: optionalNumber(result.stroke_count),
          comments: result.comments || null,
          notes: result.workout_type && result.workout_type !== 'unknown' ? 'Concept2 - ' + result.workout_type : 'Importado desde Concept2 Logbook',
        });
        if (!existing) imported += 1;
        else updated += 1;
      }
      const link = response.meta?.pagination?.links?.next;
      next = link ? new URL(link, apiRoot) : null;
      connection.syncCursor = next ? next.toString() : null;
      if (!next) connection.lastSyncedAt = new Date();
      await connection.save();
      pages += 1;
    }
    res.json({ imported, updated, scanned, lastSyncedAt: connection.lastSyncedAt, moreAvailable: Boolean(connection.syncCursor) });
  } catch (error) { next(error); }
});

module.exports = { publicRouter, protectedRouter };
