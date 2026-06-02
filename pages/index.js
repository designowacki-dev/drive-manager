import { useSession, signIn, signOut } from "next-auth/react"
import { useState, useEffect, useCallback, useRef } from "react"

export default function Home() {
  const { data: session, status } = useSession()
  const [folders, setFolders] = useState([])
  const [filtered, setFiltered] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileQueue, setFileQueue] = useState([])
  const [toasts, setToasts] = useState([])
  const [showAddClient, setShowAddClient] = useState(false)
  const [showAddFolder, setShowAddFolder] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [over, setOver] = useState(false)
  const toastId = useRef(0)

  const toast = useCallback((msg, type = "success") => {
    const id = ++toastId.current
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }, [])

  const loadFolders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/folders")
      const data = await res.json()
      setFolders(data.folders || [])
      setFiltered(data.folders || [])
    } catch {
      toast("Błąd ładowania folderów", "error")
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    if (session) loadFolders()
  }, [session, loadFolders])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? folders.filter(f => f.name.toLowerCase().includes(q)) : folders)
  }, [search, folders])

  const createClient = async () => {
    if (!newClientName.trim()) return
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim() }),
      })
      const data = await res.json()
      toast(`✓ Folder "${data.folder.name}" utworzony`)
      setNewClientName("")
      setShowAddClient(false)
      loadFolders()
    } catch {
      toast("Błąd tworzenia folderu", "error")
    }
  }

  const createSubfolder = async () => {
    if (!newFolderName.trim() || !selected) return
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parentId: selected.id }),
      })
      const data = await res.json()
      toast(`✓ Podfolder "${data.folder.name}" utworzony`)
      setNewFolderName("")
      setShowAddFolder(false)
    } catch {
      toast("Błąd tworzenia podfolderu", "error")
    }
  }

  const toBase64 = file => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(",")[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const uploadFiles = async (files) => {
    if (!selected || !files.length) return
    setUploading(true)
    const queue = [...files].map(f => ({ name: f.name, status: "pending", file: f }))
    setFileQueue(queue)

    let ok = 0
    for (let i = 0; i < queue.length; i++) {
      setFileQueue(q => q.map((item, idx) => idx === i ? { ...item, status: "uploading" } : item))
      try {
        const base64 = await toBase64(queue[i].file)
        await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: queue[i].name,
            mimeType: queue[i].file.type,
            base64,
            folderId: selected.id,
          }),
        })
        setFileQueue(q => q.map((item, idx) => idx === i ? { ...item, status: "done" } : item))
        ok++
      } catch {
        setFileQueue(q => q.map((item, idx) => idx === i ? { ...item, status: "error" } : item))
      }
    }

    if (ok) toast(`✓ Przesłano ${ok} plik${ok > 1 ? "i" : ""} do "${selected.name}"`)
    setUploading(false)
    setTimeout(() => setFileQueue([]), 2000)
  }

  const handleDrop = e => {
    e.preventDefault(); setOver(false)
    uploadFiles([...e.dataTransfer.files])
  }

  if (status === "loading") return (
    <div style={S.center}>
      <div style={S.spinner} />
    </div>
  )

  if (!session) return (
    <div style={S.center}>
      <div style={S.loginBox}>
        <div style={S.loginIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h1 style={S.loginTitle}>Drive Manager</h1>
        <p style={S.loginSub}>Zaloguj się przez Google żeby zarządzać folderami klientów</p>
        <button style={S.btnGoogle} onClick={() => signIn("google")}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Zaloguj przez Google
        </button>
      </div>
    </div>
  )

  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.logo}>
          <div style={S.logoDot}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span style={S.logoName}>Drive Manager</span>
          <span style={S.logoBadge}>{folders.length} folderów</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:"#64748b" }}>{session.user.email}</span>
          <button style={S.btnSmGhost} onClick={() => signOut()}>Wyloguj</button>
        </div>
      </header>

      <div style={S.layout}>
        {/* SIDEBAR */}
        <aside style={S.aside}>
          <div style={{ padding:"10px 10px 6px" }}>
            <div style={S.searchBox}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input style={S.searchInput} placeholder="Szukaj…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"flex", gap:6, padding:"4px 10px 6px" }}>
            <button className="btn-primary" style={S.btnSm} onClick={() => setShowAddClient(p => !p)}>+ Nowy klient</button>
            <button className="btn-ghost" style={S.btnSm} onClick={loadFolders} disabled={loading}>{loading ? "…" : "↻"}</button>
          </div>

          {showAddClient && (
            <div style={S.addForm}>
              <input style={S.input} placeholder="Nazwa klienta…" value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createClient()} autoFocus />
              <div style={{ display:"flex", gap:5 }}>
                <button className="btn-accent" style={{ ...S.btnSm, flex:1 }} onClick={createClient}>Utwórz</button>
                <button className="btn-ghost" style={S.btnSm} onClick={() => setShowAddClient(false)}>Anuluj</button>
              </div>
            </div>
          )}

          <div style={S.sectionLabel}>Klienci</div>
          <div style={S.clientList}>
            {filtered.length === 0 && <div style={S.emptySidebar}>{loading ? "Ładowanie…" : "Brak folderów"}</div>}
            {filtered.map(f => (
              <div key={f.id} className={`client-row${selected?.id === f.id ? " active" : ""}`}
                style={S.clientRow} onClick={() => { setSelected(f); setShowAddFolder(false); setFileQueue([]) }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" opacity=".6">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main style={S.main}>
          {!selected ? (
            <div style={S.mainEmpty}>
              <div style={S.emptyIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <p style={{ fontSize:13, color:"#64748b" }}>Wybierz klienta z listy</p>
            </div>
          ) : (
            <div style={{ maxWidth:580, animation:"fadeUp .2s ease" }}>
              {/* Client header */}
              <div style={S.clientHeader}>
                <div style={S.clientAvatar}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(91,143,249,.5)" stroke="#5b8ff9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:17, fontWeight:600, marginBottom:2 }}>{selected.name}</div>
                  <a href={selected.webViewLink} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#5b8ff9", textDecoration:"none" }}>Otwórz w Drive →</a>
                </div>
                <button className="btn-ghost" style={S.btnSm} onClick={() => { setSelected(null); setFileQueue([]) }}>✕</button>
              </div>

              {/* Subfolder */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={S.sectionTitle}>Podfolder</span>
                  <button style={S.btnLink} onClick={() => setShowAddFolder(p => !p)}>+ Nowy folder</button>
                </div>
                {showAddFolder && (
                  <div style={{ display:"flex", gap:8, animation:"fadeUp .15s ease" }}>
                    <input style={{ ...S.input, flex:1 }} placeholder="Nazwa folderu…" value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && createSubfolder()} autoFocus />
                    <button className="btn-accent" style={{ ...S.btnSm, padding:"8px 14px" }} onClick={createSubfolder}>Utwórz</button>
                  </div>
                )}
              </div>

              {/* Upload */}
              <div style={S.sectionTitle}>Prześlij pliki</div>
              <div style={{ ...S.dropzone, ...(over ? S.dropzoneOver : {}) }}
                onClick={() => document.getElementById("fi").click()}
                onDragOver={e => { e.preventDefault(); setOver(true) }}
                onDragLeave={() => setOver(false)}
                onDrop={handleDrop}>
                <div style={S.dropIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b8ff9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                </div>
                <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>Przeciągnij pliki lub kliknij</p>
                <small style={{ color:"#64748b", fontSize:11 }}>Trafią bezpośrednio do folderu {selected.name}</small>
                <input id="fi" type="file" multiple style={{ display:"none" }} onChange={e => uploadFiles([...e.target.files])} />
              </div>

              {/* File queue */}
              {fileQueue.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:10 }}>
                  {fileQueue.map((f, i) => (
                    <div key={i} style={S.fileItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                      </svg>
                      <span style={{ flex:1, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</span>
                      <span style={{
                        fontSize:11, width:16, height:16, borderRadius:"50%",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: f.status === "done" ? "rgba(54,211,153,.2)" : f.status === "error" ? "rgba(251,113,133,.2)" : "rgba(91,143,249,.2)",
                        color: f.status === "done" ? "#36d399" : f.status === "error" ? "#fb7185" : "#5b8ff9",
                      }}>
                        {f.status === "done" ? "✓" : f.status === "error" ? "✕" : "…"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Toasts */}
      <div style={S.toasts}>
        {toasts.map(t => (
          <div key={t.id} style={{ ...S.toast, ...(t.type === "error" ? S.toastError : t.type === "info" ? S.toastInfo : S.toastSuccess) }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

const C = {
  bg: "#0a0c10", surface: "#12151c", card: "#191d27", border: "#252a38",
  accent: "#5b8ff9", accentDim: "#1a2a4a", text: "#e2e6f0", muted: "#64748b", subtle: "#94a3b8",
}

const S = {
  root: { minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif" },
  center: { height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg },
  spinner: { width:32, height:32, border:`2px solid ${C.border}`, borderTopColor:C.accent, borderRadius:"50%", animation:"spin .7s linear infinite" },
  loginBox: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:40, width:360, textAlign:"center" },
  loginIcon: { width:56, height:56, borderRadius:14, background:`linear-gradient(135deg,${C.accent},#818cf8)`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", boxShadow:`0 0 24px rgba(91,143,249,.4)` },
  loginTitle: { fontSize:22, fontWeight:700, marginBottom:8 },
  loginSub: { fontSize:13, color:C.subtle, marginBottom:24, lineHeight:1.6 },
  btnGoogle: { display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", background:"#fff", border:"none", color:"#1a1a1a", padding:"11px 20px", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  header: { height:56, background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px" },
  logo: { display:"flex", alignItems:"center", gap:10 },
  logoDot: { width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,${C.accent},#818cf8)`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 14px rgba(91,143,249,.4)` },
  logoName: { fontSize:14, fontWeight:600, letterSpacing:"-.3px" },
  logoBadge: { fontSize:10, background:C.accentDim, color:C.accent, border:`1px solid rgba(91,143,249,.3)`, padding:"2px 7px", borderRadius:20, fontWeight:500 },
  layout: { display:"flex", height:"calc(100vh - 56px)" },
  aside: { width:240, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" },
  searchBox: { display:"flex", alignItems:"center", gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px" },
  searchInput: { background:"none", border:"none", outline:"none", color:C.text, fontSize:12, fontFamily:"inherit", flex:1 },
  btnSm: { padding:"5px 10px", borderRadius:7, fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit", border:`1px solid ${C.border}` },
  addForm: { padding:"4px 10px 10px", display:"flex", flexDirection:"column", gap:6 },
  input: { background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 10px", color:C.text, fontSize:12, fontFamily:"inherit", outline:"none" },
  sectionLabel: { padding:"8px 12px 4px", fontSize:10, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:".8px" },
  clientList: { flex:1, overflowY:"auto", padding:"0 6px 6px" },
  emptySidebar: { padding:16, textAlign:"center", color:C.muted, fontSize:12 },
  clientRow: { display:"flex", alignItems:"center", gap:8, padding:"7px 8px", borderRadius:7, cursor:"pointer", border:"1px solid transparent", marginBottom:1, fontSize:12.5, transition:"all .12s" },
  main: { flex:1, padding:28, overflowY:"auto" },
  mainEmpty: { height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 },
  emptyIcon: { width:52, height:52, borderRadius:13, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4 },
  clientHeader: { display:"flex", alignItems:"center", gap:12, paddingBottom:18, marginBottom:22, borderBottom:`1px solid ${C.border}` },
  clientAvatar: { width:42, height:42, borderRadius:10, background:C.accentDim, border:`1px solid rgba(91,143,249,.3)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  sectionTitle: { fontSize:10, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:".7px", marginBottom:8, display:"block" },
  btnLink: { background:"none", border:"none", color:C.accent, fontSize:11, cursor:"pointer", fontFamily:"inherit" },
  dropzone: { border:`1.5px dashed ${C.border}`, borderRadius:12, padding:"32px 20px", textAlign:"center", cursor:"pointer", background:C.card, transition:"all .2s", display:"flex", flexDirection:"column", alignItems:"center", gap:10, marginBottom:12 },
  dropzoneOver: { borderColor:C.accent, background:"rgba(30,42,74,.6)" },
  dropIcon: { width:44, height:44, borderRadius:11, background:C.accentDim, border:`1px solid rgba(91,143,249,.3)`, display:"flex", alignItems:"center", justifyContent:"center" },
  fileItem: { display:"flex", alignItems:"center", gap:10, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" },
  toasts: { position:"fixed", bottom:20, right:20, display:"flex", flexDirection:"column", gap:6, zIndex:999 },
  toast: { padding:"9px 14px", borderRadius:9, fontSize:12.5, animation:"slideIn .2s ease", maxWidth:280 },
  toastSuccess: { background:"rgba(54,211,153,.12)", border:"1px solid rgba(54,211,153,.3)", color:"#36d399" },
  toastError: { background:"rgba(251,113,133,.12)", border:"1px solid rgba(251,113,133,.3)", color:"#fb7185" },
  toastInfo: { background:"rgba(91,143,249,.12)", border:"1px solid rgba(91,143,249,.3)", color:"#5b8ff9" },
  btnSmGhost: { background:C.card, border:`1px solid ${C.border}`, color:C.subtle, padding:"5px 10px", borderRadius:7, fontSize:11, cursor:"pointer", fontFamily:"inherit" },
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0c10; }
  input::placeholder { color: #64748b; }
  input:focus { border-color: #5b8ff9 !important; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #252a38; border-radius: 3px; }
  .client-row:hover { background: #191d27; }
  .client-row.active { background: #1a2a4a; border-color: rgba(91,143,249,.35) !important; color: #a8c4ff; }
  .btn-primary { background: #1a2a4a; border-color: rgba(91,143,249,.4) !important; color: #5b8ff9; }
  .btn-ghost { background: #191d27; color: #94a3b8; }
  .btn-accent { background: #5b8ff9; border: none !important; color: white; }
  button:hover { opacity: .85; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
`
