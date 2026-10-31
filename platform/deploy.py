"""Provision the isolated dispenser without enabling live browsing integration."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess

os.umask(0o077)
os.environ.update(AWS_PAGER="", AWS_DEFAULT_REGION="us-east-1", AWS_REGION="us-east-1")

def aws(*args):
    return subprocess.check_output(["aws", *args], text=True).strip()

account = json.loads(aws("sts", "get-caller-identity"))["Account"]
stack_probe = subprocess.run(["aws", "cloudformation", "describe-stacks", "--stack-name", "frost-accounts"], capture_output=True, text=True)
stack_exists = stack_probe.returncode == 0
if not stack_exists and "does not exist" not in stack_probe.stderr:
    raise SystemExit("Could not determine existing stack state; no changes made.")
secret_path = Path.home() / ".frost-account-secrets.json"
if stack_exists and not secret_path.exists():
    raise SystemExit("Existing account stack has no local key backup. Restore the original keys; refusing to rotate them.")
bucket = f"frost-account-artifacts-{account}-us-east-1"
if subprocess.run(["aws", "s3api", "head-bucket", "--bucket", bucket], capture_output=True).returncode:
    aws("s3api", "create-bucket", "--bucket", bucket, "--region", "us-east-1")
aws("s3api", "put-public-access-block", "--bucket", bucket, "--public-access-block-configuration",
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true")
if not secret_path.exists():
    with secret_path.open("x") as stream:
        json.dump({"InternalSecret": secrets.token_hex(32), "FormsSecret": secrets.token_hex(32),
                   "VaultKey": base64.b64encode(secrets.token_bytes(32)).decode()}, stream)
secret_path.chmod(0o600)
private = json.loads(secret_path.read_text())
code_hash = hashlib.sha256(Path("lambda.zip").read_bytes()).hexdigest()
aws("s3", "cp", "lambda.zip", f"s3://{bucket}/{code_hash}.zip", "--only-show-errors")
parameters = [{"ParameterKey": key, "ParameterValue": value} for key, value in {
    **private, "CodeBucket": bucket, "CodeKey": code_hash + ".zip",
    "FormId": "173OvEpu6bqDcWHVrsqFyYCo1Gn6hVc0dF7bc_OLa2K4", **({} if stack_exists else {"FormUrl": ""})
}.items()]
parameter_path = Path.home() / ".frost-account-parameters.json"
parameter_path.write_text(json.dumps(parameters))
parameter_path.chmod(0o600)
try:
    subprocess.run(["aws", "cloudformation", "deploy", "--stack-name", "frost-accounts",
                    "--template-file", "stack.json", "--capabilities", "CAPABILITY_IAM",
                    "--parameter-overrides", "file://" + str(parameter_path),
                    "--no-fail-on-empty-changeset"], check=True)
finally:
    parameter_path.unlink(missing_ok=True)
outputs = {row["OutputKey"]: row["OutputValue"] for row in
           json.loads(aws("cloudformation", "describe-stacks", "--stack-name", "frost-accounts"))["Stacks"][0]["Outputs"]}
Path("outputs.json").write_text(json.dumps(outputs, indent=2))
settings = {"origin": "https://" + outputs["Domain"], "endpoints": ["https://frost-browsing.fly.dev"]}
item = {"id": {"S": "deployment-config"}, "v": {"N": "1"}, "payload": {"S": json.dumps(settings)},
        "kind": {"S": "internal"}, "sort": {"S": "deployment-config"}}
existing = json.loads(aws("dynamodb", "get-item", "--table-name", outputs["Table"],
                         "--key", '{"id":{"S":"deployment-config"}}', "--consistent-read") or "{}")
if "Item" not in existing:
    aws("dynamodb", "put-item", "--table-name", outputs["Table"], "--item", json.dumps(item),
        "--condition-expression", "attribute_not_exists(id)")
print("Dispenser infrastructure ready at " + settings["origin"])
print("Registration remains disabled until Form wiring and end-to-end checks are complete.")

