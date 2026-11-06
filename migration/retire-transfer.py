"""Remove only the migration-specific temporary SFTP authorization."""
import pathlib,os
p=pathlib.Path('/home/debian/.ssh/authorized_keys')
lines=p.read_text().splitlines()
matched=[line for line in lines if line.endswith(' frost-ovh-transfer')]
assert len(matched)==1,'Unexpected transfer-key count; inspect privately'
remaining=[line for line in lines if line not in matched]
assert remaining,'Never remove the owner SSH key'
p.write_text('\n'.join(remaining)+'\n');os.chmod(p,0o600)
print('Temporary CloudShell transfer authorization removed; owner key retained')
