// Prepared against suede-agent-studio 0b33f45a0bdde87b8e7746666d6200c17d0c4b82.
// No production imports, environment configuration or scheduler. Storage RPCs
// are a separate, unprovisioned prerequisite. Never run against customer data.
const { createHash } = require('node:crypto');
const {validDraftEvent, signBody, validAck, validTimestamp} = require('./intake-contract-v1.cjs');
const HUB = 'https://agents.suedeai.ai/api/intake/events';
const FORMS = Object.freeze({ contact:'lead', 'book-call':'booking', book:'lead', investors:'application' });
function project(form, submissionId, fields, occurredAt) {
  if (!Object.hasOwn(FORMS,form) || !/^[A-Za-z0-9_-]{8,128}$/.test(submissionId)) throw new Error('Invalid capture identity');
  if (!validTimestamp(occurredAt)) throw new Error('Invalid capture time');
  const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
  if (email.length > 320 || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error('Invalid contact address');
  // Minimize values as well as keys: no user free text, URLs, name or attribution
  // is sent. The original contact text remains in the existing capture system.
  return { id:`org:${createHash('sha256').update(`${form}:${submissionId}`).digest('hex')}`,
    kind:FORMS[form], property:'suedeai.org', occurredAt,
    summary:`Org ${form} request`, person:{email},
    details:{ service:form, ...(form === 'investors' ? {consent:fields.consent === true} : {}) } };
}
function configured(config) {
  return config.enabled === true && config.contractVersion === 'v1-draft-0b33f45' &&
    config.url === HUB && config.source === 'suedeai-org' &&
    typeof config.secret === 'string' && Buffer.byteLength(config.secret) >= 32;
}
function assertOrgEvent(event) {
  // Only events produced by the narrow projection are accepted. Do not persist
  // arbitrary event-shaped input under approved-looking detail field names.
  if (!validDraftEvent(event)) throw new Error('Invalid event');
  const keys = Object.keys(event).sort().join(',');
  if (keys !== 'details,id,kind,occurredAt,person,property,summary' ||
      Object.keys(event.person).join(',') !== 'email' ||
      !Object.hasOwn(FORMS,event.details.service) ||
      Object.keys(event.details).some(k=>!['service','consent'].includes(k)) ||
      (event.details.service==='investors' ? typeof event.details.consent!=='boolean' : Object.hasOwn(event.details,'consent'))) throw new Error('Unapproved event');
  const form=event.details.service;
  if (event.property!=='suedeai.org' || event.kind!==FORMS[form] || event.summary!==`Org ${form} request` || !/^org:[a-f0-9]{64}$/.test(event.id)) throw new Error('Unapproved event');
}
async function capture(config, store, event) {
  if (!configured(config)) return {status:'disabled'};
  if (event.canary || event.suspectedSpam) return {status:'excluded'};
  assertOrgEvent(event);
  // Atomic source capture + unique immutable outbox insertion is the adapter's
  // obligation; only return queued after its durable transaction commits.
  await store.capture(JSON.parse(JSON.stringify(event)));
  return {status:'queued'};
}
async function bounded(operation, timeoutMs) {
  const controller = new AbortController(); let timer;
  try {
    return await Promise.race([operation(controller.signal), new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(new Error('Timeout'));},timeoutMs);
    })]);
  } finally {clearTimeout(timer);controller.abort();}
}
async function drain(config, store, fetcher=fetch) {
  if (!configured(config)) return {status:'disabled'};
  // A store must bound claim latency and lease genuine traffic exclusively.
  const records=await bounded(()=>store.claim(10),4000);
  for (const record of records.slice(0,10)) {
    const body=JSON.stringify(record.event);
    let status='retry', code='network'; let retryAfter=0;
    try {
      try { assertOrgEvent(record.event); } catch { status='blocked'; code='invalid-event'; }
      if (status==='blocked') { /* Retain invalid records for repair. */ }
      else if (Buffer.byteLength(body)>65536) {status='blocked';code='oversize';}
      else await bounded(async signal=>{
        const timestamp=String(Math.floor(Date.now()/1000));
        const signature=signBody(config.secret,timestamp,body);
        const response=await fetcher(HUB,{method:'POST',redirect:'error',signal,headers:{'content-type':'application/json','x-suede-intake-source':config.source,'x-suede-intake-timestamp':timestamp,'x-suede-intake-signature':signature},body});
        code=`http-${response.status}`;
        if (response.status===202) {
          const raw=await response.text();
          if (raw.length<=256) {
            const ack=JSON.parse(raw);
            if (validAck(ack)) status='complete';
          }
        } else if ([400,401,413].includes(response.status)) status='blocked';
        else if (response.status===429) {
          const value=response.headers.get('retry-after') || '';
          // Clamp untrusted scheduling hints to a finite 24-hour horizon.
          // Scientific notation and malformed/negative values are not delta seconds.
          if (/^\d+$/.test(value)) retryAfter=Math.min(86400,Number(value))*1000;
          else if (/^[A-Za-z]{3}, /.test(value)) {
            const target=Date.parse(value);
            if (Number.isFinite(target)) retryAfter=Math.min(86400000,Math.max(0,target-Date.now()));
          }
        }
      },Math.max(1,Math.min(config.timeoutMs||4000,4000)));
    } catch { /* Keep failure category only, never response text or PII. */ }
    const delay=Math.max(retryAfter,Math.min(3600000,1000*2**Math.min(record.attempts||0,12))+Math.floor(Math.random()*1000));
    await bounded(()=>store.settle(record.lease,{status,code,nextAttemptAt:status==='retry'?new Date(Date.now()+delay).toISOString():null}),4000);
  }
  return {status:'processed',count:Math.min(records.length,10)};
}
module.exports={project,capture,drain};
