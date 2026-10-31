#!/usr/bin/env bash
set -euo pipefail
export AWS_PAGER="" AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
cd "$(dirname "$0")"
# Run from the generated package in AWS CloudShell. Never enable shell tracing.
python3 deploy.py
