import { ownerDrive } from "../../lib/drive"
import { Readable } from "stream"

const REVIEW_FILE = "_review.json"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()
  const { folderId, code, fileId, status, feedback } = req.body
  if (!folderId || !code || !fileId || !status) return res.status(400).json({ error: "Brak danych" })

  const drive = ownerDrive()

  const list = await drive.files.list({
    q: `'${folderId}' in parents and name = '${REVIEW_FILE}' and trashed = false`,
    fields: "files(id)",
  })
  if (!list.data.files?.length) return res.status(404).json({ error: "Nie znaleziono" })

  const reviewFileId = list.data.files[0].id
  const content = await drive.files.get({ fileId: reviewFileId, alt: "media" })
  const review = typeof content.data === "string" ? JSON.parse(content.data) : content.data

  if (code !== review.code) return res.status(403).json({ error: "Nieprawidłowy kod" })

  // zaktualizuj konkretny plik
  review.files = review.files.map(f =>
    f.id === fileId ? { ...f, status, feedback: status === "changes" ? (feedback || "") : "" } : f
  )

  await drive.files.update({
    fileId: reviewFileId,
    media: { mimeType: "application/json", body: Readable.from(JSON.stringify(review, null, 2)) },
  })

  res.json({ ok: true })
}
