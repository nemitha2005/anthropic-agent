"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useFirebaseAuth } from "@/lib/firebase/auth-context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useFirebaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="flex h-dvh items-center justify-center" />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
