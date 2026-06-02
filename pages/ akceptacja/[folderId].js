import { useState } from "react"
import { useRouter } from "next/router"

const T = {
  bg:"#0d0f13", surface:"rgba(255,255,255,.04)", surfaceHover:"rgba(255,255,255,.07)",
  border:"rgba(255,255,255,.08)", text:"#f1f3f7", textDim:"rgba(255,255,255,.55)",
  textFaint:"rgba(255,255,255,.38)", accent:"#5b8ff9", inputBg:"rgba(0,0,0,.3)",
  green:"#36d399", red:"#fb7185", amber:"#fbbf24",
}
const STATUS = {
  pending:{ label:"Oczekuje", color:T.amber, bg:"rgba(251,191,36,.15)" },
  approved:{ label:"Zaakceptowane", color:T.green, bg:"rgba(54,211,153,.15)" },
  changes:{ label:"Poprawki wysłane", color:T.red, bg:"rgba(251,113,133,.15)" },
}

export default function Akceptacja() {
  const router = useRouter()
  const { folderId } = router.query
  const [code, setCode] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [files, setFiles] = useState([])
  const [clientName, setClientName] = useState("")
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState("")
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(null),3500) }

  const unlock = async () => {
    if (!code.trim() || !folderId) return
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/review-get?folderId=${folderId}&code=${encodeURIComponent(code.trim())}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Błąd"); setLoading(false); return }
      setFiles(data.files); setClientName(data.clientName); setUnlocked(true)
    } catch { setError("Błąd połączenia") }
    setLoading(false)
  }

  const respond = async (fileId, status) => {
    const feedback = drafts[fileId] || ""
    if (status === "changes" && !feedback.trim()) { showToast("Napisz najpierw poprawki"); return }
    try {
      const res = await fetch("/api/review-respond", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ folderId, code: code.trim(), fileId, status, feedback }),
      })
      if (!res.ok) { showToast("Błąd zapisu"); return }
      setFiles(prev => prev.map(f => f.id===fileId ? {...f, status, feedback: status==="changes"?feedback:""} : f))
      showToast(status==="approved" ? "✓ Zaakceptowano" : "✓ Poprawki wysłane")
    } catch { showToast("Błąd połączenia") }
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Montserrat',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
        textarea:focus,input:focus{outline:none;border-color:${T.accent}!important;}
        textarea::placeholder,input::placeholder{color:${T.textFaint};}
      `}</style>

      {!unlocked ? (
        <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:40, width:360, textAlign:"center", animation:"fadeUp .3s ease" }}>
            <div style={{ width:52, height:52, borderRadius:13, background:`linear-gradient(135deg,${T.accent},#818cf8)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Projekt do akceptacji</h1>
            <p style={{ fontSize:13, color:T.textDim, marginBottom:20 }}>Wpisz kod dostępu otrzymany od twórcy.</p>
            <input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&unlock()} placeholder="Kod dostępu" autoFocus
              style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:9, padding:"11px 14px", color:T.text, fontSize:14, fontFamily:"inherit", marginBottom:12, textAlign:"center", letterSpacing:"1px" }} />
            {error && <p style={{ color:T.red, fontSize:12, marginBottom:12 }}>{error}</p>}
            <button onClick={unlock} disabled={loading} style={{ width:"100%", background:T.accent, border:"none", color:"#fff", borderRadius:9, padding:"11px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              {loading ? "Sprawdzam…" : "Pokaż projekt"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth:760, margin:"0 auto", padding:"40px 24px 60px", animation:"fadeUp .3s ease" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            {clientName && <div style={{ fontSize:11, letterSpacing:"2px", color:T.textFaint, marginBottom:8 }}>PROJEKT DLA: {clientName.toUpperCase()}</div>}
            <h1 style={{ fontSize:30, fontWeight:800, letterSpacing:"-1px" }}>Miniaturki do akceptacji</h1>
            <p style={{ fontSize:14, color:T.textDim, marginTop:8 }}>Zaakceptuj lub opisz poprawki przy każdej grafice.</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {files.map(f=>{
              const s = STATUS[f.status] || STATUS.pending
              return (
                <div key={f.id} style={{ display:"flex", gap:16, background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:16, flexWrap:"wrap" }}>
                  <div style={{ width:220, height:130, borderRadius:10, overflow:"hidden", flexShrink:0, background:"#000" }}>
                    <img src={`/api/public-image?id=${f.id}`} alt={f.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  </div>
                  <div style={{ flex:1, minWidth:240, display:"flex", flexDirection:"column" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>{f.name}</span>
                      <span style={{ fontSize:11, fontWeight:600, color:s.color, background:s.bg, padding:"3px 10px", borderRadius:20 }}>{s.label}</span>
                    </div>
                    {f.status==="approved" ? (
                      <div style={{ flex:1, display:"flex", alignItems:"center", color:T.green, fontSize:13, fontWeight:500 }}>✓ Zaakceptowano — dziękujemy!</div>
                    ) : (
                      <>
                        <textarea value={drafts[f.id] ?? f.feedback ?? ""} onChange={e=>setDrafts(d=>({...d,[f.id]:e.target.value}))} placeholder="Opisz poprawki (opcjonalnie)…"
                          style={{ flex:1, minHeight:54, background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 10px", color:T.text, fontSize:12.5, fontFamily:"inherit", resize:"none", marginBottom:8 }} />
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={()=>respond(f.id,"approved")} style={{ flex:1, background:T.green, border:"none", color:"#06281c", borderRadius:8, padding:"9px", fontSize:12.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✓ Akceptuję</button>
                          <button onClick={()=>respond(f.id,"changes")} style={{ flex:1, background:T.surfaceHover, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"9px", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Wyślij poprawki</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {toast && <div style={{ position:"fixed", bottom:24, right:24, padding:"11px 18px", borderRadius:10, background:"rgba(54,211,153,.12)", border:"1px solid rgba(54,211,153,.3)", color:T.green, fontSize:13, animation:"slideIn .2s ease", fontWeight:500 }}>{toast}</div>}
    </div>
  )
}
