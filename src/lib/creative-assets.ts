import sharp from 'sharp';import {createHash} from 'node:crypto';
export const assetLimits={image:2000000,video:4000000,workspace:30000000,count:50};
export function assetMetadata(input:unknown){
 if(!input||typeof input!=='object')throw Error('asset_metadata');const x=input as {title:string;tags:string;notes:string;source?:string};
 if(typeof x.title!=='string'||!x.title.trim()||x.title.length>100||/[\x00-\x1f\x7f]/.test(x.title)||typeof x.tags!=='string'||x.tags.length>250||typeof x.notes!=='string'||x.notes.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(x.notes))throw Error('asset_metadata');
 const tags=[...new Set(x.tags.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean))];if(tags.length>8||tags.some(t=>t.length>24||! /^[\p{L}\p{M}\p{N} _-]+$/u.test(t)))throw Error('asset_tags');
 if(x.source!==undefined&&!['upload','ai_image'].includes(x.source))throw Error('asset_source');return {title:x.title.trim(),tags,notes:x.notes.trim(),source:x.source??'upload'};
}
export function videoType(bytes:Uint8Array){
 const b=Buffer.from(bytes);if(b.length>=24&&b.toString('ascii',4,8)==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V '].includes(b.toString('ascii',8,12))){const size=b.readUInt32BE(0);if(size>=16&&size<=b.length)return 'video/mp4' as const;}
 if(b.length>=16&&b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))&&b.subarray(4,Math.min(b.length,4096)).includes(Buffer.from('webm')))return 'video/webm' as const;
 return null;
}
export async function prepareAsset(bytes:Uint8Array,claimed:string){
 const b=Buffer.from(bytes);if(!b.length||b.length>assetLimits.video)throw Error('asset_size');
 if(claimed.startsWith('video/')){const mime=videoType(b);if(!mime||mime!==claimed)throw Error('asset_format');return {kind:'video' as const,mime,bytes:b,thumbnail:null as Buffer|null,width:null as number|null,height:null as number|null,hash:createHash('sha256').update(b).digest('hex')};}
 if(b.length>assetLimits.image)throw Error('asset_size');
 const jpeg=b[0]===255&&b[1]===216&&b[2]===255,png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
 if(!((jpeg&&claimed==='image/jpeg')||(png&&claimed==='image/png')||(webp&&claimed==='image/webp')))throw Error('asset_format');
 const decoder=sharp(b,{limitInputPixels:16000000,failOn:'warning'});const metadata=await decoder.metadata();if(!metadata.width||!metadata.height||metadata.width>8192||metadata.height>8192||(metadata.pages??1)>1)throw Error('asset_dimensions');
 const output=await decoder.rotate().webp({quality:90}).toBuffer({resolveWithObject:true});if(output.data.length>assetLimits.image)throw Error('asset_size');
 const thumbnail=await sharp(output.data).resize({width:320,height:240,fit:'inside',withoutEnlargement:true}).webp({quality:70}).toBuffer();if(thumbnail.length>100000)throw Error('asset_thumbnail');
 return {kind:'image' as const,mime:'image/webp',bytes:output.data,thumbnail,width:output.info.width,height:output.info.height,hash:createHash('sha256').update(output.data).digest('hex')};
}
export function mediaRange(header:string|null,length:number){
 if(!header)return null;const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))throw Error('asset_range');let start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2])),end=match[1]&&match[2]?Math.min(Number(match[2]),length-1):length-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=length||end<start)throw Error('asset_range');return {start,end};
}
