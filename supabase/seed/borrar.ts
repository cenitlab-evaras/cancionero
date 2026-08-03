/**
 * Contraparte que borra la semilla — docs/PRD.md §13.4, regla 4.
 *
 * Un seed sin borrador convierte la base de desarrollo en un lugar del que no
 * se puede volver. Esto deja el esquema como estaba: sin datos, con las tablas
 * y las políticas intactas.
 *
 * Sirve además para el paso 7 de la verificación (§15): borrar la semilla y
 * recorrer las rutas para comprobar que ninguna revienta sin datos.
 *
 *   npm run db:borrar-semilla
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY

if (!URL || !SECRET) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example).')
}

const db = createClient(URL, SECRET, {
  db: { schema: 'cantoral' },
  auth: { autoRefreshToken: false, persistSession: false },
})
const auth = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// De las hojas hacia la raíz: el orden importa por las claves foráneas.
const TABLAS = ['canto_momentos', 'cantos', 'autores', 'coro_acceso', 'coros', 'momentos_liturgicos']

async function main() {
  for (const tabla of TABLAS) {
    const { error } = await db.from(tabla).delete().not('id', 'is', null)
    if (error) throw error
    console.log(`· ${tabla} vaciada`)
  }

  // Los usuarios de prueba: borrarlos de Auth arrastra su perfil (on delete cascade).
  const { data, error } = await auth.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  for (const u of data.users) {
    if (u.email?.endsWith('@cantoral.local')) {
      const { error: errBorrar } = await auth.auth.admin.deleteUser(u.id)
      if (errBorrar) throw errBorrar
      console.log(`· usuario ${u.email} borrado`)
    }
  }

  console.log('✓ Semilla borrada. El esquema queda como estaba.')
}

main().catch((e) => {
  console.error('✗ El borrado falló:', e.message ?? e)
  process.exit(1)
})
