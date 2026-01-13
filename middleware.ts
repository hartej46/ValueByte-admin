import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/api/:path*/customer",
    "/api/:path*/customer/addresses",
    "/api/:path*/customer/addresses/:addressId",
    "/api/:path*/customer-orders"
  ]
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};