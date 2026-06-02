import { getServerSession } from "next-auth"
import { authOptions } from "./auth/[...nextauth]"

// JEDNORAZOWY endpoint do skopiowania refresh tokena.
// Po skonfigurowaniu env var można go usunąć.
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: "Zaloguj się najpierw" })
  if (!session.refreshToken) {
    return res.json({ error: "Brak refresh tokena — wyloguj się i zaloguj ponownie, potem odśwież tę stronę." })
  }
  res.json({
    info: "Skopiuj wartość refreshToken i wklej jako zmienną GOOGLE_REFRESH_TOKEN na Vercel.",
    refreshToken: session.refreshToken,
  })
}
