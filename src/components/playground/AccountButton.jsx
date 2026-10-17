import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { getSession, logoutAccount } from "@/lib/customAuth";

export default function AccountButton() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const custom = getSession();
    if (custom && alive) {
      setUser({ email: custom.email });
      setChecked(true);
      return () => { alive = false; };
    }
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
      <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
        <LogIn className="w-4 h-4 ml-1" />دخول
      </Button>
    );
  }

  const initial = (user.email || "?").trim().charAt(0).toUpperCase();
  const handleLogout = () => {
    if (getSession()) {
      logoutAccount();
      window.location.reload();
    } else {
      base44.auth.logout();
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      title={`${user.email} — اضغط لتسجيل الخروج`}
      className="px-2"
    >
      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold ml-1.5">
        {initial}
      </span>
      <span className="hidden sm:inline text-xs max-w-[80px] truncate">{user.email}</span>
    </Button>
  );
}