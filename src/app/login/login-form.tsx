"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BidderAuthShell } from "@/components/auth/bidder-auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { isStaffRole } from "@/lib/roles";
import { loginWithPassword } from "@/lib/session";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await loginWithPassword(email, password);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Login berhasil");

    const destination = isStaffRole(result.user.role) ? "/admin" : redirect;

    // Hard navigation so the Set-Cookie from /api/auth/login is always sent
    // to middleware / SSR on the next page (soft router.push can race).
    window.location.assign(destination);
  }

  return (
    <BidderAuthShell
      title="Login"
      subtitle="Masuk dengan email dan password"
      showBidderBranding={false}
      showSketchArt
    >
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={`/lupa-password?redirect=${encodeURIComponent(redirect)}`}
                  className="text-xs font-medium text-[var(--primary)] hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Masuk..." : "Login"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Belum punya akun?{" "}
            <Link
              href={`/daftar?redirect=${encodeURIComponent(redirect)}`}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              Daftar sebagai Bidder
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-600">
              Kembali ke beranda
            </Link>
          </p>
        </CardContent>
      </Card>
    </BidderAuthShell>
  );
}
