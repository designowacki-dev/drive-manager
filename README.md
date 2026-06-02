# Drive Manager

Aplikacja do zarządzania folderami klientów na Google Drive.

---

## Jak uruchomić (krok po kroku)

### 1. Wgraj na GitHub
- Wejdź na github.com → New repository → nazwa: `drive-manager`
- Wgraj wszystkie pliki z tego folderu

### 2. Google OAuth — skonfiguruj raz

1. Wejdź na: https://console.cloud.google.com
2. Utwórz nowy projekt (np. "Drive Manager")
3. Wejdź w **APIs & Services → Enable APIs** → włącz **Google Drive API**
4. Wejdź w **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs dodaj:
   ```
   https://TWOJA-DOMENA.vercel.app/api/auth/callback/google
   ```
7. Skopiuj **Client ID** i **Client Secret**

### 3. Deploy na Vercel

1. Wejdź na vercel.com → New Project → importuj repo z GitHub
2. W sekcji **Environment Variables** dodaj:

   | Nazwa | Wartość |
   |-------|---------|
   | `GOOGLE_CLIENT_ID` | skopiowany Client ID |
   | `GOOGLE_CLIENT_SECRET` | skopiowany Client Secret |
   | `NEXTAUTH_SECRET` | dowolny długi losowy ciąg (np. z https://generate-secret.vercel.app/32) |
   | `NEXTAUTH_URL` | https://TWOJA-DOMENA.vercel.app |

3. Kliknij **Deploy**

### 4. Gotowe!
Otwórz https://TWOJA-DOMENA.vercel.app — zaloguj się przez Google i korzystaj!

---

## Funkcje
- ✅ Lista folderów klientów z Drive (odświeża się na żywo)
- ✅ Tworzenie nowych folderów klientów
- ✅ Tworzenie podfolderów
- ✅ Przeciąganie i przesyłanie plików bezpośrednio na Drive
- ✅ Wyszukiwarka klientów
- ✅ Link do folderu w Drive
