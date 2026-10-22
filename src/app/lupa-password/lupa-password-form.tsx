"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BidderAuthShell } from "@/components/auth/bidder-auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

type Step = "nik" | "reset";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 6))}@${domain}`;
}

export default function LupaPasswordForm() {
  const [step, setStep] = useState<Step>("nik");
  const [employeeNik, setEmployeeNik] = useState("");
  const [email, setEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const nik = employeeNik.trim();
    const mail = email.trim().toLowerCase();
    if (!nik) {
      toast.error("NIK wajib diisi");
      return;
    }
    if (!mail) {
      toast.error("Email wajib diisi");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/forgot-password/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeNik: nik, email: mail }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Gagal mengirim OTP");
      return;
    }

    setMaskedEmail(maskEmail(mail));
    setEmployeeNik(nik);
    setEmail(mail);
    setStep("reset");
    toast.success(`OTP dikirim ke ${maskEmail(mail)}`);
  }

  async function handleResendOtp() {
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeNik, email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Gagal mengirim ulang OTP");
      return;
    }

    toast.success("OTP baru telah dikirim");
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error("OTP harus 6 digit angka");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/forgot-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeNik,
        email,
        otp: otp.trim(),
        password,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error ?? "Gagal reset password");
      return;
    }

    toast.success("Password berhasil diperbarui");
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  }

  return (
    <BidderAuthShell
      title="Lupa Password"
      subtitle={
        step === "nik"
          ? "Masukkan NIK dan email terdaftar untuk menerima OTP"
          : `Verifikasi OTP yang dikirim ke ${maskedEmail}`
      }
      showBidderBranding={false}
      showSketchArt
    >
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          {step === "nik" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeNik">NIK Karyawan</Label>
                <Input
                  id="employeeNik"
                  value={employeeNik}
                  onChange={(e) => setEmployeeNik(e.target.value)}
                  placeholder="Masukkan NIK karyawan"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Terdaftar</Label>
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
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                <Mail className="mr-2 h-4 w-4" />
                {loading ? "Mengirim OTP..." : "Kirim OTP ke Email"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
                <p className="mt-1 text-slate-600">NIK: {employeeNik}</p>
                <p className="mt-1 text-slate-500">OTP dikirim ke {maskedEmail}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Kode OTP</Label>
                <Input
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 digit OTP"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password Baru</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {loading ? "Menyimpan..." : "Reset Password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={handleResendOtp}
              >
                Kirim Ulang OTP
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("nik");
                  setOtp("");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ganti NIK / Email
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Ingat password?{" "}
            <Link
              href={`/login?redirect=${encodeURIComponent(redirect)}`}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              Kembali ke login
            </Link>
          </p>
        </CardContent>
      </Card>
    </BidderAuthShell>
  );
}
