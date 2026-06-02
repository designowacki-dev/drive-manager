import { ownerDrive } from "../../lib/drive"

const REVIEW_FILE = "_review.json"

export default async function handler(req, res) {
  const { folderId, code } = req.query
  if (!folderId) return res.status(400).json({ error: "Brak folderId" })

  const drive = ownerDrive()

  // znajdź _review.json
  const list = await drive.files.list({
    q: `'${folderId}' in parents and name = '${REVIEW_FILE}' and trashed = false`,
    fields: "files(id)",
  })
  if (!list.data.files || list.data.files.length === 0) {
    return res.status(404).json({ error: "Nie znaleziono projektu do akceptacji" })
  }

  const fileId = list.data.files[0].id
  const content = await drive.files.get({ fileId, alt: "media" })
  const review = typeof content.data === "string" ? JSON.parse(content.data) : content.data

  // weryfikacja kodu (jeśli podany — tryb klienta)
  if (code !== undefined) {
    if (code !== review.code) return res.status(403).json({ error: "Nieprawidłowy kod" })
  }

  // zwróć dane bez kodu
  res.json({
    clientName: review.clientName,
    files: review.files.map(f => ({ id: f.id, name: f.name, status: f.status, feedback: f.feedback })),
  })
}
