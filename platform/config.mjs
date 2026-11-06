import {hmac} from './security.mjs';
export function settingsForAccountHost(settings,host){
 const allowed=[settings.origin,...(settings.accountAliases||[])];
 if(allowed.length>4||new Set(allowed).size!==allowed.length)throw Error('Invalid account aliases.');
 for(const value of allowed){const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value||url.username||url.password)throw Error('Invalid account origin.');}
 if(!host)return settings;
 const selected=allowed.find(value=>new URL(value).host===host);
 if(!selected)throw Error('Unregistered account host.');
 return {...settings,origin:selected};
}
export function platformConfig(env,settings){
 const origin=value=>{const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value||url.username||url.password)throw Error('Use an exact HTTPS origin.');return value;};
 const config={
                                                                 
  historyCollectionEnabled:true,
  browseSecret:env.FROST_INTERNAL_SECRET?hmac(env.FROST_INTERNAL_SECRET,'browse-gate-v1'):'',origin:origin(settings.origin),endpoints:settings.endpoints.map(origin),internalSecret:env.FROST_INTERNAL_SECRET,formsSecret:env.FROST_FORMS_SECRET||'',vaultKey:env.FROST_VAULT_KEY||'',
  formId:env.FROST_FORM_ID||'',formUrl:env.FROST_FORM_URL||'',
  trustCloudFront:true,assignedOnly:true,reportWindowSeconds:900,reportLimit:3,reportCooldownSeconds:900,reportWarningScore:2,
  failureThreshold:3,recoveryThreshold:2,slowThresholdMs:2000,monitorIntervalSeconds:300,probeTimeoutMs:5000,
 };
 if(!config.endpoints.length||config.endpoints.length>20||new Set(config.endpoints).size!==config.endpoints.length||config.endpoints.includes(config.origin))throw Error('Configure distinct browsing endpoints.');
 if(config.internalSecret?.length<32||!config.internalSecret)throw Error('Missing internal service secret.');
 if(config.formsSecret&&config.formsSecret.length<32)throw Error('Invalid form webhook secret.');
 if(config.vaultKey&&Buffer.from(config.vaultKey,'base64').length!==32)throw Error('Invalid account storage key.');
 if(config.formUrl){const url=new URL(config.formUrl);if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/forms/')||url.search||url.hash)throw Error('Use the public Google Form URL without query parameters.');}
 return config;
}
