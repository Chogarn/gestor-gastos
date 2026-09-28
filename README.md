# Gestor de gastos

Aplicación web multiusuario para registrar ingresos y gastos, y ver cada mes tu balance, cuánto gastas por categoría y cómo evolucionan tus finanzas mes a mes.

- **Frontend:** Next.js (App Router, TypeScript, Tailwind)
- **Backend:** Flask + SQLAlchemy + Flask-Migrate (Alembic)
- **Base de datos:** PostgreSQL 16
- **Orquestación:** Docker Compose

## Arrancar con Docker

1. Abre Docker Desktop y espera a que el motor esté en marcha.
2. Crea tu archivo de entorno y edítalo: cambia la contraseña de Postgres y define `SECRET_KEY`.
   ```bash
   cp .env.example .env
   ```
   Para generar una `SECRET_KEY` segura:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
3. Levanta todo:
   ```bash
   docker compose up --build
   ```
4. Abre http://localhost:3000 (página de inicio) y pulsa **Crear cuenta**.

### Páginas

| Ruta | Qué es |
| --- | --- |
| `/` | Página de inicio con la presentación y accesos para crear cuenta o iniciar sesión (si ya hay sesión, ofrece ir al panel) |
| `/register`, `/login` | Alta e inicio de sesión (con botón para mostrar u ocultar la contraseña) |
| `/dashboard` | Resumen, en pestañas: balance del mes (con botones `+`/`−` debajo de Gastos/Ingresos para alta rápida; el número de Ingresos/Gastos lleva a su sección), evolución de ingresos y gastos por día/semana/mes/año, y últimos movimientos (gastos e ingresos mezclados) |
| `/expenses` | Gastos: botón "+ Nuevo gasto" (el alta, en una ventana emergente) y, en pestañas, el gráfico circular por categoría del mes; presupuesto mensual por categoría (con barra de progreso) y, debajo, los gastos recurrentes (alta, edición, pausar/reanudar y borrado); la evolución de gastos en el tiempo; la lista completa con filtros por mes/categoría (edición y borrado); y las categorías (verlas, crearlas y borrarlas, con confirmación al borrar) |
| `/incomes` | Ingresos: lo mismo que Gastos (mismas pestañas — en "Presupuestos" solo se ven los ingresos recurrentes, ya que el presupuesto en sí no aplica a ingresos), con sus propias categorías |
| `/profile` | Perfil: nombre, moneda, datos de la cuenta, estadísticas y cambio de contraseña |

Las páginas con sesión comparten una cabecera con la navegación (Resumen · Gastos · Ingresos, centrada) y el menú de la cuenta (avatar con "Mi perfil" y "Cerrar sesión"). No hay páginas aparte para categorías, gastos/ingresos recurrentes ni presupuestos: viven como pestañas ("Categorías", "Presupuestos") dentro de `/expenses`/`/incomes`.

Solo el frontend se publica (puerto 3000). El navegador llama a `/api/...` en ese mismo servidor y Next lo reenvía al backend por la red interna de Docker; así la sesión es de un único origen y el backend no queda expuesto. Para comprobar que el backend responde: http://localhost:3000/api/health.

### Cuentas y datos

- Cada persona se registra con email y contraseña (mínimo 8 caracteres) y **solo ve sus propios datos**.
- Al crear una cuenta se generan sus categorías por defecto:
  - **Gastos:** Comida, Transporte, Hogar, Ocio, Otros.
  - **Ingresos:** Salario, Freelance, Inversiones, Otros.
- Los gastos solo admiten categorías de gasto y los ingresos solo de ingreso.
- **Datos anteriores a las cuentas:** los movimientos y categorías creados antes de que existiera el login no tienen dueño. **La primera persona que se registre los reclama.** Si tienes datos así, regístrate tú primero.
- La sesión es una cookie `HttpOnly` firmada con `SECRET_KEY` (dura 30 días). Si cambias `SECRET_KEY`, se cierran todas las sesiones.
- Desde el perfil puedes poner un nombre (opcional), elegir tu moneda (solo cambia cómo se muestran los montos, no los convierte) y cambiar la contraseña. **Al cambiarla se cierran las sesiones abiertas en tus otros dispositivos**; la actual sigue activa.
- **Gastos e ingresos recurrentes:** desde la sección "Recurrentes" dentro de la pestaña "Presupuestos" de `/expenses`/`/incomes` puedes definir un gasto o ingreso que se repita todos los meses (monto, categoría y día del mes). No hay ninguna tarea programada: se generan solos cada vez que entras a la app, poniendo al día incluso varios meses atrasados si estuvo un tiempo sin abrirse. Pausar una plantilla no borra nada, solo deja de generar; al reanudarla se pone al día de una vez. Editar o borrar una plantilla no toca los movimientos que ya generó, quedan como movimientos normales.
- **Presupuestos por categoría:** desde la pestaña "Presupuestos" de `/expenses` puedes ponerle un tope mensual a cada categoría de gasto (las de ingreso no tienen). Se aplica igual todos los meses hasta que lo cambies; la barra pasa de verde a ámbar (80%) y a rojo al superarlo.
- **Borrar una categoría** pide confirmación antes de hacerlo; si tiene movimientos asociados, el servidor rechaza el borrado.
- Los datos viven en el volumen `pgdata`, así que sobreviven a `docker compose down`. Para borrarlos: `docker compose down -v`.

## Tests del backend

```bash
docker compose run --rm --no-deps backend pytest
```

## Desarrollo sin Docker

Backend (usa SQLite si no defines `DATABASE_URL`; `SECRET_KEY` es obligatoria):

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # en Linux/Mac: .venv/bin/pip
export SECRET_KEY=una-clave-de-desarrollo        # en PowerShell: $env:SECRET_KEY = "..."
flask --app wsgi db upgrade
flask --app wsgi run --port 5000
```

Frontend (reenvía `/api/*` a `http://localhost:5000`; cámbialo con `BACKEND_URL`):

```bash
cd frontend
npm install
npm run dev
```

## API

Todas las rutas, salvo `/api/health`, `/api/auth/register` y `/api/auth/login`, requieren sesión (si no, responden 401). Un recurso de otro usuario responde 404.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servicio |
| POST | `/api/auth/register` | Crea una cuenta `{email, password}` e inicia sesión |
| POST | `/api/auth/login` | Inicia sesión `{email, password}` |
| POST | `/api/auth/logout` | Cierra la sesión |
| GET | `/api/auth/me` | Usuario de la sesión actual `{id, email, name, created_at}` |
| GET | `/api/profile` | Perfil del usuario con estadísticas (`stats`: gastos, ingresos y categorías) |
| PATCH | `/api/profile` | Actualiza el nombre y/o la moneda `{name, currency}` (nombre vacío = sin nombre; `currency` es opcional, si no se manda no se toca) |
| PUT | `/api/profile/password` | Cambia la contraseña `{current_password, new_password}`; cierra las demás sesiones |
| GET | `/api/expenses?month=YYYY-MM&category_id=N&limit=N` | Lista de gastos, más recientes primero (filtros opcionales; `limit` de 1 a 100) |
| POST | `/api/expenses` | Crea un gasto `{amount, description, date, category_id}` |
| PUT | `/api/expenses/<id>` | Edita un gasto |
| DELETE | `/api/expenses/<id>` | Borra un gasto |
| GET | `/api/incomes?month=YYYY-MM&category_id=N&limit=N` | Lista de ingresos, más recientes primero (filtros opcionales; `limit` de 1 a 100) |
| POST | `/api/incomes` | Crea un ingreso `{amount, description, date, category_id}` |
| PUT | `/api/incomes/<id>` | Edita un ingreso |
| DELETE | `/api/incomes/<id>` | Borra un ingreso |
| GET | `/api/categories?kind=expense\|income` | Lista de categorías (filtro opcional por tipo) |
| POST | `/api/categories` | Crea una categoría `{name, kind}` (`kind` por defecto: `expense`) |
| PUT | `/api/categories/<id>` | Pone o quita el presupuesto mensual `{budget}` (`null` lo quita); solo en categorías de gasto |
| DELETE | `/api/categories/<id>` | Borra una categoría (si no tiene movimientos ni plantillas recurrentes) |
| GET | `/api/recurring?kind=expense\|income` | Lista de plantillas recurrentes (activas y pausadas) |
| POST | `/api/recurring` | Crea una plantilla `{amount, description, category_id, day_of_month, kind, active}` (`active` por defecto: `true`); genera de una el mes actual |
| PUT | `/api/recurring/<id>` | Edita una plantilla (mismos campos); si queda activa, pone al día lo que falte |
| DELETE | `/api/recurring/<id>` | Borra una plantilla; los movimientos que ya generó no se borran, quedan sueltos |
| GET | `/api/summary?month=YYYY-MM` | Gastos, ingresos y balance del mes, con desglose por categoría de ambos |
| GET | `/api/summary/history?granularity=month&periods=6&end=YYYY-MM-DD` | Ingresos, gastos y balance por periodo (`granularity`: `day`, `week`, `month` u `year`; `periods` según el máximo de cada una: 90/52/24/10), con ceros en los periodos sin datos |

## Configuración

Archivo `.env` (ver `.env.example`):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: credenciales de la base de datos.
- `SECRET_KEY` (obligatoria): firma las cookies de sesión. Larga, aleatoria y secreta.
- `SESSION_COOKIE_SECURE`: ponlo en `true` cuando sirvas la app por HTTPS.

Otras variables:

- `BACKEND_URL` (build arg del frontend, ver `docker-compose.yml`): dirección interna del backend a la que Next reenvía `/api/*`.

La moneda para mostrar importes no se configura acá: cada usuario la elige desde su perfil (por defecto `USD`).

## Tema (claro / oscuro)

El botón ☀️/🌙 de la cabecera (`frontend/components/ThemeToggle.tsx`) cambia entre modo claro y oscuro y lo recuerda (`localStorage`). Si nunca lo tocaste, arranca según el tema del sistema. Solo está visible en las páginas con sesión; `/`, `/login` y `/register` respetan igual la preferencia guardada, pero no tienen el botón.

## Seguridad: qué hay y qué falta

Incluido: contraseñas con hash (scrypt), cookie de sesión `HttpOnly` + `SameSite=Lax`, la API solo acepta JSON (frena CSRF), datos filtrados por usuario en todas las consultas, límite de intentos de acceso y de cambio de contraseña (10 por minuto por cuenta) y sesiones que dejan de valer al cambiar la contraseña.

Ten en cuenta antes de publicarla en internet:

- **Usa HTTPS** (con un proxy inverso como Caddy o nginx delante) y activa `SESSION_COOKIE_SECURE=true`.
- El límite de intentos es **por cuenta, no por IP**: el proxy de Next no añade `X-Forwarded-For`, así que el backend no ve la IP real del visitante. Con un proxy inverso que sí la sobrescriba, se puede activar `TRUSTED_PROXIES=1` en el backend y limitar también por IP.
- No incluye verificación de email ni recuperación de contraseña (necesitan enviar correos).

## Estructura

```
backend/    API Flask (app/, migrations/, tests/)
frontend/   Next.js (app/, components/, lib/)
docker-compose.yml
```

## Siguientes pasos posibles

Exportar a CSV, recuperación de contraseña.
