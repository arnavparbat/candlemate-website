import { NextRequest, NextResponse } from "next/server";
export function middleware(req:NextRequest){if(req.nextUrl.pathname.startsWith("/admin")&&req.nextUrl.pathname!=="/admin/login"&&req.cookies.get("candlemate_admin")?.value!=="yes")return NextResponse.redirect(new URL("/admin/login",req.url));return NextResponse.next()}
export const config={matcher:["/admin/:path*"]};
