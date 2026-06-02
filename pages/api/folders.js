import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const drive = google.drive({ version: "v3", auth })

  if (req.method === "GET") {
    // List folders
    const response = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false`,
      fields: "files(id, name, createdTime, modifiedTime, webViewLink)",
      orderBy: "name",
      pageSize: 200,
    })
    return res.json({ folders: response.data.files || [] })
  }

  if (req.method === "POST") {
    const { name, parentId } = req.body
    if (!name) return res.status(400).json({ error: "Name required" })
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId || "root"],
      },
      fields: "id, name",
    })
    return res.json({ folder: response.data })
  }

  res.status(405).end()
}
