"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { apiFetch, getClientToken } from "@/lib/api-client";
import { getStoredUser, onAuthChange } from "@/lib/session";
import { notifyFavoritesChanged, onFavoritesChanged } from "@/lib/favorite-events";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  itemId,
  className,
}: {
  itemId: string;
  className?: string;
}) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const token = getClientToken();
      const stored = getStoredUser();
      if (!token || !stored) {
        if (!cancelled) {
          setUserId(null);
          setFavorited(false);
          setLoading(false);
        }
        return;
      }

      setUserId(stored.id);
      const res = await apiFetch<{
        favorites: { itemId?: string; item_id?: string }[];
      }>("/api/catalog/favorites", { method: "GET", token });

      if (cancelled) return;
      if (!res.ok) {
        setFavorited(false);
      } else {
        setFavorited(
          (res.data?.favorites ?? []).some(
            (f) => (f.item_id ?? f.itemId) === itemId
          )
        );
      }
      setLoading(false);
    }

    void load();
    const unsubAuth = onAuthChange(() => {
      void load();
    });
    const unsubscribeFavorites = onFavoritesChanged(() => {
      void load();
    });
    return () => {
      cancelled = true;
      unsubAuth();
      unsubscribeFavorites();
    };
  }, [itemId]);

  async function toggleFavorite() {
    const token = getClientToken();
    if (!userId || !token || toggling) return;
    setToggling(true);
    const next = !favorited;
    setFavorited(next);

    if (next) {
      const res = await apiFetch("/api/catalog/favorites", {
        method: "POST",
        token,
        body: { item_id: itemId },
      });
      if (!res.ok) {
        setFavorited(false);
        toast.error(res.error || "Gagal menambah favorit");
        setToggling(false);
        return;
      }
      toast.success("Ditambahkan ke favorit");
    } else {
      const res = await apiFetch(`/api/catalog/favorites/${itemId}`, {
        method: "DELETE",
        token,
      });
      if (!res.ok) {
        setFavorited(true);
        toast.error(res.error || "Gagal menghapus favorit");
        setToggling(false);
        return;
      }
      toast.success("Dihapus dari favorit");
    }

    notifyFavoritesChanged();
    setToggling(false);
  }

  if (loading) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Favorit
      </Button>
    );
  }

  if (!userId) {
    return (
      <Link href={loginHref}>
        <Button type="button" variant="outline" size="sm" className={cn("gap-2", className)}>
          <Heart className="h-4 w-4" />
          Favorit
        </Button>
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant={favorited ? "primary" : "outline"}
      size="sm"
      className={cn("gap-2", favorited && "bg-rose-600 hover:bg-rose-700", className)}
      disabled={toggling}
      onClick={() => void toggleFavorite()}
      aria-pressed={favorited}
      title={favorited ? "Hapus dari favorit" : "Tambah ke favorit"}
    >
      {toggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
      )}
      {favorited ? "Favorit" : "Favoritkan"}
    </Button>
  );
}
