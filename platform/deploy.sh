#!/usr/bin/env bash
set -euo pipefail
export AWS_PAGER="" AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
cd "$(dirname "$0")"
                                                                               
python3 deploy.py
