#!/usr/bin/env bash
# Update MoodBite di server: tarik kode terbaru, build, jalankan migrasi baru, restart API.
# Jalankan sebagai user dengan sudo:  bash /opt/moodbite/deploy/update.sh
set -euo pipefail

APP=/opt/moodbite
as_app() { sudo -u moodbite -H "$@"; }

as_app git -C "$APP" pull --ff-only
as_app npm ci --prefix "$APP/api" --no-audit --no-fund
as_app npm ci --prefix "$APP/web" --no-audit --no-fund
as_app npm run build --prefix "$APP/api"
as_app npm run build --prefix "$APP/web"

sudo mkdir -p /var/www/moodbite
sudo find /var/www/moodbite -mindepth 1 -delete
sudo cp -r "$APP/web/dist/." /var/www/moodbite/

# Koneksi role owner hanya untuk migrasi; API berjalan sebagai moodbite_app (tanpa bypass RLS).
sudo bash -c "set -a; . /etc/moodbite/migrate.env; set +a; cd '$APP/api' && sudo -E -u moodbite npx tsx scripts/migrate.ts"

sudo systemctl restart moodbite-api
sleep 2
curl -fsS http://127.0.0.1:3100/api/health && echo " <- API sehat"
