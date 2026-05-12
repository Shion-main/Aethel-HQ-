import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "aethel_admin";

const sign = (payload: string) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${mac}`;
};

const verify = (value: string | undefined) => {
  if (!value) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b) && payload === "admin:1";
};

export const checkPassword = (input: string) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export const setAdminCookie = () => {
  cookies().set(COOKIE_NAME, sign("admin:1"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
};

export const clearAdminCookie = () => {
  cookies().delete(COOKIE_NAME);
};

export const isAdmin = () => verify(cookies().get(COOKIE_NAME)?.value);

export const requireAdmin = () => {
  if (!isAdmin()) redirect("/login");
};
