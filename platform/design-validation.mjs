import {PNG} from 'pngjs';
import {validateDesign} from '../public/customize/schema.mjs';
export function normalizeDesign(input){const design=validateDesign(input);for(const [id,url] of Object.entries(design.images)){try{const bytes=Buffer.from(url.slice(22),'base64');if(bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error();validateChunks(bytes);const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>1024||h>1024||w*h>1048576||bytes[28]!==0)throw Error();const decoded=PNG.sync.read(bytes,{checkCRC:true});const encoded=PNG.sync.write(decoded,{colorType:6});design.images[id]='data:image/png;base64,'+encoded.toString('base64');}catch{throw Object.assign(new Error('Invalid image. Upload a PNG, JPEG or WebP through the editor.'),{status:400});}}return validateDesign(design);}

function validateChunks(bytes){
 let offset=8,headers=0,ended=false,data=false;
 while(offset<bytes.length){if(offset+12>bytes.length)throw Error();const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);if(length>bytes.length-offset-12)throw Error();if(offset===8&&(type!=='IHDR'||length!==13))throw Error();if(type==='IHDR'&&++headers!==1)throw Error();if(type==='IDAT')data=true;if(type==='IEND'){if(length!==0||offset+12!==bytes.length)throw Error();ended=true;}offset+=length+12;}
 if(headers!==1||!ended||!data)throw Error();
}
