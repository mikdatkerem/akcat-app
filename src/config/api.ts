// Boş değer aynı origin'i kullanır. VITE_* değerleri tarayıcıya açıktır; sır içermez.
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const apiUrl = (path: `/api/${string}`) => `${apiBaseUrl}${path}`
