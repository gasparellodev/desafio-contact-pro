-- Cria schemas separados para Evolution API e backend Contact Pro.
-- Executado uma única vez no primeiro start do container Postgres.
CREATE SCHEMA IF NOT EXISTS evolution_api AUTHORIZATION contactpro;
CREATE SCHEMA IF NOT EXISTS contactpro AUTHORIZATION contactpro;
