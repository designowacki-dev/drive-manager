import { ownerDrive } from "../../lib/drive"

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).end()

  const drive = ownerDrive()
  try {
    const meta = await drive.files.get({ fileId: id, fields: "mimeType" })
    res.setHeader("Content-Type", meta.data.mimeType || "image/jpeg")
    res.setHeader("Cache-Control", "public, max-age=3600")
    const fileRes = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "stream" })
    await new Promise((resolve, reject) => {
      fileRes.data.on("end", resolve).on("error", reject).pipe(res)
    })
  } catch {
    res.status(404).end()
  }
}
