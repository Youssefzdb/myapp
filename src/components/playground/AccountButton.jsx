import React, { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function AccountButton() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!alive) return;
      if (authed) {
        try {
          const me = await base44.auth.me();
          if (alive) setUser(me);
        } catch {
          /* ignore */
        }
      }
      if (alive) setChecked(true);
    });
    return () => { alive = false; };
  }, []);

  if (!checked) return null;

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => base44.auth.redirectToLogin()}>
        <LogIn className="w-4 h-4 ml-1" />دخول
      </Button>
    );
  }

  const initial = (user.full_name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => base44.auth.logout()}
      title={`${user.full_name || user.email} — اضغط لتسجيل الخروج`}
      className="px-2"
    >
      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold ml-1.5">
        {initial}
      </span>
      <span className="hidden sm:inline text-xs max-w-[80px] truncate">{user.full_name || user.email}</span>
    </Button>
  );
}