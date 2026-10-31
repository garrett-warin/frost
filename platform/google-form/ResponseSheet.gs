// Private owner script. Reads only the linked Frost response sheet; never publish.
function syncFrostResponseSheet() {
 const settings=frostSettings(),sheetId='1Q_M7yfHg4A6tiDBQhXwLUTnrVFNSkTGSxir3qDt8Too';
 if(FormApp.openById(settings.formId).getDestinationId()!==sheetId)throw new Error('The Frost Form is linked to a different sheet.');
 const capturedAt=Date.now();
 const range="'Form Responses 1'!A1:C100001";
 const sheetResponse=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
 if(sheetResponse.getResponseCode()!==200)throw new Error('Could not read response sheet; HTTP '+sheetResponse.getResponseCode()+'. Enable the Sheets API and authorize read-only access.');
 const cells=JSON.parse(sheetResponse.getContentText()).values||[];
 if(cells.length>=100001)throw new Error('Response sheet exceeds the supported 100,000-row read window.');
 const headers=(cells[0]||[]).map(v=>String(v).trim().toLowerCase());
 const timeCol=headers.indexOf('timestamp'),emailCol=headers.indexOf('email address'),codeCol=headers.indexOf('frost verification code');
 if([timeCol,emailCol,codeCol].some(v=>v<0))throw new Error('Response headers changed.');
 const total=Math.max(0,cells.length-1),first=Math.max(2,total+2-100),values=cells.slice(first-1);
 const rows=values.map((r,index)=>({row:first+index,submittedAt:r[timeCol]||'',email:r[emailCol]||'',codeSuffix:/^[A-Za-z0-9_-]{43}$/.test(r[codeCol])?r[codeCol].slice(-6):''})).filter(r=>r.email).reverse();
 const body=JSON.stringify({kind:'sheet-responses-v1',formId:settings.formId,sheetId,capturedAt,total,rows}),timestamp=String(Math.floor(Date.now()/1000)),path='/forms/responses';
 const digest=frostHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,body,Utilities.Charset.UTF_8));
 const signature=frostHex(Utilities.computeHmacSha256Signature(timestamp+'\n'+path+'\n'+digest,settings.secret,Utilities.Charset.UTF_8));
 const response=UrlFetchApp.fetch(settings.origin+path,{method:'post',contentType:'application/json',payload:body,headers:{'X-Frost-Time':timestamp,'X-Frost-Signature':signature,'X-Amz-Content-Sha256':digest},muteHttpExceptions:true,followRedirects:false});
 if(response.getResponseCode()!==200)throw new Error('Sheet sync failed; HTTP '+response.getResponseCode());
 console.log('Response sheet sync completed. Rows: '+rows.length);
}
function installFrostResponseSheetSync(){
 syncFrostResponseSheet();
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='syncFrostResponseSheet'))ScriptApp.newTrigger('syncFrostResponseSheet').timeBased().everyMinutes(5).create();
 console.log('Private response-sheet sync enabled.');
}
