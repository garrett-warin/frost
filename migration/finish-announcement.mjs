import {invokeBridge} from './bridge.mjs';
const result=await invokeBridge({path:'/publish',body:{message:'Frost has moved to our new server. If a page is stuck, reload it. Please refrain from sharing Frost with your friends temporarily.'}});
if(result.statusCode!==200)throw Error('Announcement update failed');
console.log('Migration completion announcement published');
