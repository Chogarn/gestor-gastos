#!/usr/bin/env bash
# Restaura una copia hecha con scripts/backup.sh sobre la base del stack de Compose.
# SOBRESCRIBE los datos actuales.
#
# Uso (desde la raíz del repo):
#   scripts/restore.sh [-f otro-compose.yml]... backups/backup-AAAAMMDD-HHMMSS.sql.gz[.gpg]
#
# Acepta .sql.gz.gpg (descifra con gpg), .sql.gz y .sql.
set -euo pipefail

COMPOSE=(docker compose)
while getopts "f:" opt; do
  case "$opt" in
    # El primer -f añade el compose base una sola vez; luego van los extra en orden
    f) if [ "${#COMPOSE[@]}" -eq 2 ]; then COMPOSE+=(-f docker-compose.yml); fi; COMPOSE+=(-f "$OPTARG") ;;
    *) echo "Uso: $0 [-f archivo-compose.yml] <copia>" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Uso: $0 [-f archivo-compose.yml] <archivo de copia>" >&2
  exit 2
fi

case "$FILE" in
  *.sql.gz.gpg) READ=(sh -c 'gpg --decrypt "$1" | gzip -dc' _ "$FILE") ;;
  *.sql.gz)     READ=(gzip -dc "$FILE") ;;
  *.sql)        READ=(cat "$FILE") ;;
  *) echo "Extensión no reconocida: $FILE" >&2; exit 2 ;;
esac

echo "Se va a restaurar '$FILE' sobre la base de datos del proyecto Compose '${COMPOSE_PROJECT_NAME:-$(basename "$PWD")}'."
echo "Esto SOBRESCRIBE los datos actuales."
read -r -p 'Escribe "si" para continuar: ' CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 1
fi

# Una sola transacción y parando en el primer error: o se restaura todo o no se toca nada.
"${READ[@]}" | "${COMPOSE[@]}" exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -q' > /dev/null
echo "Restauración completa."
