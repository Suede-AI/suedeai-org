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
test('blocked delivery requires explicit revision-checked repair before claim', async () => {
 const {createRpcStore}=require('../scripts/lib/intake-rpc-store.cjs');
 // Persistent RPC fixture models states across fresh worker instances. It does
 // not prove database transactionality; the production RPCs remain unprovisioned.
 let row, leaseCounter=0; const bodies=[];
 const fetchStore=async(url,init)=>{
  const args=JSON.parse(init.body);let result;
  switch(url.split('/').pop()) {
   case 'org_intake_capture_v1':
    if(row)assert.deepEqual(row.event,args.event);
    else row={event:args.event,status:'retry',code:'new',revision:0,attempts:0,nextAttemptAt:null};
    result={durable:true,id:row.event.id};break;
   case 'org_intake_claim_v1':
    if(row.status!=='retry')result=[];
    else {row.lease=`lease-${++leaseCounter}`;row.status='working';row.attempts++;result=[{event:row.event,lease:row.lease,attempts:row.attempts}];}break;
   case 'org_intake_settle_v1':
    result={updated:args.lease===row.lease&&row.status==='working'};
    if(result.updated){Object.assign(row,args.state);row.revision++;}break;
   case 'org_intake_inventory_v1':
    result=row.status==='blocked'?[{id:row.event.id,status:row.status,code:row.code,revision:row.revision,attempts:row.attempts,nextAttemptAt:row.nextAttemptAt}]:[];break;
   case 'org_intake_repair_v1':
    result={requeued:row.status==='blocked'&&args.id===row.event.id&&args.expectedRevision===row.revision,id:args.id};
    if(result.requeued){row.status='retry';row.revision++;}break;
   default:throw new Error('Unexpected RPC');
  }
  return new Response(JSON.stringify(result),{status:200});
 };
 const storage={storageApproved:true,storageUrl:'https://project.supabase.co',storageKey:'synthetic-only'};
 const store=createRpcStore(storage,fetchStore);
 await capture(config,store,event());
 await drain(config,store,async(_,i)=>{bodies.push(i.body);return new Response('{}',{status:401});});
 assert.equal(row.status,'blocked');
 // A new worker with corrected secret still cannot claim a blocked event.
 await drain({...config,secret:'y'.repeat(32)},createRpcStore(storage,fetchStore),async()=>{throw new Error('Blocked row must not send');});
 assert.equal(row.status,'blocked');assert.equal(bodies.length,1);
 const operator=createRpcStore({...storage,repairApproved:true},fetchStore);
 const [blocked]=await operator.inventory();
 assert.deepEqual(Object.keys(blocked).sort(),['attempts','code','id','nextAttemptAt','revision','status']);
 await assert.rejects(()=>store.repair(blocked.id,blocked.revision),/not approved/);
 await assert.rejects(()=>operator.repair(blocked.id,blocked.revision+1),/conflict/);
 await operator.repair(blocked.id,blocked.revision);
 await drain({...config,secret:'y'.repeat(32)},store,async(_,i)=>{bodies.push(i.body);return new Response('{"accepted":true,"duplicate":true}',{status:202});});
 assert.equal(row.status,'complete');assert.equal(bodies[0],bodies[1]);
 await assert.rejects(()=>operator.repair(blocked.id,row.revision),/conflict/);
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
test('operator inventory rejects content-bearing metadata and uses only explicit repair RPC inputs',async()=>{
 const {createRpcStore}=require('../scripts/lib/intake-rpc-store.cjs');
 const options={storageApproved:true,repairApproved:true,storageUrl:'https://project.supabase.co',storageKey:'synthetic-only'};
 const row={id:event().id,status:'blocked',code:'http-401',revision:1,attempts:1,nextAttemptAt:null};
 for(const bad of [{...row,email:'person@example.com'},{...row,code:'untrusted-secret'},{...row,revision:-1}]) {
  const operator=createRpcStore(options,async()=>new Response(JSON.stringify([bad]),{status:200}));
  await assert.rejects(()=>operator.inventory(),/inventory/);
 }
 const operator=createRpcStore(options,async(url,init)=>{
  assert.equal(url.endsWith('/org_intake_repair_v1'),true);
  assert.deepEqual(JSON.parse(init.body),{id:row.id,expectedRevision:1});
  return new Response(JSON.stringify({requeued:true,id:row.id}),{status:200});
 });
 await operator.repair(row.id,1);
 await assert.rejects(()=>operator.repair(row.id,-1),/identity/);
});
test('worker aborts unused non-202 response streams after recording failure',async()=>{
 let signal,state;
 const store={claim:async()=>[{event:event(),lease:'lease',attempts:0}],settle:async(_,value)=>state=value};
 await drain(config,store,async(_,init)=>{signal=init.signal;return new Response(new ReadableStream({start(){}}),{status:503});});
 assert.equal(state.status,'retry');
 assert.equal(signal.aborted,true);
});
test('RPC aborts unused error response streams after failed request',async()=>{
 const {createRpcStore}=require('../scripts/lib/intake-rpc-store.cjs');let signal;
 const store=createRpcStore({storageApproved:true,storageUrl:'https://project.supabase.co',storageKey:'synthetic-only'},async(_,init)=>{
  signal=init.signal;return new Response(new ReadableStream({start(){}}),{status:503});
 });
 await assert.rejects(()=>store.capture(event()),/unavailable/);
 assert.equal(signal.aborted,true);
});
