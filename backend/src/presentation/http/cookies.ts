export function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries((header ?? "").split(";").flatMap((part) => {
    const [name, ...value] = part.trim().split("=");
    return name ? [[name, decodeURIComponent(value.join("="))]] : [];
  }));
}

export function capabilityCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1_000,
  };
}
