const test = require('node:test');
const assert = require('node:assert/strict');
const { capture, drain, project } = require('../scripts/lib/intake-sender.cjs');
const config = { enabled: true, contractVersion:'v1-draft-0b33f45', secret: 'x'.repeat(32), url: 'https://agents.suedeai.ai/api/intake/events', source: 'suedeai-org' };
const event = () => project('contact', 'submission-123', { email: 'person@example.com', password: 'secret', message: 'token=secret', topic: 'Hello' }, '2026-10-25T12:00:00Z');
test('projection excludes body keys and free text; IDs remain stable', () => {
 assert.deepEqual(event(), event()); assert.equal(event().details.subject, undefined);
 assert.equal(JSON.stringify(event()).includes('secret'), false);
 assert.throws(() => project('unknown','submission-123',{},'2026-10-25T12:00:00Z'));
});
test('capture is disabled by default and excludes spam/canary', async () => {
 let calls = 0; const store = { capture: async () => calls++ };
 await capture({}, store, event());
 await capture(config, store, { ...event(), canary:true });
 await capture(config, store, { ...event(), suspectedSpam:{reason:'spam'} });
 assert.equal(calls, 0);
 await capture(config, store, event()); assert.equal(calls, 1);
});
test('only valid 202 completes; authentication errors remain repairable', async () => {
 for (const [status, body, expected] of [[202,{accepted:true,duplicate:false},'complete'],[202,{},'retry'],[200,{accepted:true,duplicate:false},'retry'],[401,{},'blocked'],[503,{},'retry'],[429,{},'retry']]) {
  let saved; const store = { claim: async () => [{event:event(),lease:'lease1',attempts:0}], settle: async (_,state) => {saved=state;} };
  await drain(config, store, async (_, init) => {assert.match(init.headers['x-suede-intake-signature'],/^v1=/); return new Response(JSON.stringify(body),{status});});
  assert.equal(saved.status,expected);
 }
});
test('stalled delivery has bounded timeout and retained retry', async () => {
 let saved; const store={claim:async()=>[{event:event(),lease:'lease',attempts:0}],settle:async(_,s)=>saved=s};
 await drain({...config,timeoutMs:10},store,async()=>new Promise(()=>{}));
 assert.equal(saved.status,'retry');
});
test('RPC adapter stays unconfigured and verifies durable/CAS acknowledgments', async () => {
 const {createRpcStore}=require('../scripts/lib/intake-rpc-store.cjs');
 assert.equal(createRpcStore(),null);
 const config={storageApproved:true,storageUrl:'https://project.supabase.co',storageKey:'synthetic-only'};
 const store=createRpcStore(config,async()=>new Response('{}',{status:200}));
 await assert.rejects(()=>store.capture(event()),/durable/);
 await assert.rejects(()=>store.settle('lease',{status:'complete'}),/conflict/);
});
test('restarting worker retains identical event content after wrong-secret repair', async () => {
 const persisted={event:event(),lease:'first-lease',attempts:0}; let state;
 const store={capture:async value=>assert.deepEqual(value,persisted.event),claim:async()=>[persisted],settle:async(_,s)=>{state=s;}};
 const bodies=[];
 await capture(config,store,event());
 await drain(config,store,async(_,i)=>{bodies.push(i.body);return new Response('{}',{status:401});});
 assert.equal(state.status,'blocked');
 // An authorized storage repair clears the persisted block without changing
 // immutable event identity/content; then a fresh worker retries it.
 await drain({...config,secret:'y'.repeat(32)},store,async(_,i)=>{bodies.push(i.body);return new Response('{"accepted":true,"duplicate":true}',{status:202});});
 assert.equal(state.status,'complete'); assert.equal(bodies[0],bodies[1]);
});
test('shared pinned contract fixture valid/invalid/HMAC/ACK conformance',()=>{
 const fixture=require('./fixtures/intake-contract-v1.json');
 const {validDraftEvent,signBody,validAck}=require('../scripts/lib/intake-contract-v1.cjs');
 for(const value of fixture.valid) assert.equal(validDraftEvent(value),true);
 for(const {name,event} of fixture.invalid) assert.equal(validDraftEvent(event),false,name);
 assert.equal(signBody(fixture.signing.secret,fixture.signing.timestamp,fixture.signing.body),fixture.signing.signature);
 for(const ack of fixture.acknowledgements.accepted) assert.equal(validAck(ack),true);
 for(const ack of fixture.acknowledgements.rejected) assert.equal(validAck(ack),false);
});
test('unapproved stored content blocks before network and preserves record for repair',async()=>{
 let sent=0,state;
 const store={claim:async()=>[{event:{...event(),details:{service:'contact',message:'secret'}},lease:'test',attempts:0}],settle:async(_,s)=>state=s};
 await drain(config,store,async()=>{sent++;});
 assert.equal(sent,0);assert.equal(state.status,'blocked');
});
test('official hub v1 signing fixture reproduced unchanged; tamper differs',()=>{
 const vector=require('./fixtures/owner-v1-signing.json');
 const {signBody,validDraftEvent}=require('../scripts/lib/intake-contract-v1.cjs');
 assert.equal(signBody(vector.secret,vector.timestamp,vector.rawBody),vector.signature);
 assert.notEqual(signBody(vector.secret,vector.timestamp,vector.rawBody+' '),vector.signature);
 assert.equal(validDraftEvent(JSON.parse(vector.rawBody)),true);
});
test('calendar-invalid timestamps are rejected by projection and draft validation',()=>{
 const {validDraftEvent}=require('../scripts/lib/intake-contract-v1.cjs');
 for(const occurredAt of ['2026-02-30T12:00:00Z','2025-02-29T12:00:00Z','2026-04-31T12:00:00Z','2026-10-25T24:00:00Z','2026-10-25T12:00:60Z']) {
  assert.throws(()=>project('contact','submission-123',{email:'person@example.com'},occurredAt),/time/);
  assert.equal(validDraftEvent({...event(),occurredAt}),false);
 }
 for(const occurredAt of ['2024-02-29T12:00:00Z','2026-10-25T12:00:00.123+01:30']) {
  assert.equal(validDraftEvent(project('contact','submission-123',{email:'person@example.com'},occurredAt)),true);
 }
});
test('Retry-After untrusted values cannot escape finite one-day scheduling horizon',async()=>{
 for(const header of ['1e99','9'.repeat(500),'garbage','Wed, 01 Jan 9999 00:00:00 GMT','Wed, 01 Jan 2000 00:00:00 GMT','120','-9']) {
  let state;const before=Date.now();
  const store={claim:async()=>[{event:event(),lease:'lease',attempts:0}],settle:async(_,s)=>state=s};
  await drain(config,store,async()=>new Response('{}',{status:429,headers:{'Retry-After':header}}));
  const delay=Date.parse(state.nextAttemptAt)-before;
  assert.equal(state.status,'retry',header);assert.ok(Number.isFinite(delay)&&delay>=0&&delay<=86400000+1000,header);
  if(header==='120')assert.ok(delay>=120000,header);
 }
});
