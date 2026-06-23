import { handlers } from "@/auth";

// Route handler cho Auth.js: /api/auth/* (signin, callback, signout, session...).
export const { GET, POST } = handlers;
