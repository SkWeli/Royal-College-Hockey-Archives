-- Update 003: country of residence for players.
-- Run once in Supabase SQL Editor.

alter table players add column if not exists residence_country text default 'Sri Lanka';
