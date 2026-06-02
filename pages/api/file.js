import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })

  const { id, download } = req.query
  if (!id) return res.status(400).json({ error: "id required" })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const drive = google.drive({ version: "v3", auth })

  // pobierz metadane (nazwa + typ)
  const meta = await drive.files.get({ fileId: id, fields: "name, mimeType" })
  const { name, mimeType } = meta.data

  res.setHeader("Content-Type", mimeType || "application/octet-stream")
  if (download) {
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`)
  }

  // strumieniuj zawartość pliku
  const fileRes = await drive.files.get(
    { fileId: id, alt: "media" },
    { responseType: "stream" }
  )

  await new Promise((resolve, reject) => {
    fileRes.data
      .on("end", resolve)
      .on("error", reject)
      .pipe(res)
  })
}
