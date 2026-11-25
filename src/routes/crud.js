const express = require('express');
const { allow } = require('../middleware/auth');

// Genera un CRUD completo para un modelo.
// opts.read  -> roles que pueden leer (omitir = cualquier usuario autenticado)
// opts.write -> roles que pueden crear/editar/borrar (admin siempre puede)
// opts.include -> relaciones a incluir en las consultas
function crud(Model, opts = {}) {
  const router = express.Router();
  const readGuard = opts.read ? [allow(...opts.read)] : [];
  const writeGuard = allow(...(opts.write || []));
  const excluded = opts.exclude || [];
  const fields = Object.keys(Model.rawAttributes).filter(
    (k) => !['id', 'createdAt', 'updatedAt', ...excluded].includes(k)
  );
  const attributes = excluded.length ? { exclude: excluded } : undefined;

  router.get('/', ...readGuard, async (req, res, next) => {
    try {
      const where = {};
      for (const k of fields) if (req.query[k] !== undefined) where[k] = req.query[k];

      const limitRaw = Number.parseInt(req.query.limit, 10);
      const offsetRaw = Number.parseInt(req.query.offset, 10);
      const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
      const offset = Number.isInteger(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const { rows, count } = await Model.findAndCountAll({
        where, limit, offset, order: [['id', 'DESC']], include: opts.include, attributes,
      });
      res.json({ total: count, limit, offset, data: rows });
    } catch (e) { next(e); }
  });

  router.get('/:id', ...readGuard, async (req, res, next) => {
    try {
      const row = await Model.findByPk(req.params.id, { include: opts.include, attributes });
      if (!row) return res.status(404).json({ error: 'No encontrado' });
      res.json(row);
    } catch (e) { next(e); }
  });

  router.post('/', writeGuard, async (req, res, next) => {
    try { res.status(201).json(await Model.create(req.body, { fields })); }
    catch (e) { next(e); }
  });

  router.put('/:id', writeGuard, async (req, res, next) => {
    try {
      const row = await Model.findByPk(req.params.id, { attributes });
      if (!row) return res.status(404).json({ error: 'No encontrado' });
      await row.update(req.body, { fields });
      res.json(row);
    } catch (e) { next(e); }
  });

  router.delete('/:id', writeGuard, async (req, res, next) => {
    try {
      const row = await Model.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: 'No encontrado' });
      await row.destroy();
      res.status(204).end();
    } catch (e) { next(e); }
  });

  return router;
}

module.exports = crud;
