import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"
import { Readable } from "stream"

export const config = { api: { bodyParser: { sizeLimit: "50mb" } } }

// Polskie nazwy miesięcy
const MIESIACE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia"
]

function dzisiejszaData() {
  const d = new Date()
  return `${d.getDate()} ${MIESIACE[d.getMonth()]} ${d.getFullYear()}`
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })

  const { name, mimeType, base64, folderId } = req.body
  if (!name || !base64 || !folderId) return res.status(400).json({ error: "Missing fields" })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const drive = google.drive({ version: "v3", auth })

  // 1. Sprawdź czy folder z dzisiejszą datą już istnieje w folderze klienta
  const dataFolder = dzisiejszaData()
  let dateFolderId

  const existing = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents and name = '${dataFolder}' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
  })

  if (existing.data.files && existing.data.files.length > 0) {
    // Folder z datą już istnieje — użyj go
    dateFolderId = existing.data.files[0].id
  } else {
    // Utwórz nowy folder z datą
    const newFolder = await drive.files.create({
      requestBody: {
        name: dataFolder,
        mimeType: "application/vnd.google-apps.folder",
        parents: [folderId],
      },
      fields: "id",
    })
    dateFolderId = newFolder.data.id
  }

  // 2. Wgraj plik do folderu z datą
  const buffer = Buffer.from(base64, "base64")
  const stream = Readable.from(buffer)

  const response = await drive.files.create({
    requestBody: {
      name,
      parents: [dateFolderId],
    },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: stream,
    },
    fields: "id, name, webViewLink",
  })

  res.json({ file: response.data, dateFolder: dataFolder })
}
