                                                                                  
                                                                                
                                                                          
   
function frostSettings() {
  const p = PropertiesService.getScriptProperties();
  const formId = p.getProperty('FROST_FORM_ID');
  const origin = p.getProperty('FROST_DISPENSER_ORIGIN');
  const secret = p.getProperty('FROST_FORMS_SECRET');
  if (!formId || !/^https:\/\/[a-z0-9.-]+$/.test(origin || '') || !secret || secret.length < 32) throw new Error('Set the three Frost Script Properties first.');
  return {p, formId, origin, secret};
}
function frostVerifiedForm(settings) {
  const response = UrlFetchApp.fetch('https://forms.googleapis.com/v1/forms/' + encodeURIComponent(settings.formId), {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Could not inspect Form settings. Enable the Forms API and authorize the script.');
  if (JSON.parse(response.getContentText()).settings?.emailCollectionType !== 'VERIFIED') throw new Error('Frost requires VERIFIED email collection. Change the Form settings before continuing.');
}
function installFrostTriggers() {
  const settings = frostSettings(); frostVerifiedForm(settings);
  const existing = ScriptApp.getProjectTriggers();
  if (!existing.some(t => t.getHandlerFunction() === 'frostFormSubmitted')) ScriptApp.newTrigger('frostFormSubmitted').forForm(settings.formId).onFormSubmit().create();
  if (!existing.some(t => t.getHandlerFunction() === 'retryFrostVerifications')) ScriptApp.newTrigger('retryFrostVerifications').timeBased().everyMinutes(5).create();
}
                                                                         
function verifyFrostFormConfiguration() {
  const formId = PropertiesService.getScriptProperties().getProperty('FROST_FORM_ID');
  if (!formId) throw new Error('Set FROST_FORM_ID first.');
  frostVerifiedForm({formId});
  console.log('Verified email collection confirmed.');
}
function frostFormSubmitted(event) {
  const settings = frostSettings();
  if (!event?.response || event.source.getId() !== settings.formId) throw new Error('Unexpected form event.');
  const answers = event.response.getItemResponses().filter(r => r.getItem().getTitle() === 'Frost verification code');
  const correlation = answers.length === 1 ? String(answers[0].getResponse()).trim() : '';
  const email = event.response.getRespondentEmail();
  if (!/^[A-Za-z0-9_-]{43}$/.test(correlation) || !email) { console.warn('Frost verification rejected: missing email or invalid code format.'); return; }
                                                                                
  const payload = {formId: settings.formId, eventId: event.response.getId(), correlation, email};
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { settings.p.setProperty('pending:' + payload.eventId, JSON.stringify({at: Date.now(), payload})); }
  finally { lock.releaseLock(); }
  retryFrostVerifications();
}
function frostHex(bytes) { return bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
                                                                                      
function verifyFrostConnection() {
  const settings = frostSettings(); frostVerifiedForm(settings);
  const body = '{}', timestamp = String(Math.floor(Date.now() / 1000));
  const digest = frostHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, body, Utilities.Charset.UTF_8));
  const signature = frostHex(Utilities.computeHmacSha256Signature(timestamp + '\n' + digest, settings.secret, Utilities.Charset.UTF_8));
  const response = UrlFetchApp.fetch(settings.origin + '/forms/verified', {method: 'post', contentType: 'application/json', payload: body, headers: {'X-Frost-Time': timestamp, 'X-Frost-Signature': signature, 'X-Amz-Content-Sha256': digest}, muteHttpExceptions: true, followRedirects: false});
  if (response.getResponseCode() !== 400 || JSON.parse(response.getContentText()).error !== 'Invalid verification event.') throw new Error('Webhook connection check failed; HTTP ' + response.getResponseCode());
  console.log('Signed webhook connection confirmed.');
  console.log('Responder URL: ' + FormApp.openById(settings.formId).getPublishedUrl());
}
function retryFrostVerifications() {
  const settings = frostSettings(), pending = settings.p.getProperties();
                                                                          
                                                                       
  if (Object.keys(pending).some(k => k.startsWith('pending:'))) frostVerifiedForm(settings);
  let failures = 0;
                                                                        
  Object.keys(pending).filter(k => k.startsWith('pending:')).slice(0, 30).forEach(key => {
    let item;
    try { item = JSON.parse(pending[key]); }
    catch (_) { settings.p.deleteProperty(key); console.warn('Frost delivery: discarded unreadable queued item.'); return; }
    if (!item || !Number.isFinite(item.at) || !item.payload) { settings.p.deleteProperty(key); console.warn('Frost delivery: discarded invalid queued item.'); return; }
    if (Date.now() - item.at > 20 * 60000) {
      settings.p.deleteProperty(key); console.warn('Frost delivery: queued verification expired; request a new code.'); return;
    }
    const body = JSON.stringify(item.payload), timestamp = String(Math.floor(Date.now() / 1000));
    const digest = frostHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, body, Utilities.Charset.UTF_8));
    const signature = frostHex(Utilities.computeHmacSha256Signature(timestamp + '\n' + digest, settings.secret, Utilities.Charset.UTF_8));
    let response;
    try { response = UrlFetchApp.fetch(settings.origin + '/forms/verified', {method: 'post', contentType: 'application/json', payload: body, headers: {'X-Frost-Time': timestamp, 'X-Frost-Signature': signature, 'X-Amz-Content-Sha256': digest}, muteHttpExceptions: true, followRedirects: false}); }
    catch (_) { failures++; console.warn('Frost delivery: network failure; retained for retry.'); return; }
    const status = response.getResponseCode();
    let data = {};
    try { data = JSON.parse(response.getContentText()); } catch (_) {}
    if (status === 200 && data?.ok === true) {
      settings.p.deleteProperty(key); console.log('Frost delivery: verified.'); return;
    }
    const permanent = {
      400: ['Invalid verification event.', 'Verified email does not match registration.'],
      409: ['This verification was already submitted. Start again if needed.', 'Username reservation expired. Start again.'],
      410: ['Registration expired.']
    };
    if ((permanent[status] || []).includes(data?.error)) {
      settings.p.deleteProperty(key);
      console.warn(data.error === 'Verified email does not match registration.' ? 'Frost delivery: email mismatch; use the same Google account and resubmit.' : 'Frost delivery: invalid, expired or already completed verification; request a fresh code.');
      return;
    }
                                                                                 
                                                              
    failures++; console.warn('Frost delivery: HTTP ' + status + '; retained for retry.');
  });
  if (failures) throw new Error('Frost verification delivery needs attention: ' + failures + ' queued item(s) retained. Check service health and webhook authorization.');
}
