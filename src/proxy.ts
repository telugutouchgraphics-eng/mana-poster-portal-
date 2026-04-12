import { NextRequest, NextResponse } from "next/server";

function roleFromHost(hostname: string): "admin" | "manager" | "creator" | null {
  const host = hostname.toLowerCase();
  if (host.startsWith("admin.")) {
    return "admin";
  }
  if (host.startsWith("manager.")) {
    return "manager";
  }
  if (host.startsWith("creator.")) {
    return "creator";
  }
  return null;
}

function dashboardPathForRole(role: "admin" | "manager" | "creator"): string {
  if (role === "admin") {
    return "/admin/dashboard";
  }
  if (role === "manager") {
    return "/manager/dashboard";
  }
  return "/creator/dashboard";
}

export function proxy(req: NextRequest) {
  const role = roleFromHost(req.nextUrl.hostname);
  if (!role) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname === "/") {
    url.pathname = "/login";
    url.searchParams.set("as", role);
    url.searchParams.set("next", dashboardPathForRole(role));
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && !url.searchParams.get("as")) {
    url.searchParams.set("as", role);
    url.searchParams.set("next", dashboardPathForRole(role));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
