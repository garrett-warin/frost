import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
const args = process.argv.slice(2);
let message;
if (args.length === 1 && args[0] === '--clear') message = '';
else if (args.length === 2 && args[0] === '--file') message = (await readFile(args[1], 'utf8')).trim();
else { console.error('Publish: npm run announce -- --file announcement.txt\nRemove banner: npm run announce -- --clear'); process.exit(1); }
if (message.length > 1000) throw new Error('Keep announcements to 1,000 characters or fewer.');
const cli = process.env.FLYCTL_PATH || (process.platform === 'win32' ? join(homedir(), '.fly', 'bin', 'flyctl.exe') : 'flyctl');
// Authorization belongs to the owner's Fly account. There is no web write API.
const result = spawnSync(cli, ['secrets', 'set', `FROST_ANNOUNCEMENT=${message}`, '--app', 'frost-browsing'], {stdio:'inherit', shell:false});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
