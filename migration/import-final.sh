#!/bin/bash
set -euo pipefail
umask 077
test -f /opt/frost/production/gate/paused
cd /home/debian/frost-import
echo '2122bf4fc2c1d67de55312b407c2f5bcca2bc7e4f0fbfa8f4ce63cf4bb663744  accounts-final.jsonl' | sha256sum -c -
echo '762bacf0590feb45f6956649c480e22174f178b92b414aa2a606596903efeaa7  admin-final.jsonl' | sha256sum -c -
install -m 600 accounts-final.jsonl admin-final.jsonl /opt/frost/production/
for role in accounts admin; do
  docker run --rm --network frost-production_backend --env-file /opt/frost/production/tools.env -v /opt/frost/production:/migration:ro -w /migration/app node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 node import-state.mjs "$role" "/migration/$role-final.jsonl"
  docker run --rm --network frost-production_backend --env-file /opt/frost/production/tools.env -v /opt/frost/production:/migration:ro -w /migration/app node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 node verify-state.mjs "$role" "/migration/$role-final.jsonl"
done
touch /opt/frost/production/final-import-verified
