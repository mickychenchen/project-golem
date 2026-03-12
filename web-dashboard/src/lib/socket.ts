import { io } from "socket.io-client";

// NEXT_PUBLIC_SOCKET_URL is set in .env.local for dev (points directly to port 3001)
// In production, backend serves everything, so empty string means current origin.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";

export const socket = io(SOCKET_URL, {
    autoConnect: true,
});
