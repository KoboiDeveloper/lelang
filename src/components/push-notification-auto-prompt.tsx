"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  canEnablePushNotifications,
  canShowPushOptIn,
  isIosDevice,
  isStandalonePwa,
} from "@/lib/push-client";
import {
  markPushPromptDismissed,
  shouldAutoPromptPush,
} from "@/lib/push-prompt-storage";

const PROMPT_DELAY_MS = 800;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

export function PushNotificationAutoPrompt() {
  const { permission, needsOptIn, loading, ready, enableNotifications } =
    usePushNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [allowAuto, setAllowAuto] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMobile(isMobileViewport());
    setAllowAuto(shouldAutoPromptPush());

    const media = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setMobile(media.matches);
    media.addEventListener("change", onChange);

    const onPushState = () => setAllowAuto(shouldAutoPromptPush());
    window.addEventListener("elang-push-state-change", onPushState);

    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("elang-push-state-change", onPushState);
    };
  }, []);

  useEffect(() => {
    if (!ready || !needsOptIn || !allowAuto) {
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      if (shouldAutoPromptPush()) setOpen(true);
    }, PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ready, needsOptIn, allowAuto]);

  function dismiss() {
    markPushPromptDismissed();
    setAllowAuto(false);
    setOpen(false);
  }

  async function handleEnable() {
    if (!canEnablePushNotifications()) {
      dismiss();
      return;
    }

    const success = await enableNotifications();
    if (success) {
      setAllowAuto(false);
      setOpen(false);
    }
  }

  if (!mounted || !ready || !canShowPushOptIn()) {
    return null;
  }

  const showAutoUi = needsOptIn && allowAuto;
  const showIosHint = isIosDevice() && !isStandalonePwa();
  const iosOnly = showIosHint && !canEnablePushNotifications();
  const permissionGranted = permission === "granted";

  const deniedBanner =
    permission === "denied" ? (
      <div className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-amber-200 bg-amber-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-amber-900">
        Notifikasi diblokir Chrome. Buka <strong>Site settings → Notifications → Allow</strong> untuk
        situs ini.
      </div>
    ) : null;

  const mobileBar =
    showAutoUi && mobile && !open ? (
      <div className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-indigo-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
            <Bell className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Aktifkan notifikasi lelang</p>
            <p className="truncate text-xs text-slate-500">AMS & AMV — sekali saja</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={dismiss}
          >
            Nanti
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="shrink-0"
            disabled={loading}
            onClick={() => void handleEnable()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aktifkan"}
          </Button>
        </div>
      </div>
    ) : null;

  const modal =
    open && showAutoUi ? (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-auto-prompt-title"
          className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-5 shadow-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <Bell className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 id="push-auto-prompt-title" className="mt-4 text-lg font-semibold text-slate-900">
            Aktifkan notifikasi lelang?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Satu kali aktifkan untuk semua perusahaan (<strong>AMS</strong> & <strong>AMV</strong>).
            Dapatkan pemberitahuan saat lelang dimulai, ditutup, atau ada barang baru.
          </p>

          {permissionGranted && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Izin browser sudah aktif. Klik tombol di bawah untuk menyelesaikan pendaftaran
              notifikasi.
            </p>
          )}

          {showIosHint && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Di iPhone, tambahkan situs ke Home Screen lalu buka dari icon aplikasi agar notifikasi
              bisa aktif.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={dismiss}>
              Nanti saja
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={loading}
              onClick={() => void handleEnable()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {iosOnly ? "Mengerti" : "Aktifkan Notifikasi"}
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  return createPortal(
    <>
      {deniedBanner}
      {mobileBar}
      {modal}
    </>,
    document.body
  );
}
