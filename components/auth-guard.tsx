"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useFirebaseAuth } from "@/lib/firebase/auth-context";
import { LandingPage } from "./landing-page";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useFirebaseAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/") {
      router.replace("/");
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return <div className="flex h-dvh items-center justify-center" />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return <>{children}</>;
}
