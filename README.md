# Client API

Simple CRUD API for client records. Node.js + Fastify + PostgreSQL. simba 



Using your own Postgres instead of Docker:

`
createdb clients_db
psql clients_db -f db/schema.sql -f db/seed.sql
DATABASE_URL=postgres://user:pass@localhost:5000/clients_db npm start
`


## Endpoints

| Method | Path                       
|--------|-----------------
| GET    | /health                               
| POST   | /clients            
| GET    | /clients              
| GET    | /clients/:id                                  
| PUT    | /clients/:id                          
| PATCH  | /clients/:id                            
| DELETE | /clients/:id                        

Required on create/PUT: `first_name`, `last_name`, `email` (it must be unique).
