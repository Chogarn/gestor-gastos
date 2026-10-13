# Despliegue en un servidor con HTTPS

Caddy va delante de la app, obtiene el certificado de Let's Encrypt y lo renueva solo.
Solo Caddy publica puertos (80/443); el frontend y el backend quedan en la red interna.

> Si la app la vas a usar solo tú, considera Tailscale: no hace falta dominio ni abrir puertos.

## Requisitos

- Un servidor (VPS) con Docker y Docker Compose 2.24 o superior.
- Un dominio cuyo registro DNS `A` apunte a la IP del servidor.
- El firewall del servidor debe dejar pasar solo 22 (SSH), 80 y 443 (TCP, y 443/UDP para HTTP/3).

## Primer despliegue

```bash
git clone <url-del-repo> gestor-gastos
cd gestor-gastos
cp .env.example .env
```

Edita `.env`:

- `SECRET_KEY` y `POSTGRES_PASSWORD`: genera valores **nuevos**, no reutilices los de tu PC:
  `python -c "import secrets; print(secrets.token_hex(32))"`
- `POSTGRES_USER` y `POSTGRES_DB`: los que quieras.
- `DOMAIN`: tu dominio, por ejemplo `gastos.midominio.com`.

Levanta:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Abre `https://<tu-dominio>` y comprueba que carga con el candado.

## Logs

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f caddy
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

Si el certificado no se emite, mira los logs de `caddy`: casi siempre es que el DNS aún no
apunta al servidor o que 80/443 están bloqueados.

## Actualizar

```bash
git pull
scripts/backup.sh -f docker-compose.prod.yml   # copia de seguridad antes de migrar
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Las migraciones se aplican solas al arrancar el backend.

## Migrar tus datos actuales

Hazlo **antes de que se registre nadie en el servidor**: la primera persona que se registra
se queda con los datos huérfanos, y psql sobrescribiría lo que ya haya.

En tu PC, desde la raíz del repo:

```bash
scripts/backup.sh
scp backups/backup-AAAAMMDD-HHMMSS.sql.gz usuario@servidor:~/
```

En el servidor, con el stack ya levantado una vez (para que existan la base y el usuario):

```bash
cd gestor-gastos
mkdir -p backups && mv ~/backup-AAAAMMDD-HHMMSS.sql.gz backups/
scripts/restore.sh -f docker-compose.prod.yml backups/backup-AAAAMMDD-HHMMSS.sql.gz
```

Todas las sesiones de tu PC no valen en el servidor (otra `SECRET_KEY`); inicia sesión de nuevo.

## Notas

- El límite de intentos de login es por cuenta, no por IP (ver `CLAUDE.md`); no actives
  `TRUSTED_PROXIES`.
- No borres el volumen `caddy_data`: contiene los certificados.
