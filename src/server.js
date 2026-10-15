import Fastify from 'fastify';
import pg from 'pg';
pg.types.setTypeParser(20, Number);
import{fileURLToPath} from 'node:url';
import fastifyStatic from '@fastify/static';
import registerAuth from './auth.js'

const PORT = Number(process.env.PORT || 3000);
const POOL_MAX = Number(process.env.PG_POOL_MAX || 10);

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://postgres:mwanga@localhost:5000/clients_db',
  max: POOL_MAX,
  idleTimeoutMillis: 0 ,
  keepAlive: true,
});


const app = Fastify({ logger: process.env.LOG === '1' });

const COLS = 'id, first_name, last_name, email, phone, company, address, city, country, created_at, updated_at';

const clientProps = {
  first_name: { type: 'string', minLength: 1, maxLength: 100 },
  last_name:  { type: 'string', minLength: 1, maxLength: 100 },
  email:      { type: 'string', minLength: 3, maxLength: 254 },
  phone:      { type: 'string', maxLength: 50 },
  company:    { type: 'string', maxLength: 200 },
  address:    { type: 'string', maxLength: 300 },
  city:       { type: 'string', maxLength: 100 },
  country:    { type: 'string', maxLength: 100 },
};

const clientResponse = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    ...Object.fromEntries(Object.keys(clientProps).map((k) => [k, { type: ['string', 'null'] }])),
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
};
const SEARCH_WHERE = `(first_name ILIKE $1 OR last_name ILIKE $1
  OR (first_name || ' ' || last_name) ILIKE $1
  OR email ILIKE $1 OR company ILIKE $1 OR city ILIKE $1 OR country ILIKE $1)`;

const Q = {
  create: (b) => ({
    name: 'client_create',
    text: `INSERT INTO clients (first_name,last_name,email,phone,company,address,city,country)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
    values: [b.first_name, b.last_name, b.email, b.phone ?? null, b.company ?? null,
             b.address ?? null, b.city ?? null, b.country ?? null],
  }),
  get: (id) => ({
    name: 'client_get',
    text: `SELECT ${COLS} FROM clients WHERE id = $1`,
    values: [id],
  }),
  
  list: ( limit, offset) => ({
    name: 'client_list',
    text: `SELECT ${COLS} FROM clients ORDER BY id LIMIT $1 OFFSET $2`,
    values: [limit, offset],
  }),
  listAfter:(after, limit)=>({
    name:'client_list_after',
    text:`SELECT ${COLS} FROM clients WHERE id> $1 ORDER BY id LIMIT $2`,
    values:[after, limit],
  }),
  count: ()=>({
    name: 'client_count',
    text: 'SELECT COUNT(*) AS total FROM clients',  }),
    replace: (id, b) => ({
    name: 'client_replace',
    text: `UPDATE clients SET first_name=$2,last_name=$3,email=$4,phone=$5,company=$6,
                  address=$7,city=$8,country=$9,updated_at=now()
           WHERE id=$1 RETURNING ${COLS}`,
    values: [id, b.first_name, b.last_name, b.email, b.phone ?? null, b.company ?? null,
             b.address ?? null, b.city ?? null, b.country ?? null],
  }),
  searchList: (term, limit, offset) => ({
  name: 'client_search_list',
  text: `SELECT ${COLS} FROM clients WHERE ${SEARCH_WHERE} ORDER BY id LIMIT $2 OFFSET $3`,
  values: [term, limit, offset],
}),
searchCount: (term) => ({
  name: 'client_search_count',
  text: `SELECT COUNT(*) AS total FROM clients WHERE ${SEARCH_WHERE}`,
  values: [term],
}),

  patch: (id, b) => ({
    name: 'client_patch',
    text: `UPDATE clients SET
             first_name=COALESCE($2,first_name), last_name=COALESCE($3,last_name),
             email=COALESCE($4,email), phone=COALESCE($5,phone), company=COALESCE($6,company),
             address=COALESCE($7,address), city=COALESCE($8,city), country=COALESCE($9,country),
             updated_at=now()
           WHERE id=$1 RETURNING ${COLS}`,
    values: [id, b.first_name ?? null, b.last_name ?? null, b.email ?? null, b.phone ?? null,
             b.company ?? null, b.address ?? null, b.city ?? null, b.country ?? null],
  }),
  remove: (id) => ({
    name: 'client_delete',
    text: 'DELETE FROM clients WHERE id = $1',
    values: [id],
  }),
};

const notFound = (reply) => reply.code(404).send({ error: 'Client not found' });

// Map unique-violation on email to 409 instead of a 500.
app.setErrorHandler((err, req, reply) => {
  if (err.code === '23505') return reply.code(409).send({ error: 'Email already exists' });
  if (err.validation) return reply.code(400).send({ error: err.message });
  req.log.error(err);
  return reply.code(500).send({ error: 'Internal server error' });
});
await registerAuth(app, pool)
await app.register(fastifyStatic, {root: fileURLToPath(new URL('../public/', import.meta.url))})
app.get('/health', async () => ({ status: 'ok' }));

app.post('/clients', {
  schema: {
    body: {
      type: 'object',
      properties: clientProps,
      required: ['first_name', 'last_name', 'email'],
      additionalProperties: false,
    },
    response: { 201: clientResponse },
  },
}, async (req, reply) => {
  const { rows } = await pool.query(Q.create(req.body));
  return reply.code(201).send(rows[0]);
});

app.get('/clients', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
       limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        page: { type: 'integer', minimum: 1, maximum: 1000000, default:1},
        after: { type: 'integer', minimum: 0},
        search: {type:'string', maxLength:100}
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          data: { type: 'array', items: clientResponse },
          page: {type: 'integer'},
          limit: {type:'integer'},
          total:{type: 'integer'},
          total_pages: { type: 'integer' },
          next_after: {type:['integer', 'null']}

        },
      },
    },
  },
}, async (req) => {
  const { limit,page, after, search } = req.query;
   if (after !== undefined) {
    const { rows } = await pool.query(Q.listAfter(after, limit + 1));
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    return { data: rows, limit, next_after: hasMore ? rows[rows.length - 1].id : null };
  }

  // Page mode: GET /clients?page=2&limit=20
  const offset = (page - 1) * limit;
  
  if (search && search.trim()) {
  const term = '%' + search.trim().replace(/[\\%_]/g, '\\$&') + '%';
  const [list, count] = await Promise.all([
    pool.query(Q.searchList(term, limit, offset)),
    pool.query(Q.searchCount(term)),
  ]);
  const total = count.rows[0].total;
  return { data: list.rows, page, limit, total, total_pages: Math.ceil(total / limit) };
}

  const [list, count] = await Promise.all([
    pool.query(Q.list(limit, offset)),
    pool.query(Q.count()),
  ]);
  const total = count.rows[0].total;
  return {
    data: list.rows,
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  };
});



app.get('/clients/:id', {
  schema: { params: idParams, response: { 200: clientResponse } },
}, async (req, reply) => {
  const { rows } = await pool.query(Q.get(req.params.id));
  return rows[0] ?? notFound(reply);
});

app.put('/clients/:id', {
  schema: {
    params: idParams,
    body: {
      type: 'object',
      properties: clientProps,
      required: ['first_name', 'last_name', 'email'],
      additionalProperties: false,
    },
    response: { 200: clientResponse },
  },
}, async (req, reply) => {
  const { rows } = await pool.query(Q.replace(req.params.id, req.body));
  return rows[0] ?? notFound(reply);
});

app.patch('/clients/:id', {
  schema: {
    params: idParams,
    body: { type: 'object', properties: clientProps, additionalProperties: false, minProperties: 1 },
    response: { 200: clientResponse },
  },
}, async (req, reply) => {
  const { rows } = await pool.query(Q.patch(req.params.id, req.body));
  return rows[0] ?? notFound(reply);
});

app.delete('/clients/:id', { schema: { params: idParams } }, async (req, reply) => {
  const { rowCount } = await pool.query(Q.remove(req.params.id));
  return rowCount ? reply.code(204).send() : notFound(reply);
});

// Pre-open connections so the first requests don't pay connection setup cost.
async function warmPool() {
  const n = Math.min(POOL_MAX, 5);
  await Promise.all(Array.from({ length: n }, () => pool.query('SELECT 1')));
}

try {
  await warmPool();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Client API listening on :${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
