export function cleanMaintenance(body, now=Date.now()) {
 if(body?.enabled===false)return {enabled:false};
 if(body?.enabled!==true||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>300)throw Error('Enter a reason of up to 300 characters.');
 if(!Number.isSafeInteger(body.startsAt)||!Number.isSafeInteger(body.endsAt)||body.startsAt<=0||body.endsAt<=body.startsAt||body.endsAt<=now||body.endsAt>now+366*86400000)throw Error('Choose a start and later end time within the next year.');
 const type=body.type??'maintenance';if(!['maintenance','disruption'].includes(type))throw Error('Choose Maintenance or Service disruption.');
 return {enabled:true,type,reason:body.reason.trim(),startsAt:body.startsAt,endsAt:body.endsAt};
}
