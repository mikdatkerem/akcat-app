import { apiOrigin } from './apiOrigin'
// Boş değer aynı origin'i kullanır. VITE_* değerleri tarayıcıya açıktır; sır içermez.
const apiBaseUrl = apiOrigin(import.meta.env.VITE_API_BASE_URL ?? '', import.meta.env.PROD)

export const apiUrl = (path: `/api/${string}`) => `${apiBaseUrl}${path}`
