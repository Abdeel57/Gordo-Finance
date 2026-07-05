# Gordo Finance 💵

PWA de finanzas personales pensada para el teléfono: registra un ingreso o un
gasto en menos de 5 segundos, mira cuánto dinero deberías tener y descarga tu
reporte en Excel cuando lo necesites. Funciona sin conexión y se sincroniza
sola cuando vuelve el internet.

## Qué incluye

- **Inicio ("Tu dinero hoy")** — balance disponible grande, ingresos y gastos
  del periodo (hoy / semana / mes / personalizado), dos botones gigantes para
  agregar ingreso o gasto, gráfica simple de ingresos vs gastos y últimos
  movimientos.
- **Captura rápida** — hoja tipo app móvil: el monto va primero y abre teclado
  numérico; categoría y cuenta se eligen con chips; fecha con "Hoy/Ayer";
  nota opcional. Al guardar: confirmación, balance actualizado y botón
  "Agregar otro".
- **Movimientos** — búsqueda por descripción, filtros por tipo, categoría y
  periodo, edición y eliminación con confirmación. En el teléfono: desliza a
  la derecha para editar y a la izquierda para eliminar; en computadora hay
  botones visibles.
- **Categorías y cuentas** — se crean por defecto al registrarte y se
  administran desde Ajustes. Saldo actual = saldo inicial + ingresos − gastos.
- **Reportes** — totales, gastos/ingresos por categoría y resumen por cuenta,
  con exportación **real a Excel (6 hojas con formato de moneda y totales)** y
  a CSV. Se genera en el dispositivo, incluso sin conexión.
- **PWA completa** — instalable en iPhone, Android y escritorio, con service
  worker, pantalla de carga, modo oscuro y funcionamiento offline: los
  registros hechos sin internet se guardan en el dispositivo y se sincronizan
  automáticamente al reconectar.
- **Autenticación** simple con correo y contraseña (JWT).

Todo está en pesos mexicanos (MXN) y zona horaria de México
(`America/Mexico_City`). Los montos se guardan como enteros en **centavos**
para evitar errores de punto flotante.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS 4, lucide-react |
| Datos locales | IndexedDB con Dexie (local-first, actualización reactiva) |
| PWA | vite-plugin-pwa (manifest, service worker, precache) |
| Excel | SheetJS (xlsx), carga bajo demanda |
| Backend | Node.js + Express + Zod |
| Base de datos | PostgreSQL + Prisma ORM (migraciones incluidas) |
| Despliegue | Railway (API + DB) y Netlify o Vercel (frontend) |

## Estructura

```
├── client/            # PWA (React + Vite)
│   ├── src/lib/       # db (Dexie), sync, repo, formato MXN, excel, auth
│   ├── src/pages/     # Inicio, Movimientos, Reportes, Ajustes, Login
│   └── src/components # UI, hoja de captura, gestos, gráficas, navegación
├── server/            # API (Express + Prisma)
│   ├── prisma/        # schema + migraciones
│   └── src/routes/    # auth, sync, accounts, categories, transactions
├── docker-compose.yml # PostgreSQL local
└── netlify.toml       # Despliegue del frontend
```

### Cómo funciona el modo offline

La app es **local-first**: toda la interfaz lee y escribe en IndexedDB, por eso
es instantánea y funciona sin internet. Cada cambio se marca como pendiente
(outbox) y un motor de sincronización lo empuja al servidor cuando hay
conexión (al reconectar, al volver a la app y cada 2 minutos). Después trae lo
que cambió en el servidor desde la última sincronización. Los conflictos se
resuelven con "gana la escritura más reciente" y los borrados son lógicos
(tombstones), de modo que varios dispositivos convergen al mismo estado.

## Ejecutar en local

Requisitos: Node 20+, y Docker (o un PostgreSQL propio).

```bash
# 1. Base de datos
docker compose up -d

# 2. API
cd server
copy .env.example .env        # (macOS/Linux: cp) valores por defecto ya sirven
npm install
npx prisma migrate deploy     # crea las tablas
npm run dev                   # http://localhost:4000

# 3. PWA (otra terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Abre http://localhost:5173, crea tu cuenta y listo: tendrás la cuenta
"Efectivo" y las categorías estándar para empezar a registrar.

Para probar la versión instalable: `npm run build && npm run preview` dentro
de `client/` (el service worker solo se activa en build de producción).

## Despliegue

### API + PostgreSQL en Railway

1. Crea un proyecto en Railway y agrega un servicio **PostgreSQL**.
2. Agrega un servicio desde este repo con **root directory `server`**.
3. Variables de entorno del servicio:
   - `DATABASE_URL` → referencia a la de PostgreSQL (Railway la sugiere).
   - `JWT_SECRET` → cadena larga y aleatoria.
   - `CORS_ORIGIN` → URL de tu frontend (p. ej. `https://cuentaclara.netlify.app`).
4. Build: `npm run build` · Start: `npm start` (aplica las migraciones y
   arranca). Railway inyecta `PORT` automáticamente.

### Frontend en Netlify (o Vercel)

- **Netlify**: conecta el repo; `netlify.toml` ya define base `client`,
  build `npm run build` y publish `dist`. Solo agrega la variable
  `VITE_API_URL` = `https://<tu-api>.up.railway.app/api`.
- **Vercel**: importa el repo con root directory `client` (incluye
  `vercel.json` con el rewrite de SPA) y define `VITE_API_URL`.

### Instalar en el teléfono

- **iPhone (Safari)**: botón compartir → "Agregar a pantalla de inicio".
- **Android (Chrome)**: menú ⋮ → "Instalar aplicación" (o el aviso automático).

## Reglas de negocio

- Un ingreso siempre suma al balance; un gasto siempre resta.
- No se permiten montos negativos o cero, ni movimientos sin monto,
  descripción, categoría o cuenta (validado en cliente y servidor).
- Cuentas y categorías con movimientos no pueden eliminarse.
- Eliminar siempre pide confirmación.
- Sin datos demo: cada usuario empieza solo con sus categorías y su cuenta
  "Efectivo" en cero.

## Base de datos

Entidades: `users`, `user_settings`, `accounts`, `categories`,
`transactions`. Las transacciones guardan `type` (`income | expense`),
`amount` (centavos), `description`, `transaction_date`, `notes` y timestamps;
`deleted_at` implementa borrado lógico para la sincronización. La migración
inicial está en `server/prisma/migrations/`.

## Scripts útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| server | `npm run dev` | API con recarga |
| server | `npm run build` / `npm start` | compilar / migrar + arrancar |
| server | `npm run prisma:studio` | explorar la base de datos |
| client | `npm run dev` | PWA en desarrollo |
| client | `npm run build` | typecheck + build + service worker |
| client | `npm run icons` | regenerar iconos de la app |
