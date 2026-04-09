import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   UTILITÁRIOS
═══════════════════════════════════════════════════════════════ */
async function hashPin(input) {
  const data = new TextEncoder().encode(input + "_longevity_alvor_2026");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}
function z(n) { return String(n).padStart(2,"0"); }
function ptDate(d = new Date()) { return `${z(d.getDate())}/${z(d.getMonth()+1)}/${d.getFullYear()}`; }
function ptTime(d = new Date()) { return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`; }
function ptDT(d = new Date())   { return `${ptDate(d)} ${ptTime(d)}`; }
function today()                { return ptDate(); }
function toISO(pt) {
  if (!pt || !pt.includes("/")) return pt||"";
  const [d,m,y] = pt.split("/");
  return `${y}-${z(+m)}-${z(+d)}`;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════ */
const SK = { EMPS:"la_emps", RECS:"la_recs", AUDIT:"la_audit", ADMIN:"la_admin", INIT:"la_init" };

const AL = { entrada:"Entrada", saida:"Saída", inicio_pausa:"Início de Pausa", fim_pausa:"Fim de Pausa" };

const AC = {
  entrada:      { bg:"#10b981", light:"#d1fae5", txt:"#065f46" },
  saida:        { bg:"#ef4444", light:"#fee2e2", txt:"#991b1b" },
  inicio_pausa: { bg:"#f59e0b", light:"#fef3c7", txt:"#92400e" },
  fim_pausa:    { bg:"#3b82f6", light:"#dbeafe", txt:"#1e40af" },
};

const SEED_EMPS = [
  { id:"1", name:"Veronica Cofman",   pin:"1111" },
  { id:"2", name:"Sandra Sofia",      pin:"2222" },
  { id:"3", name:"Melanie Navalhas",  pin:"3333" },
  { id:"4", name:"Andreia Fernandes", pin:"4444" },
  { id:"5", name:"Renata Barbosa",    pin:"5555" },
];

/* ═══════════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════════ */
const ld = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const sv = (k,v) => localStorage.setItem(k, JSON.stringify(v));

/* ═══════════════════════════════════════════════════════════════
   VALIDAÇÃO
═══════════════════════════════════════════════════════════════ */
function validateAction(recs, empId, type) {
  const t = today();
  const types = recs.filter(r => r.employeeId===empId && r.date===t).map(r => r.type);
  const hasE = types.includes("entrada");
  const hasS = types.includes("saida");
  const cIP  = types.filter(x=>x==="inicio_pausa").length;
  const cFP  = types.filter(x=>x==="fim_pausa").length;
  if (type==="entrada")      { if (hasE) return "Já existe uma Entrada registada hoje."; }
  if (type==="saida")        {
    if (!hasE)     return "Não é possível registar Saída sem Entrada anterior.";
    if (hasS)      return "Já existe uma Saída registada hoje.";
    if (cIP>cFP)   return "Existe pausa em curso — registe Fim de Pausa primeiro.";
  }
  if (type==="inicio_pausa") {
    if (!hasE)     return "Não é possível iniciar pausa sem Entrada anterior.";
    if (hasS)      return "Já registou Saída hoje.";
    if (cIP>cFP)   return "Já existe uma pausa em curso.";
  }
  if (type==="fim_pausa")    {
    if (!cIP||cFP>=cIP) return "Não existe nenhum Início de Pausa por fechar.";
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   ESTILOS PARTILHADOS
═══════════════════════════════════════════════════════════════ */
const S = {
  input: {
    width:"100%", border:"1.5px solid #e7e5e4", borderRadius:10, padding:"10px 12px",
    fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff",
  },
  btnPrimary: {
    background:"#1c1917", color:"#fff", border:"none", borderRadius:12, padding:"13px 16px",
    fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
    boxShadow:"0 3px 10px rgba(0,0,0,.2)",
  },
  btnCancel: {
    background:"#f5f5f4", color:"#57534e", border:"none", borderRadius:12, padding:"13px 16px",
    fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
  },
  btnSm: {
    border:"none", borderRadius:8, padding:"9px 14px", fontSize:13,
    fontWeight:700, cursor:"pointer", fontFamily:"inherit",
  },
  card: {
    background:"#fff", border:"1px solid #e7e5e4", borderRadius:16,
    overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.05)",
  },
};

/* ═══════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [emps,   setEmps]   = useState([]);
  const [recs,   setRecs]   = useState([]);
  const [audit,  setAudit]  = useState([]);
  const [selEmp, setSelEmp] = useState(null);
  const [toast,  setToast]  = useState(null);

  useEffect(() => { boot(); }, []);

  async function boot() {
    if (!ld(SK.INIT)) {
      const empList = [];
      for (const e of SEED_EMPS)
        empList.push({ id:e.id, name:e.name, pinHash: await hashPin(e.pin), active:true });

      const yest = new Date(); yest.setDate(yest.getDate()-1);
      const yd = ptDate(yest);
      const samples = [
        mk("s01","1","Veronica Cofman",   "entrada",      yd,"09:01:23",""),
        mk("s02","1","Veronica Cofman",   "inicio_pausa", yd,"13:00:10",""),
        mk("s03","1","Veronica Cofman",   "fim_pausa",    yd,"14:02:05",""),
        mk("s04","1","Veronica Cofman",   "saida",        yd,"18:00:30",""),
        mk("s05","2","Sandra Sofia",      "entrada",      yd,"08:57:00",""),
        mk("s06","2","Sandra Sofia",      "inicio_pausa", yd,"13:05:00",""),
        mk("s07","2","Sandra Sofia",      "fim_pausa",    yd,"14:00:00",""),
        mk("s08","2","Sandra Sofia",      "saida",        yd,"17:58:00",""),
        mk("s09","3","Melanie Navalhas",  "entrada",      yd,"09:05:00","Atraso — trânsito"),
        mk("s10","3","Melanie Navalhas",  "saida",        yd,"18:10:00",""),
        mk("s11","4","Andreia Fernandes", "entrada",      yd,"08:45:00",""),
        mk("s12","4","Andreia Fernandes", "inicio_pausa", yd,"12:55:00",""),
        mk("s13","4","Andreia Fernandes", "fim_pausa",    yd,"14:00:00",""),
        mk("s14","4","Andreia Fernandes", "saida",        yd,"18:05:00",""),
        mk("s15","5","Renata Barbosa",    "entrada",      yd,"09:00:00",""),
        mk("s16","5","Renata Barbosa",    "saida",        yd,"18:00:00",""),
      ];

      sv(SK.EMPS,  empList);
      sv(SK.ADMIN, await hashPin("Admin2026"));
      sv(SK.RECS,  samples);
      sv(SK.AUDIT, []);
      sv(SK.INIT,  true);
      setEmps(empList); setRecs(samples); setAudit([]);
    } else {
      setEmps(ld(SK.EMPS)||[]); setRecs(ld(SK.RECS)||[]); setAudit(ld(SK.AUDIT)||[]);
    }
    setScreen("home");
  }

  function mk(id, empId, empName, type, date, time, notes) {
    return { id, employeeId:empId, employeeName:empName, type, date,
             time, datetime:`${date} ${time}`, notes, edited:false, editCount:0 };
  }

  function showToast(msg, type="ok") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3000);
  }

  function doRecord(type, notes) {
    const now = new Date();
    const rec = {
      id: `r${Date.now()}${Math.random().toString(36).slice(2,5)}`,
      employeeId: selEmp.id, employeeName: selEmp.name,
      type, notes: notes||"",
      date: ptDate(now), time: ptTime(now), datetime: ptDT(now),
      edited:false, editCount:0,
    };
    const n = [...recs, rec];
    setRecs(n); sv(SK.RECS, n);
    showToast(`✓ ${AL[type]} registada!`);
    setTimeout(()=>{ setScreen("home"); setSelEmp(null); }, 1800);
  }

  function upRecs(r)  { setRecs(r);  sv(SK.RECS, r);  }
  function upAudit(a) { setAudit(a); sv(SK.AUDIT, a); }
  function upEmps(e)  { setEmps(e);  sv(SK.EMPS, e);  }

  return (
    <div style={{minHeight:"100vh",background:"#f8f7f4",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        input,select,textarea{font-family:inherit}
        .cb:active{transform:scale(0.97)} .ab:active{transform:scale(0.93)} .tb:active{opacity:0.65}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
      `}</style>

      {toast && (
        <div style={{
          position:"fixed",inset:"0 0 auto 0",zIndex:999,
          background:toast.type==="err"?"#ef4444":"#10b981",
          color:"#fff",textAlign:"center",padding:"16px 24px",
          fontSize:17,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,.25)",
        }}>{toast.msg}</div>
      )}

      {screen==="loading"    && <Loading />}
      {screen==="home"       && <HomeScreen emps={emps} recs={recs} onSelect={e=>{setSelEmp(e);setScreen("pin");}} onAdmin={()=>setScreen("admin_login")} />}
      {screen==="pin"        && selEmp && <PinScreen emp={selEmp} onBack={()=>{setScreen("home");setSelEmp(null);}} onOk={()=>setScreen("action")} />}
      {screen==="action"     && selEmp && <ActionScreen emp={selEmp} recs={recs} onBack={()=>{setScreen("home");setSelEmp(null);}} onRecord={doRecord} validate={t=>validateAction(recs,selEmp.id,t)} />}
      {screen==="admin_login"&& <AdminLogin onBack={()=>setScreen("home")} onOk={()=>setScreen("admin")} />}
      {screen==="admin"      && <AdminPanel recs={recs} audit={audit} emps={emps} onBack={()=>setScreen("home")} onRecs={upRecs} onAudit={upAudit} onEmps={upEmps} showToast={showToast} />}
    </div>
  );
}

/* ─── Loading ──────────────────────────────────────────────── */
function Loading() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <span style={{fontSize:20,color:"#a8a29e"}}>A carregar…</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME SCREEN
═══════════════════════════════════════════════════════════════ */
function HomeScreen({ emps, recs, onSelect, onAdmin }) {
  const [clock, setClock] = useState(ptTime());
  useEffect(()=>{
    const t = setInterval(()=>setClock(ptTime()),1000);
    return ()=>clearInterval(t);
  },[]);

  const td = today();

  function statusOf(id) {
    const tr = recs.filter(r=>r.employeeId===id&&r.date===td).sort((a,b)=>a.time.localeCompare(b.time));
    if (!tr.length) return {label:"Sem registo",bg:"#f1f0ec",col:"#a8a29e"};
    return {
      entrada:      {label:"Presente", bg:"#d1fae5",col:"#065f46"},
      saida:        {label:"Saiu",     bg:"#fee2e2",col:"#991b1b"},
      inicio_pausa: {label:"Em Pausa", bg:"#fef3c7",col:"#92400e"},
      fim_pausa:    {label:"Presente", bg:"#d1fae5",col:"#065f46"},
    }[tr.at(-1).type]||{label:"—",bg:"#f1f0ec",col:"#a8a29e"};
  }

  const presentN = emps.filter(e=>{
    const tr = recs.filter(r=>r.employeeId===e.id&&r.date===td);
    if (!tr.length) return false;
    const last = tr.sort((a,b)=>a.time.localeCompare(b.time)).at(-1).type;
    return last==="entrada"||last==="fim_pausa";
  }).length;

  const dayLabel = new Date().toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",padding:"24px 20px",maxWidth:600,margin:"0 auto"}}>
      {/* Header */}
      <div style={{textAlign:"center",paddingBottom:24,paddingTop:8}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"#10b981",textTransform:"uppercase",marginBottom:8}}>
          Longevity Alvor
        </div>
        <h1 style={{fontSize:30,fontWeight:800,color:"#1c1917",letterSpacing:-0.5,lineHeight:1.1}}>
          Controlo de Assiduidade
        </h1>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:46,fontWeight:500,color:"#1c1917",letterSpacing:-1,marginTop:14}}>
          {clock}
        </div>
        <div style={{fontSize:13,color:"#78716c",marginTop:4,textTransform:"capitalize"}}>{dayLabel}</div>
        {presentN>0&&(
          <div style={{display:"inline-block",marginTop:10,background:"#ecfdf5",border:"1px solid #a7f3d0",color:"#065f46",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:600}}>
            {presentN} presente{presentN!==1?"s":""}
          </div>
        )}
      </div>

      {/* Cards de colaborador */}
      <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
        {emps.map(emp=>{
          const st  = statusOf(emp.id);
          const ini = emp.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
          return (
            <button key={emp.id} className="cb" onClick={()=>onSelect(emp)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",border:"1px solid #e7e5e4",borderRadius:18,padding:"18px 22px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",transition:"transform .15s",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:50,height:50,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:17,color:"#10b981",flexShrink:0,border:"2px solid #a7f3d0"}}>
                  {ini}
                </div>
                <span style={{fontSize:21,fontWeight:700,color:"#1c1917"}}>{emp.name}</span>
              </div>
              <span style={{fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:20,background:st.bg,color:st.col,flexShrink:0}}>
                {st.label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{paddingTop:20,textAlign:"center"}}>
        <button className="tb" onClick={onAdmin}
          style={{fontSize:13,color:"#a8a29e",padding:"8px 20px",borderRadius:10,transition:"all .15s"}}>
          ⚙️ Painel de Administração
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NUMPAD
═══════════════════════════════════════════════════════════════ */
function Numpad({ onKey }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,width:288}}>
      {["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map(k=>{
        const ok=k==="✓", del=k==="⌫";
        return (
          <button key={k} className="ab"
            onPointerDown={e=>{e.preventDefault();onKey(k);}}
            style={{height:64,borderRadius:14,fontSize:24,fontWeight:700,userSelect:"none",transition:"all .1s",
              background: ok?"#10b981":del?"#fff1f2":"#ffffff",
              color:       ok?"#fff":del?"#ef4444":"#1c1917",
              border:      ok?"none":del?"1.5px solid #fecaca":"1.5px solid #e7e5e4",
              boxShadow:   ok?"0 4px 12px rgba(16,185,129,.3)":"0 1px 3px rgba(0,0,0,.07)",
            }}>
            {k}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PIN SCREEN
═══════════════════════════════════════════════════════════════ */
function PinScreen({ emp, onBack, onOk }) {
  const [pin,  setPin]  = useState("");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);
  const MAX = 6;
  const ini = emp.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();

  async function check(p) {
    if (p.length<4) { setErr("PIN deve ter pelo menos 4 dígitos."); return; }
    setBusy(true);
    const h = await hashPin(p);
    setBusy(false);
    if (h===emp.pinHash) { onOk(); }
    else { setErr("PIN incorreto. Tente novamente."); setPin(""); }
  }

  function onKey(k) {
    if (busy) return;
    if (k==="⌫")       { setPin(p=>p.slice(0,-1)); setErr(""); }
    else if (k==="✓")  { check(pin); }
    else if (pin.length<MAX) { setPin(p=>p+k); setErr(""); }
  }

  const dots = Math.max(4, pin.length+(pin.length<MAX?1:0));

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:24,position:"relative",background:"#f8f7f4"}}>
      <button className="tb" onClick={onBack}
        style={{position:"absolute",top:24,left:20,fontSize:15,color:"#78716c",fontWeight:600}}>
        ← Voltar
      </button>
      <div style={{width:80,height:80,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:800,color:"#10b981",marginBottom:12,border:"2.5px solid #a7f3d0"}}>
        {ini}
      </div>
      <h2 style={{fontSize:26,fontWeight:800,color:"#1c1917",marginBottom:4}}>{emp.name}</h2>
      <p style={{fontSize:15,color:"#78716c",marginBottom:28}}>Introduza o seu PIN</p>

      <div style={{display:"flex",gap:12,marginBottom:20}}>
        {Array.from({length:dots}).map((_,i)=>(
          <div key={i} style={{width:14,height:14,borderRadius:"50%",transition:"all .15s",
            background:i<pin.length?"#10b981":"transparent",
            border:`2px solid ${i<pin.length?"#10b981":"#d6d3d1"}`}} />
        ))}
      </div>

      {err&&(
        <div style={{marginBottom:16,padding:"8px 20px",background:"#fff1f2",border:"1px solid #fecaca",borderRadius:10,color:"#ef4444",fontSize:14,textAlign:"center"}}>
          {err}
        </div>
      )}
      <Numpad onKey={onKey} />
      {busy&&<p style={{marginTop:12,color:"#a8a29e",fontSize:13}}>A verificar…</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACTION SCREEN
═══════════════════════════════════════════════════════════════ */
function ActionScreen({ emp, recs, onBack, onRecord, validate }) {
  const [notes,   setNotes]   = useState("");
  const [pending, setPending] = useState(null);
  const [warn,    setWarn]    = useState("");
  const [clock,   setClock]   = useState(ptTime());
  useEffect(()=>{ const t=setInterval(()=>setClock(ptTime()),1000); return ()=>clearInterval(t); },[]);

  const td = today();
  const todayRecs = recs.filter(r=>r.employeeId===emp.id&&r.date===td).sort((a,b)=>a.time.localeCompare(b.time));
  const ini = emp.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();

  function press(type) {
    const e = validate(type);
    if (e) { setWarn(e); return; }
    setWarn(""); setPending(type); setNotes("");
  }

  const btns = [
    {type:"entrada",      label:"Entrada",        icon:"🟢"},
    {type:"saida",        label:"Saída",           icon:"🔴"},
    {type:"inicio_pausa", label:"Início de Pausa", icon:"⏸️"},
    {type:"fim_pausa",    label:"Fim de Pausa",    icon:"▶️"},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",padding:"20px",maxWidth:600,margin:"0 auto",position:"relative"}}>
      <button className="tb" onClick={onBack}
        style={{position:"absolute",top:20,left:20,fontSize:15,color:"#78716c",fontWeight:600}}>
        ← Voltar
      </button>

      <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:60,marginBottom:16}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#10b981",marginBottom:8,border:"2px solid #a7f3d0"}}>
          {ini}
        </div>
        <h2 style={{fontSize:22,fontWeight:800,color:"#1c1917"}}>{emp.name}</h2>
        <p style={{fontFamily:"'DM Mono',monospace",color:"#78716c",fontSize:15,marginTop:2}}>{clock} · {td}</p>
      </div>

      {todayRecs.length>0&&(
        <div style={{background:"#fff",border:"1px solid #e7e5e4",borderRadius:14,padding:"12px 16px",marginBottom:12}}>
          <p style={{fontSize:11,fontWeight:700,color:"#a8a29e",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Registos de hoje</p>
          {todayRecs.map(r=>(
            <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:700,padding:"3px 9px",borderRadius:7,background:AC[r.type]?.light,color:AC[r.type]?.txt}}>
                {AL[r.type]}
              </span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"#78716c"}}>{r.time.slice(0,5)}</span>
            </div>
          ))}
        </div>
      )}

      {warn&&(
        <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:12,padding:"10px 14px",marginBottom:12,color:"#c2410c",fontSize:14,textAlign:"center"}}>
          ⚠️ {warn}
        </div>
      )}

      {!pending ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {btns.map(b=>(
            <button key={b.type} className="ab" onClick={()=>press(b.type)}
              style={{background:AC[b.type].bg,color:"#fff",borderRadius:20,padding:"24px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,boxShadow:`0 4px 14px ${AC[b.type].bg}44`,transition:"all .15s",border:"none"}}>
              <span style={{fontSize:38}}>{b.icon}</span>
              <span style={{fontSize:17,fontWeight:800,textAlign:"center",lineHeight:1.2}}>{b.label}</span>
            </button>
          ))}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:AC[pending].bg,borderRadius:18,padding:"20px",textAlign:"center",color:"#fff",boxShadow:`0 6px 20px ${AC[pending].bg}55`}}>
            <div style={{fontSize:24,fontWeight:800}}>{AL[pending]}</div>
            <div style={{fontFamily:"'DM Mono',monospace",opacity:.9,marginTop:4}}>{ptDT()}</div>
          </div>
          <textarea placeholder="Observações (opcional)" value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
            style={{width:"100%",border:"1.5px solid #e7e5e4",borderRadius:12,padding:"12px",fontSize:15,outline:"none",resize:"none",background:"#fff",fontFamily:"inherit"}} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button className="ab" onClick={()=>setPending(null)} style={{...S.btnCancel}}>Cancelar</button>
            <button className="ab" onClick={()=>onRecord(pending,notes)} style={{...S.btnPrimary}}>Confirmar ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN LOGIN
═══════════════════════════════════════════════════════════════ */
function AdminLogin({ onBack, onOk }) {
  const [pw,   setPw]   = useState("");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!pw) { setErr("Introduza a password."); return; }
    setBusy(true);
    const h = await hashPin(pw);
    setBusy(false);
    if (h===ld(SK.ADMIN)) { onOk(); }
    else { setErr("Password incorreta."); setPw(""); }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:24,position:"relative",background:"#f8f7f4"}}>
      <button className="tb" onClick={onBack}
        style={{position:"absolute",top:24,left:20,fontSize:15,color:"#78716c",fontWeight:600}}>
        ← Voltar
      </button>
      <div style={{fontSize:52,marginBottom:12}}>🔐</div>
      <h2 style={{fontSize:28,fontWeight:800,color:"#1c1917"}}>Administração</h2>
      <p style={{color:"#78716c",fontSize:14,marginTop:4,marginBottom:32}}>Acesso restrito</p>
      <div style={{width:"100%",maxWidth:340,display:"flex",flexDirection:"column",gap:12}}>
        <input type="password" placeholder="Password de administrador" value={pw}
          onChange={e=>{setPw(e.target.value);setErr("");}}
          onKeyDown={e=>e.key==="Enter"&&login()} autoFocus
          style={{...S.input,border:"2px solid #e7e5e4",padding:"15px",fontSize:18,textAlign:"center"}} />
        {err&&<p style={{color:"#ef4444",textAlign:"center",fontSize:14}}>{err}</p>}
        <button className="ab" onClick={login} disabled={busy}
          style={{...S.btnPrimary,opacity:busy?.6:1,transition:"all .15s"}}>
          {busy?"A verificar…":"Entrar"}
        </button>
      </div>
      <p style={{marginTop:32,color:"#a8a29e",fontSize:12,textAlign:"center",lineHeight:1.7}}>
        Password padrão:{" "}
        <code style={{background:"#f1f0ec",padding:"2px 6px",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>Admin2026</code>
        <br/>Altere após a primeira utilização
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════════ */
function AdminPanel({ recs, audit, emps, onBack, onRecs, onAudit, onEmps, showToast }) {
  const [tab, setTab] = useState("records");
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
      <div style={{background:"#1c1917",color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button className="tb" onClick={onBack} style={{color:"#a8a29e",fontSize:14,fontWeight:600}}>← Sair</button>
        <span style={{fontWeight:700,fontSize:15}}>Painel de Administração</span>
        <div style={{width:60}} />
      </div>
      <div style={{display:"flex",background:"#fff",borderBottom:"1px solid #e7e5e4"}}>
        {[["records","📋 Registos"],["audit","🔍 Auditoria"],["staff","👥 Colaboradores"]].map(([id,label])=>(
          <button key={id} className="tb" onClick={()=>setTab(id)}
            style={{flex:1,padding:"14px 4px",fontSize:12,fontWeight:700,background:"none",
              color:tab===id?"#10b981":"#78716c",
              borderBottom:tab===id?"2.5px solid #10b981":"2.5px solid transparent",
              transition:"all .15s"}}>
            {label}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflow:"auto",background:"#f8f7f4"}}>
        {tab==="records"&&<RecordsTab recs={recs} audit={audit} emps={emps} onRecs={onRecs} onAudit={onAudit} showToast={showToast} />}
        {tab==="audit"  &&<AuditTab  audit={audit} />}
        {tab==="staff"  &&<StaffTab  emps={emps} onEmps={onEmps} showToast={showToast} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECORDS TAB
═══════════════════════════════════════════════════════════════ */
function RecordsTab({ recs, audit, emps, onRecs, onAudit, showToast }) {
  const [fEmp,  setFEmp]  = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo,   setFTo]   = useState("");
  const [editR, setEditR] = useState(null);
  const [eData, setEData] = useState({});
  const [eWhy,  setEWhy]  = useState("");
  const [delR,  setDelR]  = useState(null);
  const [dWhy,  setDWhy]  = useState("");
  const [expMon, setExpMon] = useState(new Date().toISOString().slice(0,7));
  const [prtEmp, setPrtEmp] = useState(emps[0]?.id||"");
  const [prtMon, setPrtMon] = useState(new Date().toISOString().slice(0,7));

  const filtered = recs
    .filter(r=>{
      if (fEmp!=="all"&&r.employeeId!==fEmp) return false;
      const iso = toISO(r.date);
      if (fFrom&&iso<fFrom) return false;
      if (fTo  &&iso>fTo)   return false;
      return true;
    })
    .sort((a,b)=>(toISO(b.date)+b.time).localeCompare(toISO(a.date)+a.time));

  function startEdit(r) {
    setEditR(r);
    setEData({type:r.type, date:toISO(r.date), time:r.time.slice(0,5), notes:r.notes});
    setEWhy("");
  }

  function saveEdit() {
    if (!eWhy.trim()) { showToast("Motivo da alteração é obrigatório.","err"); return; }
    const [y,m,d] = eData.date.split("-");
    const newDate = `${z(+d)}/${z(+m)}/${y}`;
    const newTime = eData.time+":00";
    const updated = {...editR, type:eData.type, date:newDate, time:newTime,
      datetime:`${newDate} ${newTime}`, notes:eData.notes,
      edited:true, editCount:(editR.editCount||0)+1};
    onRecs(recs.map(r=>r.id===editR.id?updated:r));
    onAudit([...audit,{
      id:`a${Date.now()}`, timestamp:ptDT(), action:"EDIÇÃO",
      recordId:editR.id, employeeName:editR.employeeName,
      before:JSON.stringify({type:editR.type,date:editR.date,time:editR.time.slice(0,5),notes:editR.notes}),
      after: JSON.stringify({type:updated.type,date:updated.date,time:updated.time.slice(0,5),notes:updated.notes}),
      reason:eWhy,
    }]);
    showToast("Registo atualizado.");
    setEditR(null);
  }

  function startDel(r) { setDelR(r); setDWhy(""); }

  function saveDel() {
    if (!dWhy.trim()) { showToast("Motivo da eliminação é obrigatório.","err"); return; }
    onRecs(recs.filter(r=>r.id!==delR.id));
    onAudit([...audit,{
      id:`a${Date.now()}`, timestamp:ptDT(), action:"ELIMINAÇÃO",
      recordId:delR.id, employeeName:delR.employeeName,
      before:JSON.stringify({type:delR.type,date:delR.date,time:delR.time.slice(0,5),notes:delR.notes}),
      after:"—", reason:dWhy,
    }]);
    showToast("Registo eliminado.");
    setDelR(null);
  }

  /* ── CSV EXPORT ───────────────────────────────────────────── */
  function exportCSV() {
    const [y,m] = expMon.split("-");
    const rows = recs
      .filter(r=>toISO(r.date).startsWith(`${y}-${m}`))
      .sort((a,b)=>(toISO(a.date)+a.time).localeCompare(toISO(b.date)+b.time));
    if (!rows.length) { showToast("Sem registos para este mês.","err"); return; }
    const hdr = ["Nome","Tipo","Data","Hora","Observações","Editado"];
    const csv = [hdr,...rows.map(r=>[r.employeeName,AL[r.type],r.date,r.time.slice(0,5),r.notes,r.edited?"Sim":"Não"])]
      .map(row=>row.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
    a.download = `assiduidade_${y}_${m}.csv`;
    a.click();
    showToast("CSV exportado!");
  }

  /* ── PRINT MAP ────────────────────────────────────────────── */
  function printMap() {
    const emp = emps.find(e=>e.id===prtEmp);
    if (!emp) return;
    const [y,m] = prtMon.split("-");
    const byDay = {};
    recs.filter(r=>r.employeeId===prtEmp&&toISO(r.date).startsWith(`${y}-${m}`))
        .forEach(r=>{ (byDay[r.date]=byDay[r.date]||[]).push(r); });
    if (!Object.keys(byDay).length) { showToast("Sem registos para este mês.","err"); return; }

    const rows = Object.entries(byDay)
      .sort(([a],[b])=>toISO(a).localeCompare(toISO(b)))
      .map(([date,rs])=>{
        const e  = rs.find(r=>r.type==="entrada");
        const s  = rs.find(r=>r.type==="saida");
        const ip = rs.filter(r=>r.type==="inicio_pausa").map(r=>r.time.slice(0,5)).join(", ");
        const fp = rs.filter(r=>r.type==="fim_pausa").map(r=>r.time.slice(0,5)).join(", ");
        const notes = rs.filter(r=>r.notes).map(r=>r.notes).join("; ");
        const edited = rs.some(r=>r.edited);

        // Calcular horas trabalhadas (bruto − pausas)
        let workedStr = "—";
        if (e&&s) {
          const [eh,em,es] = e.time.split(":").map(Number);
          const [sh,sm,ss] = s.time.split(":").map(Number);
          let totalSec = (sh*3600+sm*60+ss)-(eh*3600+em*60+es);
          const starts = rs.filter(r=>r.type==="inicio_pausa");
          const ends   = rs.filter(r=>r.type==="fim_pausa");
          starts.forEach((ps,i)=>{
            const pe = ends[i];
            if (pe) {
              const [psh,psm,pss]=ps.time.split(":").map(Number);
              const [peh,pem,pes]=pe.time.split(":").map(Number);
              totalSec -= (peh*3600+pem*60+pes)-(psh*3600+psm*60+pss);
            }
          });
          if (totalSec>0) {
            const h=Math.floor(totalSec/3600);
            const mn=Math.floor((totalSec%3600)/60);
            workedStr=`${h}h${z(mn)}`;
          }
        }

        return `<tr style="background:${edited?"#fffbeb":"#fff"}">
          <td>${date}${edited?" <em style='color:#d97706;font-size:10px'>(editado)</em>":""}</td>
          <td style="color:#065f46;font-weight:600">${e?.time.slice(0,5)||"—"}</td>
          <td style="color:#92400e">${ip||"—"}</td>
          <td style="color:#1e40af">${fp||"—"}</td>
          <td style="color:#991b1b;font-weight:600">${s?.time.slice(0,5)||"—"}</td>
          <td style="font-weight:700">${workedStr}</td>
          <td style="color:#6b7280;font-size:11px">${notes}</td>
        </tr>`;
      }).join("");

    const totalDays = Object.keys(byDay).length;
    const win = window.open("","_blank");
    if (!win) { showToast("Permita pop-ups para imprimir.","err"); return; }
    win.document.write(`<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8">
<title>Mapa — ${emp.name} — ${z(+m)}/${y}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono&display=swap');
  body{font-family:'DM Sans',Arial,sans-serif;margin:24px;font-size:12px;color:#1c1917}
  .hdr{margin-bottom:16px;border-bottom:3px solid #10b981;padding-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
  .hdr h1{font-size:20px;font-weight:800;margin:0}
  .hdr h2{font-size:13px;color:#78716c;margin:4px 0 0;font-weight:500}
  .hdr .logo{font-size:11px;color:#10b981;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f0fdf4;color:#065f46;padding:8px 10px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border:1px solid #d1fae5}
  td{border:1px solid #e7e5e4;padding:7px 10px}
  tr:nth-child(even){background:#fafaf9}
  tfoot td{background:#f8f7f4;font-size:11px;color:#78716c;font-style:italic;border:1px solid #e7e5e4}
  .footer{margin-top:14px;font-size:10px;color:#a8a29e;text-align:right}
  .summary{margin-bottom:12px;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:6px;padding:8px 12px;font-size:12px;color:#065f46;font-weight:600}
  @media print{body{margin:8mm}button{display:none}}
</style>
</head><body>
<div class="hdr">
  <div><h1>Mapa de Assiduidade</h1><h2>${emp.name} &nbsp;·&nbsp; ${z(+m)}/${y}</h2></div>
  <div class="logo">Longevity Alvor</div>
</div>
<div class="summary">Dias com registo: ${totalDays}</div>
<table>
  <thead><tr><th>Data</th><th>Entrada</th><th>Iníc. Pausa</th><th>Fim Pausa</th><th>Saída</th><th>Horas</th><th>Observações</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td colspan="7">Registos em itálico foram editados pelo administrador &nbsp;·&nbsp; Horas = tempo total menos pausas</td></tr></tfoot>
</table>
<div class="footer">Gerado em ${ptDT()} &nbsp;·&nbsp; Longevity Alvor — Controlo de Assiduidade</div>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`);
    win.document.close();
  }

  /* ── RENDER ───────────────────────────────────────────────── */
  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

      {/* Filtros */}
      <Crd title="Filtros">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <select value={fEmp} onChange={e=>setFEmp(e.target.value)} style={S.input}>
            <option value="all">Todos os colaboradores</option>
            {emps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8}}>
            <input type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} style={S.input} placeholder="De:" />
            <input type="date" value={fTo}   onChange={e=>setFTo(e.target.value)}   style={S.input} placeholder="Até:" />
            <button onClick={()=>{setFEmp("all");setFFrom("");setFTo("");}}
              style={{...S.btnSm,background:"#f5f5f4",color:"#57534e"}}>Limpar</button>
          </div>
        </div>
      </Crd>

      {/* Exportar / Imprimir */}
      <Crd title="Exportar / Imprimir">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <label style={{fontSize:12,color:"#78716c",fontWeight:600,whiteSpace:"nowrap"}}>CSV mensal:</label>
            <input type="month" value={expMon} onChange={e=>setExpMon(e.target.value)} style={{...S.input,flex:1}} />
            <button onClick={exportCSV} style={{...S.btnSm,background:"#10b981",color:"#fff",whiteSpace:"nowrap"}}>📥 Exportar CSV</button>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <label style={{fontSize:12,color:"#78716c",fontWeight:600,whiteSpace:"nowrap"}}>Mapa:</label>
            <select value={prtEmp} onChange={e=>setPrtEmp(e.target.value)} style={{...S.input,flex:1,minWidth:130}}>
              {emps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="month" value={prtMon} onChange={e=>setPrtMon(e.target.value)} style={{...S.input,width:130}} />
            <button onClick={printMap} style={{...S.btnSm,background:"#1c1917",color:"#fff",whiteSpace:"nowrap"}}>🖨️ Imprimir Mapa</button>
          </div>
        </div>
      </Crd>

      {/* Tabela de registos */}
      <Crd title={`Registos (${filtered.length})`}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#f8f7f4"}}>
                {["Colaborador","Tipo","Data","Hora","Observações","Ações"].map(h=>(
                  <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:"#78716c",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #e7e5e4"}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!filtered.length?(
                <tr><td colSpan={6} style={{padding:24,textAlign:"center",color:"#a8a29e"}}>Sem registos.</td></tr>
              ):filtered.map(r=>(
                <tr key={r.id} style={{background:r.edited?"#fffbeb":"transparent",borderBottom:"1px solid #f5f5f4"}}>
                  <td style={{padding:"9px 10px",fontWeight:600,color:"#1c1917",fontSize:12}}>
                    {r.employeeName.split(" ")[0]} {r.employeeName.split(" ").at(-1)}
                    {r.edited&&<span style={{color:"#d97706",marginLeft:4}}>✎</span>}
                  </td>
                  <td style={{padding:"9px 10px"}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:6,background:AC[r.type]?.light,color:AC[r.type]?.txt}}>
                      {AL[r.type]}
                    </span>
                  </td>
                  <td style={{padding:"9px 10px",color:"#57534e",fontSize:12}}>{r.date}</td>
                  <td style={{padding:"9px 10px",fontFamily:"'DM Mono',monospace",color:"#57534e",fontSize:12}}>{r.time.slice(0,5)}</td>
                  <td style={{padding:"9px 10px",color:"#a8a29e",fontSize:12,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {r.notes||"—"}
                  </td>
                  <td style={{padding:"9px 10px"}}>
                    <div style={{display:"flex",gap:10}}>
                      <button className="tb" onClick={()=>startEdit(r)} style={{color:"#10b981",fontSize:12,fontWeight:700}}>Editar</button>
                      <button className="tb" onClick={()=>startDel(r)}  style={{color:"#ef4444",fontSize:12,fontWeight:700}}>Apagar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Crd>

      {/* Modal Editar */}
      {editR&&(
        <Modal title="Editar Registo" onClose={()=>setEditR(null)}>
          <Fld label="Colaborador"><p style={{fontWeight:700,color:"#1c1917",fontSize:14}}>{editR.employeeName}</p></Fld>
          <Fld label="Tipo">
            <select value={eData.type} onChange={e=>setEData(d=>({...d,type:e.target.value}))} style={S.input}>
              {Object.entries(AL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </Fld>
          <Fld label="Data"><input type="date" value={eData.date} onChange={e=>setEData(d=>({...d,date:e.target.value}))} style={S.input} /></Fld>
          <Fld label="Hora"><input type="time" value={eData.time} onChange={e=>setEData(d=>({...d,time:e.target.value}))} style={S.input} /></Fld>
          <Fld label="Observações"><textarea value={eData.notes} onChange={e=>setEData(d=>({...d,notes:e.target.value}))} rows={2} style={{...S.input,resize:"none"}} /></Fld>
          <Fld label="Motivo da alteração *" accent>
            <textarea value={eWhy} onChange={e=>setEWhy(e.target.value)} rows={2} placeholder="Obrigatório…"
              style={{...S.input,resize:"none",borderColor:"#fca5a5"}} />
          </Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button className="ab" onClick={()=>setEditR(null)} style={S.btnCancel}>Cancelar</button>
            <button className="ab" onClick={saveEdit}           style={S.btnPrimary}>Guardar</button>
          </div>
        </Modal>
      )}

      {/* Modal Eliminar */}
      {delR&&(
        <Modal title="Eliminar Registo" onClose={()=>setDelR(null)}>
          <div style={{background:"#fff1f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",color:"#991b1b",fontSize:13,marginBottom:12}}>
            Eliminar <strong>{AL[delR.type]}</strong> de <strong>{delR.employeeName}</strong><br/>
            {delR.date} às {delR.time.slice(0,5)}
          </div>
          <Fld label="Motivo da eliminação *" accent>
            <textarea value={dWhy} onChange={e=>setDWhy(e.target.value)} rows={2} placeholder="Obrigatório…"
              style={{...S.input,resize:"none",borderColor:"#fca5a5"}} />
          </Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button className="ab" onClick={()=>setDelR(null)} style={S.btnCancel}>Cancelar</button>
            <button className="ab" onClick={saveDel} style={{...S.btnPrimary,background:"#ef4444",boxShadow:"0 3px 10px rgba(239,68,68,.3)"}}>Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT TAB
═══════════════════════════════════════════════════════════════ */
function AuditTab({ audit }) {
  const sorted = [...audit].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  return (
    <div style={{padding:16}}>
      <Crd title={`Log de Auditoria (${sorted.length} entradas)`}>
        {!sorted.length?(
          <div style={{padding:32,textAlign:"center",color:"#a8a29e"}}>Sem entradas de auditoria.</div>
        ):(
          <div>
            {sorted.map((e,i)=>(
              <div key={e.id} style={{padding:"14px 0",borderBottom:i<sorted.length-1?"1px solid #f5f5f4":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:20,
                    background:e.action==="ELIMINAÇÃO"?"#fee2e2":"#fef3c7",
                    color:e.action==="ELIMINAÇÃO"?"#991b1b":"#92400e"}}>
                    {e.action}
                  </span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#a8a29e"}}>{e.timestamp}</span>
                </div>
                <p style={{fontWeight:700,color:"#1c1917",fontSize:13}}>{e.employeeName}</p>
                <p style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#78716c",marginTop:2}}>Antes: {e.before}</p>
                {e.after!=="—"&&<p style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#78716c"}}>Depois: {e.after}</p>}
                <p style={{fontSize:13,color:"#10b981",marginTop:4}}><span style={{fontWeight:700}}>Motivo:</span> {e.reason}</p>
              </div>
            ))}
          </div>
        )}
      </Crd>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAFF TAB
═══════════════════════════════════════════════════════════════ */
function StaffTab({ emps, onEmps, showToast }) {
  const [resetId, setResetId] = useState(null);
  const [p1,setPw1]=useState(""); const [p2,setPw2]=useState(""); const [pErr,setPErr]=useState("");
  const [chgPw, setChgPw]=useState(false);
  const [a1,setA1]=useState(""); const [a2,setA2]=useState(""); const [aErr,setAErr]=useState("");

  async function savePin() {
    if (p1.length<4)      { setPErr("PIN deve ter pelo menos 4 dígitos."); return; }
    if (!/^\d+$/.test(p1)){ setPErr("PIN deve conter apenas dígitos."); return; }
    if (p1!==p2)           { setPErr("Os PINs não coincidem."); return; }
    const h = await hashPin(p1);
    onEmps(emps.map(e=>e.id===resetId?{...e,pinHash:h}:e));
    showToast("PIN atualizado com sucesso!");
    setResetId(null); setPw1(""); setPw2(""); setPErr("");
  }

  async function saveAdminPw() {
    if (a1.length<6)   { setAErr("Password deve ter pelo menos 6 caracteres."); return; }
    if (a1!==a2)        { setAErr("As passwords não coincidem."); return; }
    sv(SK.ADMIN, await hashPin(a1));
    showToast("Password de administrador atualizada!");
    setChgPw(false); setA1(""); setA2(""); setAErr("");
  }

  return (
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <Crd title="Colaboradores — Gestão de PINs">
        {emps.map((emp,i)=>{
          const ini=emp.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
          return (
            <div key={emp.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"12px 0",borderBottom:i<emps.length-1?"1px solid #f5f5f4":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#10b981",border:"1.5px solid #a7f3d0"}}>
                  {ini}
                </div>
                <div>
                  <p style={{fontWeight:700,color:"#1c1917",fontSize:14}}>{emp.name}</p>
                  <p style={{fontSize:11,color:"#a8a29e"}}>PIN: ••••</p>
                </div>
              </div>
              <button className="tb" onClick={()=>{setResetId(emp.id);setPw1("");setPw2("");setPErr("");}}
                style={{color:"#10b981",fontSize:13,fontWeight:700}}>Alterar PIN</button>
            </div>
          );
        })}
      </Crd>

      <Crd title="Segurança — Administrador">
        <p style={{fontSize:13,color:"#78716c",marginBottom:12}}>Altere a password de acesso ao painel de administração.</p>
        <button className="ab" onClick={()=>{setChgPw(true);setA1("");setA2("");setAErr("");}}
          style={{...S.btnPrimary,width:"100%"}}>🔑 Alterar Password Admin</button>
      </Crd>

      {/* Modal alterar PIN */}
      {resetId&&(
        <Modal title={`Alterar PIN — ${emps.find(e=>e.id===resetId)?.name}`} onClose={()=>setResetId(null)}>
          <Fld label="Novo PIN (mín. 4 dígitos)">
            <input type="password" inputMode="numeric" value={p1} onChange={e=>{setPw1(e.target.value);setPErr("");}}
              placeholder="••••" style={{...S.input,textAlign:"center",fontSize:22,letterSpacing:6}} />
          </Fld>
          <Fld label="Confirmar PIN">
            <input type="password" inputMode="numeric" value={p2} onChange={e=>{setPw2(e.target.value);setPErr("");}}
              placeholder="••••" style={{...S.input,textAlign:"center",fontSize:22,letterSpacing:6}} />
          </Fld>
          {pErr&&<p style={{color:"#ef4444",fontSize:13,marginTop:4}}>{pErr}</p>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button className="ab" onClick={()=>setResetId(null)} style={S.btnCancel}>Cancelar</button>
            <button className="ab" onClick={savePin} style={S.btnPrimary}>Guardar PIN</button>
          </div>
        </Modal>
      )}

      {/* Modal alterar password admin */}
      {chgPw&&(
        <Modal title="Alterar Password Admin" onClose={()=>setChgPw(false)}>
          <Fld label="Nova password (mín. 6 caracteres)">
            <input type="password" value={a1} onChange={e=>{setA1(e.target.value);setAErr("");}}
              placeholder="Nova password" style={S.input} />
          </Fld>
          <Fld label="Confirmar password">
            <input type="password" value={a2} onChange={e=>{setA2(e.target.value);setAErr("");}}
              placeholder="Repetir password" style={S.input} />
          </Fld>
          {aErr&&<p style={{color:"#ef4444",fontSize:13,marginTop:4}}>{aErr}</p>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button className="ab" onClick={()=>setChgPw(false)} style={S.btnCancel}>Cancelar</button>
            <button className="ab" onClick={saveAdminPw} style={S.btnPrimary}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════════════════════════ */
function Crd({ title, children }) {
  return (
    <div style={{background:"#fff",border:"1px solid #e7e5e4",borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
      {title&&<div style={{padding:"12px 16px",borderBottom:"1px solid #f5f5f4"}}><h3 style={{fontSize:13,fontWeight:700,color:"#57534e"}}>{title}</h3></div>}
      <div style={{padding:"12px 16px"}}>{children}</div>
    </div>
  );
}

function Fld({ label, accent, children }) {
  return (
    <div style={{marginBottom:10}}>
      <label style={{fontSize:12,fontWeight:600,color:accent?"#1c1917":"#78716c",display:"block",marginBottom:4}}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:12}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:"#fff",borderRadius:"20px 20px 14px 14px",width:"100%",maxWidth:420,maxHeight:"92vh",overflow:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.18)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid #f5f5f4"}}>
          <h3 style={{fontWeight:800,color:"#1c1917",fontSize:15}}>{title}</h3>
          <button className="tb" onClick={onClose}
            style={{width:30,height:30,borderRadius:"50%",background:"#f5f5f4",color:"#57534e",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
            ✕
          </button>
        </div>
        <div style={{padding:"16px 18px"}}>{children}</div>
      </div>
    </div>
  );
}
