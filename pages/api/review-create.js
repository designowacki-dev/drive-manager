import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"
import { google } from "googleapis"
import { Readable } from "stream"

const REVIEW_FILE = "_review.json"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Unauthorized" })

  const { folderId, code, clientName } = req.body
  if (!folderId || !code) return res.status(400).json({ error: "Brak folderId lub kodu" })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const drive = google.drive({ version: "v3", auth })

  // pobierz pliki-obrazy w folderze
  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
    fields: "files(id, name)",
    pageSize: 200,
  })
  const files = (list.data.files || []).map(f => ({
    id: f.id, name: f.name, status: "pending", feedback: "",
  }))

  // udostępnij pliki publicznie (anyone with link, tylko odczyt)
  for (const f of files) {
    try {
      await drive.permissions.create({
        fileId: f.id,
        requestBody: { role: "reader", type: "anyone" },
      })
    } catch {}
  }

  const review = { code, clientName: clientName || "", createdAt: Date.now(), files }
  const content = JSON.stringify(review, null, 2)

  // sprawdź czy _review.json już istnieje
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name = '${REVIEW_FILE}' and trashed = false`,
    fields: "files(id)",
  })

  if (existing.data.files && existing.data.files.length > 0) {
    await drive.files.update({
      fileId: existing.data.files[0].id,
      media: { mimeType: "application/json", body: Readable.from(content) },
    })
  } else {
    await drive.files.create({
      requestBody: { name: REVIEW_FILE, parents: [folderId], appProperties: { isReview: "1" } },
      media: { mimeType: "application/json", body: Readable.from(content) },
      fields: "id",
    })
  }

  res.json({ ok: true, reviewUrl: `/akceptacja/${folderId}`, count: files.length })
}
