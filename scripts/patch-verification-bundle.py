"""Narrow patch for the backed-up pre-fix account bundle; fails on source drift."""
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()
start = s.index('async function verifiedEvent(body)')
end = s.index('async function registrationStatus(poll)', start)
part = s[start:end]
def once(text, before, after):
    assert text.count(before) == 1, 'Patch target missing or ambiguous'
    return text.replace(before, after, 1)
part = once(part, 'const verified = { status: "verified" };', 'const verified = { status: "verified", verificationError: null };')
part = once(part, 'return atomic(store, async (tx) => {', 'const result = await atomic(store, async (tx) => {')
part = once(part, 'requireThat(live(pending) && pending.email === email, 400, "Verified email does not match registration.");', 'requireThat(live(pending), 410, "Registration expired.");')
marker = 'requireThat(pending.status === "pending", 409, "This verification was already submitted. Start again if needed.");'
part = once(part, marker, marker + '\n      if (pending.email !== email) { await tx.put("pending:" + proof.pending, {...pending, verificationError: "EMAIL_MISMATCH"}); return {mismatch: true}; }')
assert part.endswith('    });\n  }\n  ')
part = part[:-len('    });\n  }\n  ')] + '    });\n    requireThat(!result.mismatch, 400, "Verified email does not match registration.");\n    return result;\n  }\n  '
s = s[:start] + part + s[end:]
s = once(s, 'return { status: pending.status };', 'return { status: pending.status, ...(pending.status === "pending" && pending.verificationError === "EMAIL_MISMATCH" ? {errorCode: "EMAIL_MISMATCH"} : {}) };')
marker = "const result=await api('/api/register/status');if(epoch!==verificationEpoch)return;"
line = "if(result.errorCode==='EMAIL_MISMATCH')message('The Google account used in the Form does not match the email entered here. Switch Google accounts and submit this code again, or go back and use a different email.',true);"
s = once(s, marker, marker + '\\r\\n  ' + line)
p.write_text(s)
print('Patched verification handler, polling response, and waiting UI only.')
