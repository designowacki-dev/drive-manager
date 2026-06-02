import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"
import { Readable } from "stream"

export const config = { api: { bodyParser: { sizeLimit: "50mb" } } }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })

  const { name, mimeType, base64, folderId } = req.body
  if (!name || !base64 || !folderId) return res.status(400).json({ error: "Missing fields" })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const drive = google.drive({ version: "v3", auth })

  const buffer = Buffer.from(base64, "base64")
  const stream = Readable.from(buffer)

  const response = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: stream,
    },
    fields: "id, name, webViewLink",
  })

  res.json({ file: response.data })
}
