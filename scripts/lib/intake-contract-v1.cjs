// Draft-code conformance only, b13442a26d5893073f6e06514839b77da4e5a488.
const {createHmac}=require('node:crypto');
const DETAILS=new Set('website message subject tool consent company_id ticket_kind submitted_email submitted_phone check run_id pages note product product_id plan amount currency order_id booking_id service scheduled_at application_id role organization interest email_confirmed captured_by provider user_id session_id referrer_host'.split(' '));
const ATTRIBUTION=new Set('utm_source utm_medium utm_campaign utm_term utm_content referrer landing_page source campaign referrer_host'.split(' '));
const KINDS=new Set('signup login lead booking purchase application waitlist'.split(' '));
const EMAIL=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function text(v,n){return typeof v==='string'&&v.length<=n;}
function validDraftEvent(e) {
 if(!object(e)||Object.keys(e).some(k=>!['id','kind','property','occurredAt','summary','person','details','attribution','canary','suspectedSpam'].includes(k)))return false;
 if(!text(e.id,128)||!/^[A-Za-z0-9][A-Za-z0-9:_.-]{7,127}$/.test(e.id)||!KINDS.has(e.kind)||!text(e.property,120)||!/^[a-z0-9.-]+(?:\/[a-z0-9._/-]*)?$/.test(e.property)||e.property.length<3)return false;
 if(!text(e.occurredAt,50)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(e.occurredAt)||!Number.isFinite(Date.parse(e.occurredAt))||!text(e.summary,200)||!e.summary.trim())return false;
 if(e.person!==undefined&&(!object(e.person)||Object.entries(e.person).some(([k,v])=>k==='email'?(!text(v,320)||!EMAIL.test(v)):k==='name'?!text(v,120):k==='phone'?(!text(v,40)||!/^[0-9+().\s-]*$/.test(v)):true)))return false;
 if(e.details!==undefined&&(!object(e.details)||Object.entries(e.details).some(([k,v])=>!DETAILS.has(k)||!(v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||text(v,2000)))))return false;
 if(e.attribution!==undefined&&(!object(e.attribution)||Object.entries(e.attribution).some(([k,v])=>!ATTRIBUTION.has(k)||!text(v,300))))return false;
 if(e.canary!==undefined&&typeof e.canary!=='boolean')return false;
 if(e.suspectedSpam!==undefined&&(!object(e.suspectedSpam)||Object.keys(e.suspectedSpam).join(',')!=='reason'||!text(e.suspectedSpam.reason,120)||!e.suspectedSpam.reason.trim()))return false;
 return true;
}
function signBody(secret,timestamp,body){return `v1=${createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex')}`;}
function validAck(value){return object(value)&&value.accepted===true&&typeof value.duplicate==='boolean'&&Object.keys(value).every(k=>['accepted','duplicate'].includes(k));}
module.exports={validDraftEvent,signBody,validAck};
