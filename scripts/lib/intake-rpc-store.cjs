// Unprovisioned adapter: the existing site's anon/publishable key MUST NOT be
// supplied. Operators must separately approve/provision these restricted RPCs.
const {validTimestamp}=require('./intake-contract-v1.cjs');
const EVENT_ID=/^org:[a-f0-9]{64}$/;
function createRpcStore(config={}, fetcher=fetch) {
  if (config.storageApproved!==true || typeof config.storageUrl!=='string' ||
      !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.storageUrl) ||
      typeof config.storageKey!=='string' || !config.storageKey) return null;
  async function rpc(name,args) {
    const controller=new AbortController(); let timer;
    try {
      return await Promise.race([(async()=>{
        const response=await fetcher(`${config.storageUrl}/rest/v1/rpc/${name}`,{
          method:'POST',redirect:'error',signal:controller.signal,
          headers:{apikey:config.storageKey,Authorization:`Bearer ${config.storageKey}`,'Content-Type':'application/json'},
          body:JSON.stringify(args),
        });
        if (!response.ok) throw new Error('Intake storage unavailable');
        const raw=await response.text();
        if (raw.length>700000) throw new Error('Intake storage response oversized');
        return raw?JSON.parse(raw):null;
      })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Intake storage timeout'));},4000);})]);
    } finally { clearTimeout(timer); controller.abort(); }
  }
  return {
    // Separate operator seam: worker credentials must not have RPC execution
    // rights for repair/inventory. The local flag is an extra accidental-use
    // gate, not a replacement for the separately approved database grants.
    async inventory(afterId=null) {
      if(config.repairApproved!==true)throw new Error('Operator repair not approved');
      if(afterId!==null&&!EVENT_ID.test(afterId))throw new Error('Invalid inventory cursor');
      const rows=await rpc('org_intake_inventory_v1',{afterId,limit:10});
      const keys=['id','status','code','revision','attempts','nextAttemptAt'];
      if(!Array.isArray(rows)||rows.length>10||rows.some(row=>
        !row||Object.keys(row).length!==keys.length||Object.keys(row).some(k=>!keys.includes(k))||
        !EVENT_ID.test(row.id)||row.status!=='blocked'||!Number.isSafeInteger(row.revision)||row.revision<0||
        !Number.isSafeInteger(row.attempts)||row.attempts<0||
        typeof row.code!=='string'||!/^(?:http-[1-5][0-9]{2}|network|oversize|invalid-event)$/.test(row.code)||
        (row.nextAttemptAt!==null&&!validTimestamp(row.nextAttemptAt))
      ))throw new Error('Invalid operator inventory');
      return rows;
    },
    async repair(id,expectedRevision) {
      if(config.repairApproved!==true)throw new Error('Operator repair not approved');
      if(!EVENT_ID.test(id)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('Invalid repair identity');
      // No replacement payload accepted. Repair can only release the exact
      // immutable blocked body/id after auth/configuration has been fixed.
      const result=await rpc('org_intake_repair_v1',{id,expectedRevision});
      if(result?.requeued!==true||result.id!==id)throw new Error('Storage repair conflict');
    },
    async capture(event) {
      const result=await rpc('org_intake_capture_v1',{event});
      if (result?.durable!==true || result.id!==event.id) throw new Error('Missing durable capture acknowledgment');
    },
    async claim(limit) {
      const rows=await rpc('org_intake_claim_v1',{limit:Math.min(10,limit)});
      if (!Array.isArray(rows)||rows.length>10 || rows.some(r=>!r || typeof r.lease!=='string' || !r.event || !Number.isInteger(r.attempts) || r.attempts<0)) throw new Error('Invalid storage claim');
      return rows;
    },
    async settle(lease,state) {
      const result=await rpc('org_intake_settle_v1',{lease,state});
      if (result?.updated!==true) throw new Error('Storage lease conflict');
    },
  };
}
module.exports={createRpcStore};
