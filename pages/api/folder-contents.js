import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })

  const { folderId } = req.query
  if (!folderId) return res.status(400).json({ error: "folderId required" })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const drive = google.drive({ version: "v3", auth })

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, createdTime)",
    orderBy: "folder,name desc,createdTime desc",
    pageSize: 500,
  })

  const items = (response.data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    isImage: (f.mimeType || "").startsWith("image/"),
    mimeType: f.mimeType,
    webViewLink: f.webViewLink,
  }))

  res.json({ items })
}
