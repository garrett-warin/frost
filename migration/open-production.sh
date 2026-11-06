#!/bin/bash
                                                                                  
set -euo pipefail
umask 077
cd /opt/frost/production
test -f final-import-verified
test -f gate/paused
date -u +%FT%TZ > opened-at.txt
sed -i 's/^FROST_JOBS_ENABLED=false$/FROST_JOBS_ENABLED=true/' accounts.env
docker compose up -d accounts
rm gate/paused
echo 'OVH gateway opened; scheduled jobs enabled'
