const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const url = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminPassword = Deno.env.get("EXCHANGE_ADMIN_PASSWORD")!;
const pepper = Deno.env.get("EXCHANGE_PEPPER")!;
const db = async (path: string, init: RequestInit = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", ...(init.headers || {}) } });
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2,"0")).join("");
const digest = async (text: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pepper}:${text}`)));
const passHash = async (text: string, salt: string) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(text), "PBKDF2", false, ["deriveBits"]);
  const derived=hex(await crypto.subtle.deriveBits({ name:"PBKDF2", salt:enc.encode(`${pepper}:${salt}`), iterations:120000, hash:"SHA-256" }, key, 256));
  return `${salt}.${derived}`;
};
const newToken = () => { const bytes=crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); };
const getSession = async (req: Request) => {
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""); if(!token) return null;
  const r=await db(`exchange_sessions?token_hash=eq.${await digest(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`);
  const rows=await r.json(); return rows?.[0] || null;
};
const bodyOf = async (req: Request) => { try { return await req.json(); } catch { return {}; } };
Deno.serve(async (req) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try {
    const body=await bodyOf(req); const action=body.action || new URL(req.url).searchParams.get("action");
    if(action==="roster") {
      const r=await db("exchange_participants?select=name,household_group&order=name"); return json({participants:await r.json()});
    }
    if(action==="status") {
      const r=await db("exchange_assignments?revealed_at=not.is.null&select=giver_id"); const rows=await r.json();
      const p=await db("exchange_participants?select=id"); const people=await p.json(); return json({drawn:rows.length,total:people.length});
    }
    if(action==="login") {
      const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
      const rate=await db("rpc/allow_exchange_login",{method:"POST",body:JSON.stringify({p_key:await digest(ip)})});
      if(!rate.ok || !(await rate.json())) return json({error:"Too many attempts. Wait 15 minutes and try again."},429);
      let role="participant", participant:any=null;
      if(body.role==="admin") { if(!adminPassword || body.password!==adminPassword) return json({error:"Incorrect organizer password."},401); role="admin"; }
      else {
        if(!body.name || !body.password) return json({error:"Enter your name and access code."},400);
        const r=await db(`exchange_participants?name=eq.${encodeURIComponent(body.name)}&select=id,code_hash`); const rows=await r.json(); participant=rows?.[0];
        if(!participant?.code_hash) return json({error:"Name or access code is incorrect."},401);
        const salt=participant.code_hash.split(".")[0]; if(participant.code_hash!==await passHash(body.password,salt)) return json({error:"Name or access code is incorrect."},401);
      }
      const token=newToken(); const exp=new Date(Date.now()+12*60*60*1000).toISOString();
      const saved=await db("exchange_sessions",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({token_hash:await digest(token),role,participant_id:participant?.id||null,expires_at:exp})});
      if(!saved.ok) throw new Error("Could not start a secure session."); return json({token,role});
    }
    if(action==="draw") {
      const session=await getSession(req); if(!session || session.role!=="participant") return json({error:"Please sign in again."},401);
      const r=await db("rpc/draw_exchange_for",{method:"POST",body:JSON.stringify({p_giver:session.participant_id})}); const out=await r.json();
      if(!r.ok) return json({error:out.message||"The draw could not be completed."},400); return json(out);
    }
    if(action?.startsWith("admin-")) {
      const session=await getSession(req); if(!session || session.role!=="admin") return json({error:"Organizer sign-in required."},401);
      if(action==="admin-list") {
        const [pr,dr]=await Promise.all([db("exchange_participants?select=id,name,code_hash,household_group&order=name"),db("exchange_assignments?select=giver_id,recipient_id,revealed_at")]);
        const participants=await pr.json(), draws=await dr.json(); const names=Object.fromEntries(participants.map((p:any)=>[p.id,p.name]));
        return json({participants:participants.map((p:any)=>({id:p.id,name:p.name,has_code:!!p.code_hash,household_group:p.household_group})),ledger:draws.filter((d:any)=>d.revealed_at).map((d:any)=>({giver:names[d.giver_id],recipient:names[d.recipient_id]}))});
      }
      if(action==="admin-set-code") {
        if(String(body.code||"").length<4) return json({error:"Use an access code of at least 4 characters."},400); const h=await passHash(String(body.code),crypto.randomUUID());
        const r=await db(`exchange_participants?name=eq.${encodeURIComponent(body.name)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({code_hash:h})}); return json({ok:r.ok});
      }
      if(action==="admin-set-household") {
        const household_group=Number(body.household_group); if(!Number.isInteger(household_group)||household_group<1||household_group>6) return json({error:"Choose a household group from 1 to 6."},400);
        const existingDraws=await db("exchange_assignments?select=giver_id&limit=1"); if((await existingDraws.json()).length) return json({error:"A draw has already started. Reset the exchange before changing household groups."},409);
        const r=await db(`exchange_participants?name=eq.${encodeURIComponent(body.name)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({household_group})}); return json({ok:r.ok});
      }
      if(action==="admin-add-names") {
        const names=(body.names||[]).map((n:string)=>String(n).trim()).filter(Boolean), household_group=Number(body.household_group); if(!names.length) return json({error:"Enter at least one name."},400);
        if(!Number.isInteger(household_group)||household_group<1||household_group>6) return json({error:"Choose a household group from 1 to 6."},400);
        const existingDraws=await db("exchange_assignments?select=giver_id&limit=1"); if((await existingDraws.json()).length) return json({error:"A draw has already started. Reset the exchange before changing the participant list."},409);
        const r=await db("exchange_participants",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(names.map((name:string)=>({name,household_group})))}); return json({ok:r.ok,error:r.ok?undefined:await r.text()});
      }
      if(action==="admin-reset") {
        await db("exchange_assignments?giver_id=not.is.null",{method:"DELETE"}); await db("exchange_sessions?role=eq.participant",{method:"DELETE"}); return json({ok:true});
      }
    }
    return json({error:"Unknown request."},404);
  } catch(e) { return json({error:String(e?.message||e)},500); }
});
