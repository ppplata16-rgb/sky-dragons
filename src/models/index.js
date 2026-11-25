const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/database');

// ---------- Acceso ----------
const User = sequelize.define('User', {
  name: { type: T.STRING(120), allowNull: false },
  email: { type: T.STRING(160), allowNull: false, unique: true },
  passwordHash: { type: T.STRING(100), allowNull: false },
  role: { type: T.ENUM('admin', 'capitan', 'tesorero', 'lector'), defaultValue: 'lector' },
  memberId: { type: T.INTEGER, allowNull: true },
  isApproved: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
});

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  userId: { type: T.INTEGER, allowNull: false },
  tokenHash: { type: T.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: T.DATE, allowNull: false },
  usedAt: { type: T.DATE },
}, { indexes: [{ fields: ['userId', 'expiresAt'] }] });

// ---------- Integrantes ----------
const Member = sequelize.define('Member', {
  firstName: { type: T.STRING(80), allowNull: false },
  lastName: { type: T.STRING(80), allowNull: false },
  documentId: { type: T.STRING(40) },
  email: { type: T.STRING(160) },
  phone: { type: T.STRING(30) },
  birthDate: { type: T.DATEONLY },
  biography: { type: T.TEXT },
  palmares: { type: T.TEXT },
  rowingTeams: { type: T.TEXT },
  profilePhoto: { type: T.BLOB('medium') },
  profilePhotoType: { type: T.STRING(40) },
  weightKg: { type: T.DECIMAL(5, 2) },
  heightCm: { type: T.INTEGER },
  uniformSize: { type: T.STRING(10) },
  category: { type: T.STRING(30), allowNull: false, defaultValue: 'Open 1' },
  rowingSide: { type: T.ENUM('izquierdo', 'derecho', 'ambos'), defaultValue: 'ambos' },
  role: { type: T.ENUM('remero', 'timonel', 'tamborilero', 'suplente', 'staff'), defaultValue: 'remero' },
  status: { type: T.ENUM('activo', 'inactivo'), defaultValue: 'activo' },
  emergencyContactName: { type: T.STRING(120) },
  emergencyContactPhone: { type: T.STRING(30) },
  allergies: { type: T.TEXT },
  medicalNotes: { type: T.TEXT },
  medicalClearanceUntil: { type: T.DATEONLY },
  availableDays: { type: T.JSON },
  unavailableFrom: { type: T.DATEONLY },
  unavailableUntil: { type: T.DATEONLY },
  availabilityNotes: { type: T.STRING(255) },
  joinedAt: { type: T.DATEONLY },
});

// ---------- Entrenamientos y asistencia ----------
const Training = sequelize.define('Training', {
  date: { type: T.DATEONLY, allowNull: false },
  category: { type: T.STRING(30), allowNull: false, defaultValue: 'Open 1' },
  startTime: { type: T.STRING(5) },
  location: { type: T.STRING(160) },
  type: { type: T.ENUM('agua', 'gimnasio', 'fisico', 'otro'), defaultValue: 'agua' },
  notes: { type: T.TEXT },
  distanceM: { type: T.INTEGER },
  durationMinutes: { type: T.INTEGER },
  strokeRate: { type: T.INTEGER },
  waterConditions: { type: T.STRING(120) },
  safetyChecks: { type: T.JSON },
});

const Attendance = sequelize.define('Attendance', {
  memberId: { type: T.INTEGER, allowNull: false },
  trainingId: { type: T.INTEGER, allowNull: false },
  status: { type: T.ENUM('presente', 'ausente', 'justificado'), defaultValue: 'presente' },
  reason: { type: T.STRING(255) },
}, { indexes: [{ unique: true, fields: ['memberId', 'trainingId'] }] });

const ErgScore = sequelize.define('ErgScore', {
  memberId: { type: T.INTEGER, allowNull: false },
  date: { type: T.DATEONLY, allowNull: false },
  distanceM: { type: T.INTEGER, allowNull: false },
  durationSeconds: { type: T.DECIMAL(9, 1), allowNull: false },
  averageWatts: { type: T.DECIMAL(7, 2) },
  bodyWeightKg: { type: T.DECIMAL(5, 2) },
  contributionPercent: { type: T.DECIMAL(5, 2) },
  notes: { type: T.STRING(255) },
  source: { type: T.STRING(30), allowNull: false, defaultValue: 'manual' },
  externalId: { type: T.STRING(80) },
  deviceSource: { type: T.STRING(60) },
  workoutType: { type: T.STRING(60) },
  weightClass: { type: T.STRING(1) },
  averageStrokeRate: { type: T.INTEGER },
  averageHeartRate: { type: T.INTEGER },
  caloriesTotal: { type: T.INTEGER },
  dragFactor: { type: T.INTEGER },
  strokeCount: { type: T.INTEGER },
  comments: { type: T.TEXT },
}, { indexes: [{ unique: true, fields: ['memberId', 'source', 'externalId'] }] });

const PhysicalMetric = sequelize.define('PhysicalMetric', {
  memberId: { type: T.INTEGER, allowNull: false },
  date: { type: T.DATEONLY, allowNull: false },
  metricName: { type: T.STRING(100), allowNull: false },
  value: { type: T.DECIMAL(10, 2), allowNull: false },
  unit: { type: T.STRING(30), allowNull: false },
  notes: { type: T.TEXT },
}, { indexes: [{ fields: ['memberId', 'metricName', 'date'] }] });

const Concept2Connection = sequelize.define('Concept2Connection', {
  memberId: { type: T.INTEGER, allowNull: false, unique: true },
  logbookUserId: { type: T.STRING(80) },
  logbookUsername: { type: T.STRING(120) },
  accessTokenEncrypted: { type: T.TEXT, allowNull: false },
  refreshTokenEncrypted: { type: T.TEXT, allowNull: false },
  expiresAt: { type: T.DATE, allowNull: false },
  lastSyncedAt: { type: T.DATE },
  syncCursor: { type: T.TEXT },
});

// ---------- Competencias, carreras y alineaciones ----------
const Competition = sequelize.define('Competition', {
  name: { type: T.STRING(160), allowNull: false },
  venue: { type: T.STRING(160) },
  country: { type: T.STRING(80) },
  startDate: { type: T.DATEONLY },
  endDate: { type: T.DATEONLY },
  scope: { type: T.ENUM('local', 'nacional', 'internacional'), defaultValue: 'local' },
  notes: { type: T.TEXT },
});

const Race = sequelize.define('Race', {
  competitionId: { type: T.INTEGER, allowNull: false },
  category: { type: T.STRING(80) },
  distanceM: { type: T.INTEGER },
  timeSeconds: { type: T.DECIMAL(8, 3) },
  position: { type: T.INTEGER },
  notes: { type: T.TEXT },
  medalPhoto: { type: T.BLOB('medium') },
  medalPhotoType: { type: T.STRING(40) },
});

const Lineup = sequelize.define('Lineup', {
  raceId: { type: T.INTEGER, allowNull: true },
  name: { type: T.STRING(120) },
  boatType: { type: T.ENUM('DB12', 'DB22'), defaultValue: 'DB12' },
  category: { type: T.STRING(80), defaultValue: 'Open 1' },
});

const LineupSeat = sequelize.define('LineupSeat', {
  lineupId: { type: T.INTEGER, allowNull: false },
  memberId: { type: T.INTEGER, allowNull: false },
  rowNumber: { type: T.INTEGER },
  side: { type: T.ENUM('izquierda', 'derecha', 'centro'), defaultValue: 'centro' },
  seatRole: { type: T.ENUM('remero', 'timonel', 'tamborilero', 'suplente'), defaultValue: 'remero' },
});

// ---------- Finanzas ----------
const FeePlan = sequelize.define('FeePlan', {
  name: { type: T.STRING(120), allowNull: false },
  type: { type: T.ENUM('mensualidad', 'inscripcion', 'viaje', 'otro'), defaultValue: 'mensualidad' },
  amount: { type: T.DECIMAL(10, 2), allowNull: false },
  dueDate: { type: T.DATEONLY },
});

const Payment = sequelize.define('Payment', {
  memberId: { type: T.INTEGER, allowNull: false },
  feePlanId: { type: T.INTEGER, allowNull: false },
  amount: { type: T.DECIMAL(10, 2), allowNull: false },
  method: { type: T.ENUM('efectivo', 'yappy', 'transferencia', 'tarjeta', 'otro'), defaultValue: 'efectivo' },
  status: { type: T.ENUM('pendiente', 'pagado'), defaultValue: 'pagado' },
  paidAt: { type: T.DATEONLY },
  note: { type: T.STRING(255) },
  receiptUrl: { type: T.STRING(255) },
});

const Expense = sequelize.define('Expense', {
  concept: { type: T.STRING(200), allowNull: false },
  amount: { type: T.DECIMAL(10, 2), allowNull: false },
  category: { type: T.STRING(80) },
  spentAt: { type: T.DATEONLY },
  receiptUrl: { type: T.STRING(255) },
  competitionId: { type: T.INTEGER, allowNull: true },
});

// ---------- Patrocinadores ----------
const Sponsor = sequelize.define('Sponsor', {
  company: { type: T.STRING(160), allowNull: false },
  contactName: { type: T.STRING(120) },
  contactEmail: { type: T.STRING(160) },
  contactPhone: { type: T.STRING(30) },
  status: { type: T.ENUM('prospecto', 'negociando', 'activo', 'rechazado'), defaultValue: 'prospecto' },
  offered: { type: T.TEXT }, // qué se le ofreció: menciones, presencia en eventos, etc.
  nextFollowUp: { type: T.DATEONLY },
  notes: { type: T.TEXT },
});

const SponsorContribution = sequelize.define('SponsorContribution', {
  sponsorId: { type: T.INTEGER, allowNull: false },
  type: { type: T.ENUM('dinero', 'especie'), defaultValue: 'dinero' },
  amount: { type: T.DECIMAL(10, 2), defaultValue: 0 },
  description: { type: T.STRING(255) },
  receivedAt: { type: T.DATEONLY },
});

// ---------- Inventario ----------
const InventoryItem = sequelize.define('InventoryItem', {
  name: { type: T.STRING(120), allowNull: false },
  category: { type: T.STRING(80) },
  size: { type: T.STRING(20) },
  totalQty: { type: T.INTEGER, defaultValue: 0 },
  notes: { type: T.TEXT },
});

const InventoryAssignment = sequelize.define('InventoryAssignment', {
  itemId: { type: T.INTEGER, allowNull: false },
  memberId: { type: T.INTEGER, allowNull: false },
  qty: { type: T.INTEGER, defaultValue: 1 },
  assignedAt: { type: T.DATEONLY },
  returnedAt: { type: T.DATEONLY },
});

// ---------- Flota, uso y mantenimiento ----------
const FleetAsset = sequelize.define('FleetAsset', {
  name: { type: T.STRING(120), allowNull: false },
  code: { type: T.STRING(40), allowNull: false, unique: true },
  type: { type: T.ENUM('bote', 'ergometro', 'otro'), defaultValue: 'bote' },
  status: { type: T.ENUM('disponible', 'mantenimiento', 'fuera_servicio'), defaultValue: 'disponible' },
  notes: { type: T.TEXT },
});

const FleetBooking = sequelize.define('FleetBooking', {
  assetId: { type: T.INTEGER, allowNull: false },
  memberId: { type: T.INTEGER, allowNull: true },
  date: { type: T.DATEONLY, allowNull: false },
  startTime: { type: T.STRING(5), allowNull: false },
  endTime: { type: T.STRING(5), allowNull: false },
  purpose: { type: T.STRING(160), allowNull: false },
  status: { type: T.ENUM('reservada', 'realizada', 'cancelada'), defaultValue: 'reservada' },
  notes: { type: T.TEXT },
});

const FleetMaintenance = sequelize.define('FleetMaintenance', {
  assetId: { type: T.INTEGER, allowNull: false },
  description: { type: T.STRING(255), allowNull: false },
  reportedAt: { type: T.DATEONLY, allowNull: false },
  nextDue: { type: T.DATEONLY },
  status: { type: T.ENUM('pendiente', 'en_proceso', 'completado'), defaultValue: 'pendiente' },
  notes: { type: T.TEXT },
});

// ---------- Relaciones ----------
const rel = (parent, child, fk, as) => {
  parent.hasMany(child, { foreignKey: fk, ...(as ? { as } : {}) });
  child.belongsTo(parent, { foreignKey: fk });
};

User.belongsTo(Member, { foreignKey: 'memberId' });
rel(Member, Attendance, 'memberId');
rel(Training, Attendance, 'trainingId', 'attendances');
rel(Member, ErgScore, 'memberId', 'ergScores');
rel(Member, PhysicalMetric, 'memberId', 'physicalMetrics');
rel(Member, Concept2Connection, 'memberId', 'concept2Connection');
rel(Competition, Race, 'competitionId', 'races');
rel(Race, Lineup, 'raceId', 'lineups');
rel(Lineup, LineupSeat, 'lineupId', 'seats');
rel(Member, LineupSeat, 'memberId');
rel(Member, Payment, 'memberId');
rel(FeePlan, Payment, 'feePlanId');
rel(Competition, Expense, 'competitionId');
rel(Sponsor, SponsorContribution, 'sponsorId', 'contributions');
rel(InventoryItem, InventoryAssignment, 'itemId', 'assignments');
rel(Member, InventoryAssignment, 'memberId');
rel(FleetAsset, FleetBooking, 'assetId', 'bookings');
rel(Member, FleetBooking, 'memberId');
rel(FleetAsset, FleetMaintenance, 'assetId', 'maintenanceRecords');

module.exports = {
  sequelize, User, Member, Training, Attendance, Competition, Race, Lineup,
  LineupSeat, ErgScore, PhysicalMetric, Concept2Connection, FeePlan, Payment, Expense, Sponsor, SponsorContribution,
  InventoryItem, InventoryAssignment, FleetAsset, FleetBooking, FleetMaintenance,
  PasswordResetToken,
};
