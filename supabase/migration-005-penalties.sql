-- Update 005: how a level match was decided.
-- Run once in Supabase SQL Editor.
alter table matches add column if not exists decided_by text
  check (decided_by is null or decided_by in ('Penalty strokes', 'Shoot-out', 'Sudden death'));
alter table matches add column if not exists pen_for int check (pen_for >= 0);
alter table matches add column if not exists pen_against int check (pen_against >= 0);
comment on column matches.decided_by is 'Empty = the draw stood. Penalty strokes (PS), Shoot-out, or Sudden death (shoot-out still level, then sudden death)';
comment on column matches.pen_for is 'Royal penalties scored (including sudden death)';
