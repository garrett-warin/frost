#!/usr/bin/env bash
set -euo pipefail
export AWS_PAGER=""
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
cd "$(dirname "$0")"
account=$(aws sts get-caller-identity --query Account --output text)
bucket="frost-admin-artifacts-${account}-us-east-1"
if ! aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
 aws s3api create-bucket --bucket "$bucket" --region us-east-1 >/dev/null
 aws s3api put-public-access-block --bucket "$bucket" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi
if [ ! -f "$HOME/.frost-admin-setup" ]; then
 (umask 077; python3 -c 'import secrets; print(secrets.token_urlsafe(32))' > "$HOME/.frost-admin-setup")
fi
setup_hash=$(python3 -c 'import hashlib,pathlib; print(hashlib.sha256(pathlib.Path.home().joinpath(".frost-admin-setup").read_text().strip().encode()).hexdigest())')
code_hash=$(sha256sum lambda.zip | cut -d' ' -f1)
aws s3 cp lambda.zip "s3://${bucket}/${code_hash}.zip" --only-show-errors
aws cloudformation deploy --region us-east-1 --stack-name frost-admin --template-file stack.json --capabilities CAPABILITY_IAM --parameter-overrides "CodeBucket=${bucket}" "CodeKey=${code_hash}.zip" "SetupHash=${setup_hash}" --no-fail-on-empty-changeset
aws cloudformation describe-stacks --stack-name frost-admin --query 'Stacks[0].Outputs' --output json > outputs.json
python3 - <<'PY'
import json,subprocess,pathlib
outputs={x['OutputKey']:x['OutputValue'] for x in json.load(open('outputs.json'))}
origin='https://'+outputs['AdminDomain']
subprocess.run(['aws','dynamodb','put-item','--table-name',outputs['Table'],'--item',json.dumps({'id':{'S':'config'},'origin':{'S':origin}})],check=True)
print('FROST_ADMIN_URL='+origin)
print('FROST_DISTRIBUTION_ID='+outputs['AdminDistributionId'])
# The one-time enrollment link stays in a private CloudShell file.
path=pathlib.Path.home()/'.frost-admin-enrollment-url'
path.write_text(origin+'/#setup='+pathlib.Path.home().joinpath('.frost-admin-setup').read_text().strip())
path.chmod(0o600)
print('Enrollment link prepared privately in ~/.frost-admin-enrollment-url')
PY

