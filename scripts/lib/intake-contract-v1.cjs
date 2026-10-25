// Draft-code conformance only, 0b33f45a0bdde87b8e7746666d6200c17d0c4b82.
const {createHmac}=require('node:crypto');
const DETAILS=new Set('website message subject tool consent company_id ticket_kind submitted_email submitted_phone check run_id pages note product product_id plan amount currency order_id booking_id service scheduled_at application_id role organization interest email_confirmed captured_by provider user_id session_id referrer_host'.split(' '));
const ATTRIBUTION=new Set('utm_source utm_medium utm_campaign utm_term utm_content referrer landing_page source campaign referrer_host'.split(' '));
const KINDS=new Set('signup login lead booking purchase application waitlist'.split(' '));
const EMAIL=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function text(v,n){return typeof v==='string'&&v.length<=n;}
function validTimestamp(value) {
 if (!text(value,50)) return false;
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
 if (!match) return false;
 const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
 const offsetHour=Number(match[7] || 0), offsetMinute=Number(match[8] || 0);
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return month>=1&&month<=12&&day>=1&&day<=days[month-1]&&hour<24&&minute<60&&second<60&&
   offsetHour<24&&offsetMinute<60&&Number.isFinite(Date.parse(value));
}
function validDraftEvent(e) {
 if(!object(e)||Object.keys(e).some(k=>!['id','kind','property','occurredAt','summary','person','details','attribution','canary','suspectedSpam'].includes(k)))return false;
 if(!text(e.id,128)||!/^[A-Za-z0-9][A-Za-z0-9:_.-]{7,127}$/.test(e.id)||!KINDS.has(e.kind)||!text(e.property,120)||!/^[a-z0-9.-]+(?:\/[a-z0-9._/-]*)?$/.test(e.property)||e.property.length<3)return false;
 if(!validTimestamp(e.occurredAt)||!text(e.summary,200)||!e.summary.trim())return false;
 if(e.person!==undefined&&(!object(e.person)||Object.entries(e.person).some(([k,v])=>k==='email'?(!text(v,320)||!EMAIL.test(v)):k==='name'?!text(v,120):k==='phone'?(!text(v,40)||!/^[0-9+().\s-]*$/.test(v)):true)))return false;
 if(e.details!==undefined&&(!object(e.details)||Object.entries(e.details).some(([k,v])=>!DETAILS.has(k)||!(v===null||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||text(v,2000)))))return false;
 if(e.attribution!==undefined&&(!object(e.attribution)||Object.entries(e.attribution).some(([k,v])=>!ATTRIBUTION.has(k)||!text(v,300))))return false;
 if(e.canary!==undefined&&typeof e.canary!=='boolean')return false;
 if(e.suspectedSpam!==undefined&&(!object(e.suspectedSpam)||Object.keys(e.suspectedSpam).join(',')!=='reason'||!text(e.suspectedSpam.reason,120)||!e.suspectedSpam.reason.trim()))return false;
 return true;
}
function signBody(secret,timestamp,body){return `v1=${createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex')}`;}
function validAck(value){return object(value)&&value.accepted===true&&typeof value.duplicate==='boolean'&&Object.keys(value).every(k=>['accepted','duplicate'].includes(k));}
module.exports={validDraftEvent,signBody,validAck,validTimestamp};
