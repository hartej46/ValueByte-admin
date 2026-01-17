import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/api/:path*/customer",
    "/api/:path*/customer/:path*",
    "/api/:path*/checkout",
    "/api/:path*/checkout/:path*",
    "/api/:path*/products",
    "/api/:path*/products/:path*",
    "/api/:path*/categories",
    "/api/:path*/categories/:path*",
    "/api/:path*/colors",
    "/api/:path*/colors/:path*",
    "/api/webhook/:path*",
    "/api/:path*/debug-orders",
    "/api/:path*/customer-orders",
  ],
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};