// Unprovisioned adapter: the existing site's anon/publishable key MUST NOT be
// supplied. Operators must separately approve/provision these restricted RPCs.
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
    } finally { clearTimeout(timer); }
  }
  return {
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
