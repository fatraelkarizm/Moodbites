#!/usr/bin/env bash
set -euo pipefail

: "${AGE_PUBLIC_KEY:?AGE_PUBLIC_KEY must be set}"
: "${MOODBITE_DATABASE_URL:?MOODBITE_DATABASE_URL must be set}"

backup_dir=/var/backups/moodbite
timestamp=$(date -u +%Y-%m-%d_%H%M%S)
umask 077
mkdir -p "$backup_dir"

pg_dump --format=custom "$MOODBITE_DATABASE_URL" \
  | age --recipient "$AGE_PUBLIC_KEY" \
  > "$backup_dir/moodbite_${timestamp}.dump.age"

find "$backup_dir" -type f -name 'moodbite_*.dump.age' -mtime +14 -delete
