import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';


export default async function registerAuth(app, pool) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

  await app.register(jwt, {
    secret: process.env.JWT_SECRET,
    sign: { expiresIn: process.env.JWT_EXPIRES || '8h' },
  });

  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', minLength: 3, maxLength: 254 },
          password: { type: 'string', minLength: 1, maxLength: 200 },
        },
        required: ['email', 'password'],
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const u = rows[0];
    const ok = u && (await bcrypt.compare(password, u.password_hash));
    if (!ok) return reply.code(401).send({ error: 'Invalid email or password' });

    const token = app.jwt.sign({ sub: u.id, email: u.email, role: u.role });
    return { token, user: { email: u.email, role: u.role } };
  });

  
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/clients')) return;
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Login required' });
    }
    if (req.method !== 'GET' && req.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  });
}