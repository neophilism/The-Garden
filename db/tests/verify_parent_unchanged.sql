SELECT (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'garden_%') AS garden_roles,
       (SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'garden_%') AS garden_schemas,
       (SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')) AS user_tables;
