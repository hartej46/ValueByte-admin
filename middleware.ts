import { authMiddleware, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: [
    "/api/:path*/customer",
    "/api/:path*/customer/addresses(.*)",
    "/api/:path*/customer-orders",
    "/api/:path*/checkout",
    "/api/:path*/checkout/verify",
    "/api/:path*/billboards(.*)",
    "/api/:path*/categories(.*)",
    "/api/:path*/products(.*)",
    "/api/:path*/sizes(.*)",
    "/api/:path*/colors(.*)"
  ],
  async afterAuth(auth, req) {
    // Handle restriction for admin routes
    if (auth.userId && !auth.isPublicRoute) {
      const user = await clerkClient.users.getUser(auth.userId);
      const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;

      if (email !== process.env.ALLOWED_ADMIN_EMAIL) {
        return new NextResponse("Unauthorized: You do not have access to this admin dashboard.", { status: 403 });
      }
    }
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};