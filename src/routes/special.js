const express = require('express');
const { fn, literal, Op } = require('sequelize');
const {
  Member, Training, Attendance, Competition, Race, Lineup, LineupSeat,
  Payment, FeePlan, Expense, SponsorContribution,
} = require('../models');
const { allow } = require('../middleware/auth');

const router = express.Router();

// Save a complete, validated practice or race lineup atomically.
router.post('/lineups', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await Lineup.sequelize.transaction();
    const { name, category, boatType, rowerCount, seats, raceId } = req.body || {};
    const rows = Number(rowerCount);
    const expected = boatType === 'DB12' ? 10 : boatType === 'DB22' && rows >= 18 && rows <= 20 ? rows : 0;
    const activeSeats = Array.isArray(seats) ? seats.filter((seat) => seat.seatRole !== 'suplente') : [];
    const reserves = Array.isArray(seats) ? seats.filter((seat) => seat.seatRole === 'suplente') : [];
    const reserveLimit = boatType === 'DB12' ? 2 : 4;
    if (!expected || activeSeats.length !== expected + 2 || reserves.length > reserveLimit) {
      await transaction.rollback();
      return res.status(400).json({ error: 'La tripulación no coincide con el formato de bote.' });
    }
    const assigned = seats.filter((seat) => seat.memberId).map((seat) => Number(seat.memberId));
    if (new Set(assigned).size !== assigned.length) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cada atleta solo puede ocupar un puesto.' });
    }
    if (raceId) {
      const linkedRace = await Race.findByPk(raceId, { transaction });
      if (!linkedRace) {
        await transaction.rollback();
        return res.status(404).json({ error: 'La carrera seleccionada no existe.' });
      }
      if (linkedRace.category && linkedRace.category !== category) {
        await transaction.rollback();
        return res.status(409).json({ error: `La categoría de la alineación debe coincidir con la del resultado (${linkedRace.category}).` });
      }
    }
    const countByRole = (role) => activeSeats.filter((seat) => seat.seatRole === role).length;
    if (countByRole('remero') !== expected || countByRole('timonel') !== 1 || countByRole('tamborilero') !== 1 || assigned.length !== seats.length) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Asigna remeros, timonel y tamborilero antes de guardar.' });
    }
    if (reserves.length) {
      const reserveMembers = await Member.findAll({ where: { id: reserves.map((seat) => seat.memberId) }, attributes: ['id', 'role'], transaction });
      if (reserveMembers.length !== reserves.length || reserveMembers.some((member) => !['remero', 'suplente'].includes(member.role))) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Los suplentes deben ser integrantes registrados como remeros o suplentes.' });
      }
    }
    const lineup = await Lineup.create({ name, category, boatType, raceId: raceId || null }, { transaction });
    await LineupSeat.bulkCreate(seats.map((seat) => ({ ...seat, lineupId: lineup.id })), { transaction });
    await transaction.commit();
    res.status(201).json(await Lineup.findByPk(lineup.id, { include: [{ model: LineupSeat, as: 'seats' }] }));
  } catch (e) {
    await transaction.rollback();
    next(e);
  }
});

router.post('/competitions/with-result', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await Competition.sequelize.transaction();
    const { competition, race } = req.body || {};
    if (!competition?.name?.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Escribe el nombre de la competencia.' });
    }
    const hasRaceData = race && [race.distanceM, race.timeSeconds, race.position].some((value) => value !== '' && value !== null && value !== undefined);
    if (hasRaceData && (!Number(race.distanceM) || !Number(race.timeSeconds) || !Number(race.position))) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Para registrar el resultado indica distancia, tiempo y puesto.' });
    }
    const created = await Competition.create(competition, { transaction });
    if (hasRaceData) await Race.create({ ...race, competitionId: created.id }, { transaction });
    await transaction.commit();
    res.status(201).json(await Competition.findByPk(created.id, { include: [{ model: Race, as: 'races' }] }));
  } catch (e) {
    if (transaction) await transaction.rollback();
    next(e);
  }
});

router.delete('/trainings/:id', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await Training.sequelize.transaction();
    const training = await Training.findByPk(req.params.id, { transaction });
    if (!training) { await transaction.rollback(); return res.status(404).json({ error: 'Entrenamiento no encontrado.' }); }
    await Attendance.destroy({ where: { trainingId: training.id }, transaction });
    await training.destroy({ transaction });
    await transaction.commit();
    res.status(204).end();
  } catch (e) { if (transaction) await transaction.rollback(); next(e); }
});

router.delete('/lineups/:id', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await Lineup.sequelize.transaction();
    const lineup = await Lineup.findByPk(req.params.id, { transaction });
    if (!lineup) { await transaction.rollback(); return res.status(404).json({ error: 'Alineacion no encontrada.' }); }
    await LineupSeat.destroy({ where: { lineupId: lineup.id }, transaction });
    await lineup.destroy({ transaction });
    await transaction.commit();
    res.status(204).end();
  } catch (e) { if (transaction) await transaction.rollback(); next(e); }
});

router.delete('/races/:id', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await Race.sequelize.transaction();
    const race = await Race.findByPk(req.params.id, { transaction });
    if (!race) { await transaction.rollback(); return res.status(404).json({ error: 'Carrera no encontrada.' }); }
    const lineups = await Lineup.findAll({ where: { raceId: race.id }, attributes: ['id'], transaction });
    const lineupIds = lineups.map((lineup) => lineup.id);
    if (lineupIds.length) {
      await LineupSeat.destroy({ where: { lineupId: lineupIds }, transaction });
      await Lineup.destroy({ where: { id: lineupIds }, transaction });
    }
    await race.destroy({ transaction });
    await transaction.commit();
    res.status(204).end();
  } catch (e) { if (transaction) await transaction.rollback(); next(e); }
});

router.delete('/competitions/:id', allow('capitan'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await Competition.sequelize.transaction();
    const competition = await Competition.findByPk(req.params.id, { transaction });
    if (!competition) { await transaction.rollback(); return res.status(404).json({ error: 'Competencia no encontrada.' }); }
    if (await Expense.count({ where: { competitionId: competition.id }, transaction })) {
      await transaction.rollback();
      return res.status(409).json({ error: 'No se puede borrar: la competencia tiene gastos asociados.' });
    }
    const races = await Race.findAll({ where: { competitionId: competition.id }, attributes: ['id'], transaction });
    const raceIds = races.map((race) => race.id);
    const lineups = raceIds.length ? await Lineup.findAll({ where: { raceId: raceIds }, attributes: ['id'], transaction }) : [];
    const lineupIds = lineups.map((lineup) => lineup.id);
    if (lineupIds.length) {
      await LineupSeat.destroy({ where: { lineupId: lineupIds }, transaction });
      await Lineup.destroy({ where: { id: lineupIds }, transaction });
    }
    if (raceIds.length) await Race.destroy({ where: { id: raceIds }, transaction });
    await competition.destroy({ transaction });
    await transaction.commit();
    res.status(204).end();
  } catch (e) { if (transaction) await transaction.rollback(); next(e); }
});

// --- Pasar lista de un entrenamiento en bloque ---
// POST /api/trainings/:id/attendance   body: [{ memberId, status, reason }]
router.post('/trainings/:id/attendance', allow('capitan'), async (req, res, next) => {
  try {
    const training = await Training.findByPk(req.params.id);
    if (!training) return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Se espera un arreglo' });
    const rows = req.body.map((r) => ({
      memberId: r.memberId, trainingId: training.id,
      status: r.status || 'presente', reason: r.reason || null,
    }));
    await Attendance.bulkCreate(rows, { updateOnDuplicate: ['status', 'reason', 'updatedAt'] });
    res.json({ saved: rows.length });
  } catch (e) { next(e); }
});

// --- Resumen deportivo para el centro del equipo ---
router.get('/reports/dashboard', async (req, res, next) => {
  try {
    const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
    const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const [activeMembers, totalTrainings, completedTrainings, nextTraining, latestRace, upcomingCompetition, totalRaces] = await Promise.all([
      Member.count({ where: { status: 'activo' } }),
      Training.count(),
      Training.count({ where: { date: { [Op.lt]: today } } }),
      Training.findOne({ where: { date: { [Op.gte]: today } }, order: [['date', 'ASC'], ['startTime', 'ASC']] }),
      Race.findOne({ attributes: { exclude: ['medalPhoto'] }, include: [{ model: Competition }], order: [['id', 'DESC']] }),
      Competition.findOne({ where: { startDate: { [Op.gte]: today } }, order: [['startDate', 'ASC']] }),
      Race.count(),
    ]);
    res.json({ activeMembers, totalTrainings, completedTrainings, nextTraining, latestRace, upcomingCompetition, totalRaces });
  } catch (e) { next(e); }
});

router.get('/reports/member-sport/:memberId', async (req, res, next) => {
  try {
    const member = await Member.findByPk(req.params.memberId, { attributes: ['id', 'firstName', 'lastName'] });
    if (!member) return res.status(404).json({ error: 'Integrante no encontrado.' });
    const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
    const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const [attendances, seats] = await Promise.all([
      Attendance.findAll({
        where: { memberId: member.id },
        include: [{ model: Training, required: true, attributes: ['id', 'date', 'type', 'location', 'distanceM', 'durationMinutes'], where: { date: { [Op.lt]: today } } }],
        order: [['id', 'DESC']],
      }),
      LineupSeat.findAll({
        where: { memberId: member.id },
        include: [{ model: Lineup, include: [{ model: Race, include: [Competition] }] }],
        order: [['id', 'DESC']],
      }),
    ]);
    const attendanceCounts = {
      presente: attendances.filter((item) => item.status === 'presente').length,
      ausente: attendances.filter((item) => item.status === 'ausente').length,
      justificado: attendances.filter((item) => item.status === 'justificado').length,
    };
    const countedSessions = attendanceCounts.presente + attendanceCounts.ausente;
    res.json({
      totalTrainings: attendances.length,
      trackedTrainings: attendances.length,
      countedTrainings: countedSessions,
      attendedTrainings: attendanceCounts.presente,
      absentTrainings: attendanceCounts.ausente,
      justifiedTrainings: attendanceCounts.justificado,
      attendancePercent: countedSessions ? Math.round((attendanceCounts.presente / countedSessions) * 100) : null,
      trainingHistory: attendances.slice(0, 8).map((attendance) => ({
        trainingId: attendance.trainingId,
        date: attendance.Training?.date || null,
        type: attendance.Training?.type || null,
        location: attendance.Training?.location || null,
        distanceM: attendance.Training?.distanceM || null,
        durationMinutes: attendance.Training?.durationMinutes || null,
        status: attendance.status,
        reason: attendance.reason || null,
      })),
      raceHistory: seats.map((seat) => {
        const race = seat.Lineup?.Race;
        return {
          lineupName: seat.Lineup?.name,
          seatRole: seat.seatRole,
          competition: race?.Competition?.name || null,
          date: race?.Competition?.startDate || null,
          category: race?.category || seat.Lineup?.category,
          distanceM: race?.distanceM || null,
          timeSeconds: race?.timeSeconds || null,
          position: race?.position || null,
        };
      }),
    });
  } catch (e) { next(e); }
});

// --- Balance de peso del bote ---
// GET /api/lineups/:id/balance
router.get('/lineups/:id/balance', async (req, res, next) => {
  try {
    const seats = await LineupSeat.findAll({
      where: { lineupId: req.params.id },
      include: [{ model: Member, attributes: ['id', 'firstName', 'lastName', 'weightKg'] }],
    });
    if (!seats.length) return res.status(404).json({ error: 'Alineación vacía o inexistente' });
    const total = { izquierda: 0, derecha: 0, centro: 0 };
    const sinPeso = [];
    for (const s of seats) {
      const w = parseFloat(s.Member && s.Member.weightKg);
      if (Number.isNaN(w)) { sinPeso.push(s.memberId); continue; }
      total[s.side] += w;
    }
    res.json({
      pesoKg: total,
      diferenciaIzqDerKg: Math.abs(total.izquierda - total.derecha),
      integrantesSinPeso: sinPeso,
    });
  } catch (e) { next(e); }
});

// --- Reporte de asistencia por integrante ---
// GET /api/reports/attendance?from=2026-01-01&to=2026-12-31
router.get('/reports/attendance', async (req, res, next) => {
  try {
    const tWhere = {};
    if (req.query.from || req.query.to) {
      tWhere.date = {};
      if (req.query.from) tWhere.date[Op.gte] = req.query.from;
      if (req.query.to) tWhere.date[Op.lte] = req.query.to;
    }
    const trainings = await Training.findAll({ where: tWhere, attributes: ['id'], raw: true });
    const ids = trainings.map((t) => t.id);
    const total = ids.length;
    const stats = ids.length ? await Attendance.findAll({
      where: { trainingId: ids },
      attributes: [
        'memberId',
        [fn('SUM', literal("status = 'presente'")), 'presentes'],
        [fn('SUM', literal("status = 'justificado'")), 'justificados'],
      ],
      group: ['memberId'], raw: true,
    }) : [];
    const byMember = Object.fromEntries(stats.map((s) => [s.memberId, s]));
    const members = await Member.findAll({ where: { status: 'activo' } });
    res.json({
      entrenamientos: total,
      integrantes: members.map((m) => {
        const s = byMember[m.id] || { presentes: 0, justificados: 0 };
        const presentes = Number(s.presentes);
        return {
          memberId: m.id, nombre: `${m.firstName} ${m.lastName}`,
          presentes, justificados: Number(s.justificados),
          porcentaje: total ? Math.round((presentes / total) * 100) : null,
        };
      }),
    });
  } catch (e) { next(e); }
});

// --- Resumen financiero ---
// GET /api/reports/finance
router.get('/reports/finance', allow('tesorero'), async (req, res, next) => {
  try {
    const [cobrado, pendiente, gastos, aportes] = await Promise.all([
      Payment.sum('amount', { where: { status: 'pagado' } }),
      Payment.sum('amount', { where: { status: 'pendiente' } }),
      Expense.sum('amount'),
      SponsorContribution.sum('amount', { where: { type: 'dinero' } }),
    ]);
    const ingresos = (cobrado || 0) + (aportes || 0);
    res.json({
      cuotasCobradas: cobrado || 0,
      cuotasPendientes: pendiente || 0,
      aportesPatrocinadores: aportes || 0,
      gastos: gastos || 0,
      balance: ingresos - (gastos || 0),
    });
  } catch (e) { next(e); }
});

// --- Estado de cuenta de un integrante ---
// GET /api/reports/member-account/:memberId
router.get('/reports/member-account/:memberId', allow('tesorero'), async (req, res, next) => {
  try {
    const payments = await Payment.findAll({
      where: { memberId: req.params.memberId }, include: [FeePlan], order: [['id', 'DESC']],
    });
    const sum = (st) => payments.filter((p) => p.status === st)
      .reduce((a, p) => a + parseFloat(p.amount), 0);
    res.json({ pagado: sum('pagado'), pendiente: sum('pendiente'), pagos: payments });
  } catch (e) { next(e); }
});

// --- Historial deportivo (útil para el dossier de patrocinio) ---
// GET /api/reports/history
router.get('/reports/history', async (req, res, next) => {
  try {
    const comps = await Competition.findAll({
      include: [{ model: Race, as: 'races', attributes: { exclude: ['medalPhoto'] } }],
      order: [['startDate', 'DESC']],
    });
    res.json(comps);
  } catch (e) { next(e); }
});

module.exports = router;
