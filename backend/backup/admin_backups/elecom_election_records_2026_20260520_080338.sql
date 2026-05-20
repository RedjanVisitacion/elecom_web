-- PostgreSQL database dump
-- ELECOM Django fallback backup
-- Created at: 2026-05-20T00:03:38.672294+00:00
-- Backup type: election_records

BEGIN;
TRUNCATE TABLE "vote_windows", "votes", "vote_items" RESTART IDENTITY CASCADE;
INSERT INTO "vote_windows" ("id", "start_at", "end_at", "results_at", "note", "created_at", "updated_at", "election_name", "school_year", "status") VALUES (1, '2026-03-11T21:12:00'::timestamp, '2026-03-11T21:15:00'::timestamp, '2026-03-11T21:15:00'::timestamp, NULL, '2026-03-11T13:13:28.143764'::timestamp, NULL, NULL, NULL, 'active');
INSERT INTO "vote_windows" ("id", "start_at", "end_at", "results_at", "note", "created_at", "updated_at", "election_name", "school_year", "status") VALUES (2, '2026-03-11T21:12:00'::timestamp, '2026-03-11T21:15:00'::timestamp, '2026-03-11T21:15:00'::timestamp, NULL, '2026-03-11T13:13:46.940961'::timestamp, NULL, NULL, NULL, 'active');
INSERT INTO "vote_windows" ("id", "start_at", "end_at", "results_at", "note", "created_at", "updated_at", "election_name", "school_year", "status") VALUES (3, '2026-03-11T21:12:00'::timestamp, '2026-03-11T21:15:00'::timestamp, '2026-03-11T21:15:00'::timestamp, NULL, '2026-03-11T13:18:03.623900'::timestamp, NULL, NULL, NULL, 'active');
INSERT INTO "vote_windows" ("id", "start_at", "end_at", "results_at", "note", "created_at", "updated_at", "election_name", "school_year", "status") VALUES (4, '2026-05-08T00:00:00'::timestamp, '2026-05-16T00:50:00'::timestamp, '2026-05-16T00:50:00'::timestamp, 'Good Luck', '2026-03-11T13:22:39.714736'::timestamp, '2026-05-16T00:24:17.320122'::timestamp, NULL, NULL, 'archived');
INSERT INTO "vote_windows" ("id", "start_at", "end_at", "results_at", "note", "created_at", "updated_at", "election_name", "school_year", "status") VALUES (5, '2026-05-18T22:51:00'::timestamp, '2026-05-18T22:55:00'::timestamp, '2026-05-18T22:55:00'::timestamp, 'General Election', '2026-05-18T14:52:42.204733'::timestamp, NULL, 'ELECOM 2027', '2026-2027', 'archived');
INSERT INTO "vote_windows" ("id", "start_at", "end_at", "results_at", "note", "created_at", "updated_at", "election_name", "school_year", "status") VALUES (6, '2026-05-17T23:11:00'::timestamp, '2026-05-18T14:11:00'::timestamp, '2026-05-18T18:11:00'::timestamp, 'General Election', '2026-05-18T15:12:24.833864'::timestamp, NULL, 'ELECOM 2027', '2026-2027', 'active');
COMMIT;
