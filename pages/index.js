import { useSession, signIn, signOut } from "next-auth/react"
import { useState, useEffect, useCallback, useRef } from "react"

const PALETTE = [
  "#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#10b981","#14b8a6",
  "#06b6d4","#0ea5e9","#3b82f6","#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899",
  "#f43f5e","#78716c","#64748b","#3a3f4b",
]

const MIESIACE = ["stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"]
function dzisiejszaData() {
  const d = new Date()
  return `${d.getDate()} ${MIESIACE[d.getMonth()]} ${d.getFullYear()}`
}

export default function Home() {
  const { data: session, status } = useSession()
  const [dark, setDark] = useState(true)
  const [clients, setClients] = useState([])
  const [tab, setTab] = useState("send")
  const [view, setView] = useState("grid")
  const [selected, setSelected] = useState(null)
  const [folderItems, setFolderItems] = useState([])   // dated folders of client
  const [openFolder, setOpenFolder] = useState(null)
  const [openFiles, setOpenFiles] = useState([])       // files in dated folder
  const [loading, setLoading] = useState(false)
  const [over, setOver] = useState(false)
  const [queue, setQueue] = useState([])
  const [toast, setToast] = useState(null)
  const [lastLink, setLastLink] = useState(null)
  const [colorPickerFor, setColorPickerFor] = useState(null)
  const [showAddClient, setShowAddClient] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [reviewModal, setReviewModal] = useState(null)  // {folderId, name}
  const [reviewCode, setReviewCode] = useState("")
  const [reviewResult, setReviewResult] = useState(null)
  const [reviewStatus, setReviewStatus] = useState(null) // statuses for open folder
  const fileRef = useRef()
  const toastTimer = useRef()

  const T = dark ? {
    bg:"#0d0f13", bgGrad:"#14171d", surface:"rgba(255,255,255,.04)", surfaceHover:"rgba(255,255,255,.07)",
    border:"rgba(255,255,255,.08)", borderStrong:"rgba(255,255,255,.15)",
    text:"#f1f3f7", textDim:"rgba(255,255,255,.55)", textFaint:"rgba(255,255,255,.38)",
    accent:"#5b8ff9", inputBg:"rgba(0,0,0,.3)", panel:"#1a1d24",
  } : {
    bg:"#f4f5f7", bgGrad:"#e8eaee", surface:"#ffffff", surfaceHover:"#f8f9fb",
    border:"rgba(0,0,0,.1)", borderStrong:"rgba(0,0,0,.18)",
    text:"#1a1d24", textDim:"rgba(0,0,0,.55)", textFaint:"rgba(0,0,0,.4)",
    accent:"#3b82f6", inputBg:"rgba(0,0,0,.04)", panel:"#ffffff",
  }

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const loadFolders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/folders")
      const data = await res.json()
      setClients(data.folders || [])
    } catch { showToast("Błąd ładowania") }
    setLoading(false)
  }, [])

  useEffect(() => { if (session) loadFolders() }, [session, loadFolders])

  const visibleClients = clients.filter(c => c.cat === tab)

  const openClient = async (c) => {
    setSelected(c); setView("client"); setLastLink(null); setQueue([])
    setLoading(true)
    try {
      const res = await fetch(`/api/folder-contents?folderId=${c.id}`)
      const data = await res.json()
      setFolderItems((data.items || []).filter(i => i.isFolder))
    } catch { setFolderItems([]) }
    setLoading(false)
  }

  const openDatedFolder = async (folder) => {
    setOpenFolder(folder); setView("folder")
    setLoading(true)
    loadReviewStatus(folder.id)
    try {
      const res = await fetch(`/api/folder-contents?folderId=${folder.id}`)
      const data = await res.json()
      setOpenFiles((data.items || []).filter(i => !i.isFolder && i.name !== "_review.json"))
    } catch { setOpenFiles([]) }
    setLoading(false)
  }

  const createClient = async () => {
    if (!newClientName.trim()) return
    try {
      await fetch("/api/folders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim(), cat: tab, color: "#64748b" }),
      })
      showToast(`✓ Dodano „${newClientName.trim()}"`)
      setNewClientName(""); setShowAddClient(false); loadFolders()
    } catch { showToast("Błąd tworzenia") }
  }

  const setColor = async (id, color) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, color } : c))
    setColorPickerFor(null)
    try { await fetch("/api/folders", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, color }) }) } catch {}
  }

  const moveClient = async (id, cat) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, cat } : c))
    if (selected?.id === id) setSelected(s => ({ ...s, cat }))
    showToast(cat === "send" ? "✓ Przeniesiono do „Do wysłania”" : "✓ Przeniesiono do „Materiały”")
    try { await fetch("/api/folders", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, cat }) }) } catch {}
  }

  const toBase64 = file => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file)
  })

  const handleFiles = async (files) => {
    if (!selected || !files.length) return
    const q = [...files].map(f => ({ name: f.name, status: "pending" }))
    setQueue(q)
    let link = null
    for (let i = 0; i < q.length; i++) {
      setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status:"uploading" } : it))
      try {
        const base64 = await toBase64(files[i])
        const res = await fetch("/api/upload", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name: files[i].name, mimeType: files[i].type, base64, folderId: selected.id }),
        })
        const data = await res.json()
        if (data.file?.webViewLink) link = { name: data.dateFolder, url: data.file.webViewLink }
        setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status:"done" } : it))
      } catch {
        setQueue(prev => prev.map((it, idx) => idx === i ? { ...it, status:"error" } : it))
      }
    }
    if (link) setLastLink(link)
    showToast(`✓ Przesłano ${files.length} plik${files.length>1?"i":""} → ${dzisiejszaData()}`)
    openClient(selected)  // odśwież listę folderów
    setTimeout(() => setQueue([]), 1500)
  }

  const handleDrop = e => { e.preventDefault(); setOver(false); handleFiles([...e.dataTransfer.files]) }
  const copyLink = () => { if (lastLink) { navigator.clipboard?.writeText(lastLink.url); showToast("✓ Link skopiowany") } }

  // Otwórz okno wysyłki do akceptacji
  const openReviewModal = (folder) => { setReviewModal(folder); setReviewCode(""); setReviewResult(null) }

  // Utwórz link akceptacji
  const createReview = async () => {
    if (!reviewModal || !reviewCode.trim()) return
    try {
      const res = await fetch("/api/review-create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ folderId: reviewModal.id, code: reviewCode.trim(), clientName: selected?.name || "" }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || "Błąd"); return }
      const url = `${window.location.origin}/akceptacja?id=${reviewModal.id}`
      setReviewResult({ url, code: reviewCode.trim(), count: data.count })
    } catch { showToast("Błąd połączenia") }
  }

  // Załaduj statusy akceptacji dla otwartego folderu
  const loadReviewStatus = async (folderId) => {
    setReviewStatus(null)
    try {
      const res = await fetch(`/api/review-get?folderId=${folderId}`)
      if (res.ok) { const data = await res.json(); setReviewStatus(data.files) }
    } catch {}
  }

  // ===== LOGIN SCREENS =====
  if (status === "loading") return <Center T={T}><Spinner T={T} /></Center>

  if (!session) return (
    <Center T={T}>
      <Font />
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:40, width:360, textAlign:"center" }}>
        <div style={{ width:56, height:56, borderRadius:14, background:`linear-gradient(135deg,${T.accent},#818cf8)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </div>
        <h1 style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Drive Manager</h1>
        <p style={{ fontSize:13, color:T.textDim, marginBottom:24 }}>Zaloguj się przez Google, aby zarządzać folderami klientów</p>
        <button onClick={() => signIn("google")} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", background:"#fff", border:"none", color:"#1a1a1a", padding:"11px 20px", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Montserrat',sans-serif" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Zaloguj przez Google
        </button>
      </div>
    </Center>
  )

  // ===== APP =====
  return (
    <div style={{ minHeight:"100vh", position:"relative", overflow:"hidden", background:T.bg, color:T.text, fontFamily:"'Montserrat',system-ui,sans-serif", transition:"background .3s,color .3s" }}>
      <Font />
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:translateY(0);} }
        @keyframes slideIn { from{opacity:0;transform:translateX(16px);} to{opacity:1;transform:translateX(0);} }
        @keyframes spin { to{transform:rotate(360deg);} }
        .tile { transition:all .22s cubic-bezier(.4,0,.2,1); }
        .tile:hover { transform:translateY(-3px); }
        .dlbtn { opacity:0; transition:opacity .15s; }
        .thumb:hover .dlbtn { opacity:1; }
        input:focus { outline:none; border-color:${T.accent} !important; }
        input::placeholder { color:${T.textFaint}; }
      `}</style>

      <div style={{ position:"absolute", inset:0, zIndex:0, background:`radial-gradient(ellipse at 70% 0%, ${T.bgGrad}, transparent 55%)` }} />

      {/* top bar */}
      <div style={{ position:"relative", zIndex:5, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 24px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,${T.accent},#818cf8)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span style={{ fontWeight:700, fontSize:14 }}>Drive Manager</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:T.textFaint }}>{session.user.email}</span>
          <button onClick={() => setDark(d=>!d)} style={chip(T)}>{dark?"☀️":"🌙"}</button>
          <button onClick={() => signOut()} style={chip(T)}>Wyloguj</button>
        </div>
      </div>

      <div style={{ position:"relative", zIndex:5, maxWidth:960, margin:"0 auto", padding:"28px 24px 60px" }}>

        {/* GRID */}
        {view === "grid" && (
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <h1 style={{ fontSize:44, fontWeight:800, letterSpacing:"-1.5px", marginBottom:10, lineHeight:1 }}>Twoi klienci</h1>
              <p style={{ fontSize:14, color:T.textDim }}>Kliknij kafelek, aby wgrać pliki. Kropka = kolor. ⇄ = przenieś.</p>
            </div>

            <div style={{ display:"flex", justifyContent:"center", marginBottom:28 }}>
              <div style={{ display:"flex", gap:4, background:T.surface, border:`1px solid ${T.border}`, borderRadius:100, padding:5 }}>
                {[["send","📤 Do wysłania"],["source","🗂️ Materiały"]].map(([k,label])=>(
                  <button key={k} onClick={()=>setTab(k)} style={{ fontSize:13, fontWeight:600, padding:"9px 20px", borderRadius:100, cursor:"pointer", fontFamily:"inherit", border:"none", background: tab===k?T.accent:"transparent", color: tab===k?"#fff":T.textDim }}>
                    {label} <span style={{opacity:.6,fontWeight:500}}>· {clients.filter(c=>c.cat===k).length}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
              {visibleClients.map(c=>(
                <div key={c.id} className="tile" onClick={()=>openClient(c)}
                  style={{ cursor:"pointer", borderRadius:16, padding:"26px 16px", minHeight:128, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, background:T.surface, border:`1px solid ${T.border}`, position:"relative", boxShadow:dark?"none":"0 1px 3px rgba(0,0,0,.06)" }}>
                  <button onClick={(e)=>{ e.stopPropagation(); setColorPickerFor(colorPickerFor===c.id?null:c.id) }} style={{ position:"absolute", top:10, left:10, width:14, height:14, borderRadius:"50%", background:c.color, border:"2px solid rgba(255,255,255,.25)", cursor:"pointer", padding:0 }} />
                  <button title="Przenieś" onClick={(e)=>{ e.stopPropagation(); moveClient(c.id, c.cat==="send"?"source":"send") }} style={{ position:"absolute", top:8, right:8, width:22, height:22, borderRadius:6, background:T.surfaceHover, border:`1px solid ${T.border}`, color:T.textDim, cursor:"pointer", fontSize:12, padding:0 }}>⇄</button>
                  <div style={{ width:46, height:46, borderRadius:12, background:c.color, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 4px 14px ${c.color}55` }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <span style={{ fontSize:13.5, fontWeight:600, textAlign:"center" }}>{c.name}</span>
                  {colorPickerFor===c.id && (
                    <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", top:30, left:10, zIndex:20, background:T.panel, border:`1px solid ${T.borderStrong}`, borderRadius:12, padding:10, boxShadow:"0 8px 30px rgba(0,0,0,.35)", display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, width:180 }}>
                      {PALETTE.map(p=>(<button key={p} onClick={()=>setColor(c.id,p)} style={{ width:26, height:26, borderRadius:7, background:p, border:c.color===p?"2px solid #fff":"2px solid transparent", cursor:"pointer", padding:0 }} />))}
                    </div>
                  )}
                </div>
              ))}
              {/* dodaj klienta */}
              <div className="tile" onClick={()=>setShowAddClient(true)} style={{ cursor:"pointer", borderRadius:16, padding:"26px 16px", minHeight:128, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, background:"transparent", border:`1.5px dashed ${T.borderStrong}`, color:T.textDim }}>
                <div style={{ fontSize:28, fontWeight:300 }}>+</div>
                <span style={{ fontSize:12, fontWeight:500 }}>Nowy klient</span>
              </div>
            </div>

            {showAddClient && (
              <div onClick={()=>setShowAddClient(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:60, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div onClick={e=>e.stopPropagation()} style={{ background:T.panel, border:`1px solid ${T.borderStrong}`, borderRadius:16, padding:24, width:340 }}>
                  <h3 style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Nowy klient</h3>
                  <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createClient()} placeholder="Nazwa klienta…" autoFocus style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:9, padding:"10px 12px", color:T.text, fontSize:13, fontFamily:"inherit", marginBottom:12 }} />
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={createClient} style={{ flex:1, background:T.accent, border:"none", color:"#fff", borderRadius:9, padding:"10px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Utwórz folder</button>
                    <button onClick={()=>setShowAddClient(false)} style={chip(T)}>Anuluj</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLIENT */}
        {view === "client" && selected && (
          <div style={{ animation:"fadeUp .3s ease", maxWidth:640, margin:"0 auto" }}>
            <button onClick={()=>{ setView("grid"); setLastLink(null); setQueue([]) }} style={navBtn(T)}>← Wszyscy klienci</button>
            <div style={{ display:"flex", alignItems:"center", gap:14, margin:"20px 0 24px" }}>
              <div style={{ width:48, height:48, borderRadius:12, background:selected.color, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 6px 20px ${selected.color}55` }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <h2 style={{ fontSize:28, fontWeight:700, letterSpacing:"-.5px" }}>{selected.name}</h2>
                <span style={{ fontSize:11, color:T.textFaint }}>{selected.cat==="send"?"📤 Do wysłania":"🗂️ Materiały"}</span>
              </div>
              <a href={selected.webViewLink} target="_blank" rel="noreferrer" style={{ ...navBtn(T), textDecoration:"none" }}>Drive ↗</a>
              <button onClick={()=>moveClient(selected.id, selected.cat==="send"?"source":"send")} style={navBtn(T)}>⇄</button>
            </div>

            {folderItems.length>0 && (
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:11, letterSpacing:"1.5px", color:T.textFaint, marginBottom:12, fontWeight:600 }}>FOLDERY</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                  {folderItems.map(f=>(
                    <div key={f.id} className="tile" onClick={()=>openDatedFolder(f)} style={{ cursor:"pointer", borderRadius:14, padding:"20px 16px", background:T.surface, border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", gap:8 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={selected.color}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <span style={{ fontSize:13, fontWeight:600 }}>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize:11, letterSpacing:"1.5px", color:T.textFaint, marginBottom:12, fontWeight:600 }}>{selected.cat==="send"?"PRZEŚLIJ MINIATURKI":"PRZEŚLIJ MATERIAŁY"}</div>
            <div onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={handleDrop}
              style={{ border:`1.5px dashed ${over?selected.color:T.borderStrong}`, borderRadius:16, padding:"36px 20px", textAlign:"center", cursor:"pointer", background:over?`${selected.color}11`:T.surface, display:"flex", flexDirection:"column", alignItems:"center", gap:12, transition:"all .2s" }}>
              <div style={{ width:48, height:48, borderRadius:12, background:`${selected.color}22`, border:`1px solid ${selected.color}55`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={selected.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
              </div>
              <p style={{ fontSize:14, color:T.textDim, fontWeight:500 }}>Przeciągnij pliki lub kliknij</p>
              <small style={{ fontSize:12, color:T.textFaint }}>Trafią do folderu „{dzisiejszaData()}"</small>
              <input ref={fileRef} type="file" multiple style={{display:"none"}} onChange={e=>handleFiles([...e.target.files])} />
            </div>

            {queue.length>0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:14 }}>
                {queue.map((f,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px" }}>
                    <span style={{ flex:1, fontSize:12 }}>{f.name}</span>
                    <span style={{ width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, background:f.status==="done"?"rgba(54,211,153,.2)":f.status==="error"?"rgba(251,113,133,.2)":`${selected.color}33`, color:f.status==="done"?"#36d399":f.status==="error"?"#fb7185":selected.color, border:f.status==="uploading"?`2px solid ${selected.color}`:"none", borderTopColor:f.status==="uploading"?"transparent":undefined, animation:f.status==="uploading"?"spin .6s linear infinite":"none" }}>{f.status==="done"?"✓":f.status==="error"?"✕":""}</span>
                  </div>
                ))}
              </div>
            )}

            {lastLink && (
              <div style={{ marginTop:16, padding:"14px 16px", borderRadius:12, background:"rgba(54,211,153,.08)", border:"1px solid rgba(54,211,153,.25)", animation:"fadeUp .3s ease" }}>
                <div style={{ fontSize:12, color:"#36d399", marginBottom:8, fontWeight:600 }}>✓ Folder „{lastLink.name}" gotowy</div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <input readOnly value={lastLink.url} style={{ flex:1, background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 10px", color:T.textDim, fontSize:11, fontFamily:"monospace" }} />
                  <button onClick={copyLink} style={{ background:"#36d399", border:"none", color:"#0a0608", borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Kopiuj</button>
                  <a href={lastLink.url} target="_blank" rel="noreferrer" style={{ background:T.surfaceHover, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", textDecoration:"none" }}>Otwórz</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOLDER (podgląd plików + pobieranie) */}
        {view === "folder" && selected && openFolder && (
          <div style={{ animation:"fadeUp .3s ease", maxWidth:640, margin:"0 auto" }}>
            <button onClick={()=>setView("client")} style={navBtn(T)}>← {selected.name}</button>
            <div style={{ display:"flex", alignItems:"center", gap:14, margin:"20px 0 24px" }}>
              <div style={{ width:48, height:48, borderRadius:12, background:selected.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h2 style={{ fontSize:24, fontWeight:700 }}>{openFolder.name}</h2>
            </div>
            {openFiles.length === 0 ? (
              <p style={{ color:T.textFaint, fontSize:13 }}>{loading ? "Ładowanie…" : "Folder jest pusty"}</p>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {openFiles.map(f=>{
                  const rev = reviewStatus?.find(r => r.id === f.id)
                  const badge = rev && rev.status !== "pending"
                    ? (rev.status === "approved"
                        ? { t:"✓ Zaakceptowane", c:"#36d399", b:"rgba(54,211,153,.9)" }
                        : { t:"✏ Poprawki", c:"#fff", b:"rgba(251,113,133,.92)" })
                    : (reviewStatus ? { t:"Oczekuje", c:"#0d0f13", b:"rgba(251,191,36,.92)" } : null)
                  return (
                  <div key={f.id} className="thumb" style={{ borderRadius:14, overflow:"hidden", background:T.surface, border:`1px solid ${T.border}`, position:"relative" }}>
                    <div style={{ height:110, background:`${selected.color}22`, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                      {f.isImage ? (
                        <img src={`/api/file?id=${f.id}`} alt={f.name} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                      )}
                      {badge && <span style={{ position:"absolute", top:8, left:8, fontSize:10, fontWeight:700, color:badge.c, background:badge.b, padding:"2px 8px", borderRadius:20 }}>{badge.t}</span>}
                      <a className="dlbtn" href={`/api/file?id=${f.id}&download=1`} title="Pobierz" style={{ position:"absolute", top:8, right:8, width:30, height:30, borderRadius:8, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    </div>
                    <div style={{ padding:"10px 12px" }}>
                      <div style={{ fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                      {rev?.status === "changes" && rev.feedback && (
                        <div style={{ marginTop:6, fontSize:11, color:T.text, background:"rgba(251,113,133,.1)", border:"1px solid rgba(251,113,133,.25)", borderRadius:6, padding:"6px 8px" }}>
                          <span style={{ color:"#fb7185", fontWeight:600 }}>Poprawki: </span>{rev.feedback}
                        </div>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )}

            {/* Wyślij do akceptacji */}
            <button onClick={()=>openReviewModal(openFolder)} style={{ marginTop:16, width:"100%", background:T.accent, border:"none", color:"#fff", borderRadius:12, padding:"13px", fontSize:13.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              Wyślij do akceptacji klientowi
            </button>

            <a href={openFolder.webViewLink} target="_blank" rel="noreferrer" style={{ marginTop:10, display:"block", textAlign:"center", background:T.surface, border:`1px solid ${T.border}`, color:T.textDim, borderRadius:12, padding:"11px", fontSize:12.5, fontWeight:600, textDecoration:"none" }}>
              Otwórz folder w Google Drive ↗
            </a>
          </div>
        )}
      </div>

      {/* OKNO: Wyślij do akceptacji */}
      {reviewModal && (
        <div onClick={()=>setReviewModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:60, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.panel, border:`1px solid ${T.borderStrong}`, borderRadius:16, padding:24, width:420, maxWidth:"100%" }}>
            {!reviewResult ? (
              <>
                <h3 style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>Wyślij do akceptacji</h3>
                <p style={{ fontSize:12.5, color:T.textDim, marginBottom:16 }}>Folder „{reviewModal.name}" — ustaw kod dostępu, który podasz klientowi.</p>
                <label style={{ fontSize:11, color:T.textFaint, fontWeight:600 }}>KOD DOSTĘPU</label>
                <input value={reviewCode} onChange={e=>setReviewCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createReview()} placeholder="np. konop2026" autoFocus
                  style={{ width:"100%", background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:9, padding:"10px 12px", color:T.text, fontSize:14, fontFamily:"inherit", margin:"6px 0 16px" }} />
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={createReview} disabled={!reviewCode.trim()} style={{ flex:1, background:T.accent, border:"none", color:"#fff", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity: reviewCode.trim()?1:.4 }}>Utwórz link</button>
                  <button onClick={()=>setReviewModal(null)} style={chip(T)}>Anuluj</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize:17, fontWeight:700, marginBottom:6, color:T.accent }}>✓ Link gotowy</h3>
                <p style={{ fontSize:12.5, color:T.textDim, marginBottom:16 }}>{reviewResult.count} miniaturek udostępnionych. Wyślij klientowi link i kod.</p>
                <label style={{ fontSize:11, color:T.textFaint, fontWeight:600 }}>LINK DLA KLIENTA</label>
                <div style={{ display:"flex", gap:8, margin:"6px 0 12px" }}>
                  <input readOnly value={reviewResult.url} style={{ flex:1, background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 11px", color:T.textDim, fontSize:11.5, fontFamily:"monospace" }} />
                  <button onClick={()=>{ navigator.clipboard?.writeText(reviewResult.url); showToast("✓ Link skopiowany") }} style={{ background:T.accent, border:"none", color:"#fff", borderRadius:8, padding:"0 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Kopiuj</button>
                </div>
                <label style={{ fontSize:11, color:T.textFaint, fontWeight:600 }}>KOD DOSTĘPU</label>
                <div style={{ display:"flex", gap:8, margin:"6px 0 16px" }}>
                  <input readOnly value={reviewResult.code} style={{ flex:1, background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"9px 11px", color:T.text, fontSize:14, fontFamily:"monospace", letterSpacing:"1px", fontWeight:600 }} />
                  <button onClick={()=>{ navigator.clipboard?.writeText(reviewResult.code); showToast("✓ Kod skopiowany") }} style={{ background:T.surfaceHover, border:`1px solid ${T.border}`, color:T.text, borderRadius:8, padding:"0 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Kopiuj</button>
                </div>
                <button onClick={()=>{ setReviewModal(null); loadReviewStatus(reviewModal.id) }} style={{ width:"100%", background:T.accent, border:"none", color:"#fff", borderRadius:9, padding:"11px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Gotowe</button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, zIndex:50, padding:"11px 18px", borderRadius:10, background:"rgba(54,211,153,.12)", border:"1px solid rgba(54,211,153,.3)", color:"#36d399", fontSize:13, animation:"slideIn .2s ease", backdropFilter:"blur(8px)", fontWeight:500 }}>{toast}</div>
      )}
    </div>
  )
}

function Font() {
  return <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');`}</style>
}
function Center({ children, T }) {
  return <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, fontFamily:"'Montserrat',sans-serif" }}>{children}</div>
}
function Spinner({ T }) {
  return <div style={{ width:32, height:32, border:`2px solid ${T.border}`, borderTopColor:T.accent, borderRadius:"50%", animation:"spin .7s linear infinite" }} />
}
const chip = (T) => ({ background:T.surface, border:`1px solid ${T.border}`, color:T.text, borderRadius:100, padding:"6px 14px", fontSize:12, cursor:"pointer", fontFamily:"'Montserrat',sans-serif", fontWeight:500 })
const navBtn = (T) => ({ background:T.surface, border:`1px solid ${T.border}`, color:T.textDim, borderRadius:100, padding:"7px 16px", fontSize:12, cursor:"pointer", fontFamily:"'Montserrat',sans-serif", fontWeight:500 })
