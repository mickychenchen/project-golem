// API base URL: points directly to backend in dev mode to bypass Next.js proxy.
// Set NEXT_PUBLIC_API_URL in .env.local for dev or leave empty for production.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function apiUrl(path: string): string {
    return `${API_BASE}${path}`;
}
