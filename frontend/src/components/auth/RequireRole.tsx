"use client";

import type { ReactNode } from "react";
import { useMe } from "@/lib/use-me";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { SkeletonCard } from "@/components/ui/skeleton";

type RequireRoleProps = {
  roles: string[];
  children: ReactNode;
  message?: string;
};

export function RequireRole({ roles, children, message }: RequireRoleProps) {
  const { me, loading } = useMe();

  if (loading) {
    return <SkeletonCard />;
  }

  if (!me) {
    return <NotAuthorized message="Please sign in to continue." />;
  }

  if (!roles.includes(me.role)) {
    return <NotAuthorized message={message} />;
  }

  return <>{children}</>;
}
