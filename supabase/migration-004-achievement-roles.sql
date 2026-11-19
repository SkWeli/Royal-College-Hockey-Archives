-- Update 004: roles on achievements (e.g. Captain (Reds) in Colombo Schools Colours, Head Prefect).
-- Run once in Supabase SQL Editor.
alter table achievements add column if not exists role text;
comment on column achievements.role is 'e.g. Captain (Reds), Vice-Captain, Head Prefect';
comment on column achievements.sport is 'Hockey, another sport, or null for non-sport achievements (Royal Crown, Senior Prefect)';
