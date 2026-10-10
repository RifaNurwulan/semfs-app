const KEY = 'semfs_token'

// "Ingat saya" dicentang -> localStorage (tetap login setelah browser ditutup).
// Tidak dicentang -> sessionStorage (hilang saat tab/browser ditutup).
export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string, remember: boolean) {
  clearToken()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(KEY, token)
  } catch {
    /* penyimpanan browser tidak tersedia */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}
