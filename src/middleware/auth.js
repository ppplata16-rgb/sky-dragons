const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Verifica el token JWT y consulta el usuario actual para aplicar permisos vigentes.
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token de acceso' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id, {
      attributes: ['id', 'name', 'role', 'memberId', 'isApproved'],
    });
    if (!user) return res.status(401).json({ error: 'Usuario inexistente' });
    if (!user.isApproved) return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.' });
    req.user = {
      id: user.id,
      name: user.name,
      role: user.role,
      memberId: user.memberId,
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o vencido' });
    }
    next(error);
  }
}

// Permite el paso solo a ciertos roles (admin siempre pasa)
function allow(...roles) {
  return (req, res, next) => {
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'No tienes permiso para esta acción' });
  };
}

module.exports = { authenticate, allow };
