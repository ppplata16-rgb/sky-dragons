process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const request = require('supertest');
const app = require('../src/app');

describe('API básica', () => {
  test('GET /api/health responde saludable', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test('ruta protegida desconocida rechaza una petición sin token', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.status).toBe(401);
  });

  test('ruta protegida rechaza una petición sin token', async () => {
    const response = await request(app).get('/api/members');
    expect(response.status).toBe(401);
  });

  test('login rechaza credenciales vacías', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'persona@ejemplo.com', password: '' });
    expect(response.status).toBe(400);
  });

  test('recuperación valida el correo y exige configurar el proveedor antes de enviar', async () => {
    const invalid = await request(app).post('/api/auth/forgot-password').send({ email: 'no-es-correo' });
    expect(invalid.status).toBe(400);
    const unavailable = await request(app).post('/api/auth/forgot-password').send({ email: 'persona@ejemplo.com' });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error).toMatch(/aún no está configurado/i);
  });

  test('restablecer exige token válido y contraseña larga', async () => {
    const response = await request(app).post('/api/auth/reset-password').send({ token: 'inválido', password: 'corta' });
    expect(response.status).toBe(400);
  });

  test('registro público valida contraseña y no admite acceso inmediato', async () => {
    const response = await request(app).post('/api/auth/signup').send({ name: 'Ana Pérez', email: 'ana@example.com', password: 'corta' });
    expect(response.status).toBe(400);
  });

  test('aprobar registros queda reservado a sesiones autenticadas', async () => {
    const response = await request(app).put('/api/auth/users/2/approval').send({ isApproved: true });
    expect(response.status).toBe(401);
  });
});
