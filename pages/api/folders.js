import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"

function driveClient(session) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  return google.drive({ version: "v3", auth })
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })
  const drive = driveClient(session)

  // LISTA folderów klientów (z kolorem i kategorią)
  if (req.method === "GET") {
    const response = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`,
      fields: "files(id, name, webViewLink, appProperties)",
      orderBy: "name",
      pageSize: 200,
    })
    const folders = (response.data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      webViewLink: f.webViewLink,
      color: f.appProperties?.color || "#64748b",
      cat: f.appProperties?.cat || "send",
    }))
    return res.json({ folders })
  }

  // TWORZENIE nowego folderu klienta
  if (req.method === "POST") {
    const { name, parentId, color, cat } = req.body
    if (!name) return res.status(400).json({ error: "Name required" })
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId || "root"],
        appProperties: parentId ? {} : { color: color || "#64748b", cat: cat || "send" },
      },
      fields: "id, name, webViewLink, appProperties",
    })
    const f = response.data
    return res.json({ folder: { id: f.id, name: f.name, webViewLink: f.webViewLink, color: f.appProperties?.color || "#64748b", cat: f.appProperties?.cat || "send" } })
  }

  // AKTUALIZACJA koloru / kategorii
  if (req.method === "PATCH") {
    const { id, color, cat } = req.body
    if (!id) return res.status(400).json({ error: "id required" })
    const appProperties = {}
    if (color !== undefined) appProperties.color = color
    if (cat !== undefined) appProperties.cat = cat
    await drive.files.update({
      fileId: id,
      requestBody: { appProperties },
    })
    return res.json({ ok: true })
  }

  res.status(405).end()
}
