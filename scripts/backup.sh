#!/usr/bin/env bash
# Copia de seguridad de la base de datos del stack de Docker Compose.
#
# Uso (desde la raíz del repo):
#   scripts/backup.sh [-f otro-compose.yml]...
#
# Variables opcionales:
#   BACKUP_GPG_RECIPIENT   cifra la copia con gpg para ese destinatario
#   BACKUP_RETENTION_DAYS  días que se conservan las copias backup-* (30 por defecto)
#   COMPOSE_PROJECT_NAME   proyecto de Compose sobre el que actuar (para stacks de prueba)
set -euo pipefail

COMPOSE=(docker compose)
while getopts "f:" opt; do
  case "$opt" in
    # El primer -f añade el compose base una sola vez; luego van los extra en orden
    f) if [ "${#COMPOSE[@]}" -eq 2 ]; then COMPOSE+=(-f docker-compose.yml); fi; COMPOSE+=(-f "$OPTARG") ;;
    *) echo "Uso: $0 [-f archivo-compose.yml]" >&2; exit 2 ;;
  esac
done
DIR=backups
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$DIR"
FILE="$DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz"

# --clean --if-exists: el volcado borra y recrea los objetos, así restore.sh puede
# aplicarse sobre una base que ya tiene datos.
echo "Volcando la base de datos a $FILE ..."
if ! "${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB"' \
    | gzip > "$FILE"; then
  rm -f "$FILE"
  echo "Error: falló pg_dump (¿está levantado el servicio db?)." >&2
  exit 1
fi

# Un volcado vacío o cortado no sirve: tiene que terminar con la marca de pg_dump.
if [ ! -s "$FILE" ] || ! gzip -dc "$FILE" | tail -n 20 | grep -q "PostgreSQL database dump complete"; then
  rm -f "$FILE"
  echo "Error: el volcado está vacío o incompleto; se descartó." >&2
  exit 1
fi

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  if gpg --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$FILE.gpg" "$FILE"; then
    rm -f "$FILE"
    FILE="$FILE.gpg"
  else
    rm -f "$FILE" "$FILE.gpg"
    echo "Error: falló el cifrado con gpg; no se conservó la copia sin cifrar." >&2
    exit 1
  fi
fi

# Retención: solo los backup-*, los volcados pre-*.sql manuales no se tocan.
find "$DIR" -maxdepth 1 -type f \( -name 'backup-*.sql.gz' -o -name 'backup-*.sql.gz.gpg' \) \
  -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/Borrada copia antigua: /'

echo "Copia lista: $FILE"
