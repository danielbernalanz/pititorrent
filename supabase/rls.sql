-- Ejecutar en Supabase > SQL Editor (una vez).
-- Requiere activar "Anonymous sign-ins" en Authentication > Providers.
-- Modelo: cualquiera puede publicar; cada fila guarda su dueño (sesión anónima)
-- y solo el dueño puede borrarla.

-- 1) Revisa primero las políticas que ya existan y elimina cualquiera que
--    permita borrar o insertar a todo el mundo:
--    select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'torrents';

alter table public.torrents add column if not exists owner_id uuid default auth.uid();
alter table public.torrents enable row level security;

drop policy if exists "lectura publica" on public.torrents;
drop policy if exists "subir" on public.torrents;
drop policy if exists "borrar propio" on public.torrents;

create policy "lectura publica" on public.torrents
  for select to anon, authenticated using (true);

create policy "subir" on public.torrents
  for insert to authenticated with check (owner_id = auth.uid());

create policy "borrar propio" on public.torrents
  for delete to authenticated using (owner_id = auth.uid());

-- Nota: no hay política de UPDATE, así que nadie puede modificar filas ajenas.
-- Las filas anteriores a esta migración tienen owner_id NULL: nadie puede borrarlas
-- desde la web; bórralas desde el panel de Supabase si hace falta.
