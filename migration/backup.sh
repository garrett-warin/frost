#!/bin/bash
set -euo pipefail
umask 077
exec 9>/run/frost-backup.lock
flock -n 9 || exit 0
root=/opt/frost/backups
mkdir -p "$root"
target="$root/production-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
trap 'rm -f "$target.partial"' EXIT
docker exec frost-production-db-1 pg_dump -U frost -d frost -Fc | age -R /opt/frost/backup-recipient.txt -o "$target.partial"
test -s "$target.partial"
mv "$target.partial" "$target"
echo "Encrypted Frost database backup completed"
