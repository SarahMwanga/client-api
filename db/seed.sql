-- Seeds 100 dummy clients (deterministic via setseed)
SELECT setseed(0.42);

INSERT INTO clients (first_name, last_name, email, phone, company, address, city, country)
SELECT
  f, l,
  lower(f || '.' || l || i || '@example.com'),
  '+1-555-' || lpad((1000 + i)::text, 4, '0'),
  co,
  (100 + floor(random() * 900))::int || ' ' || st || ' Street',
  ci,
  'USA'
FROM (
  SELECT
    i,
    fn[1 + floor(random() * cardinality(fn))::int] AS f,
    ln[1 + floor(random() * cardinality(ln))::int] AS l,
    cm[1 + floor(random() * cardinality(cm))::int] AS co,
    ct[1 + floor(random() * cardinality(ct))::int] AS ci,
    sr[1 + floor(random() * cardinality(sr))::int] AS st
  FROM (
    SELECT
      ARRAY['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth',
            'William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Daniel','Karen'] AS fn,
      ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
            'Hernandez','Lopez','Wilson','Anderson','Taylor','Thomas','Moore','Jackson','Martin','Lee'] AS ln,
      ARRAY['Acme Corp','Globex','Initech','Umbrella Ltd','Stark Industries','Wayne Enterprises',
            'Hooli','Soylent Co','Vandelay Industries','Wonka Foods'] AS cm,
      ARRAY['New York','Austin','Chicago','Seattle','Denver','Boston','Atlanta','Miami'] AS ct,
      ARRAY['Main','Oak','Maple','Cedar','Pine','Elm','Lake','Hill'] AS sr
  ) arrays,
  generate_series(1, 100) AS i
) t;
