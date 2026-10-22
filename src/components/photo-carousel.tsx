"use client";

import { useState } from "react";
import { ItemPhoto } from "@/lib/database.types";
import { getPhotoUrl } from "@/lib/format";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import { PhotoImage } from "@/components/photo-image";

export function PhotoCarousel({
  photos,
  alt,
}: {
  photos: ItemPhoto[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-slate-100">
        <div className="flex h-full items-center justify-center text-6xl opacity-30">
          📦
        </div>
      </div>
    );
  }

  const prev = () => setIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-slate-100">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="absolute inset-0 z-0 cursor-zoom-in"
          aria-label="Perbesar foto"
        >
          <PhotoImage
            src={getPhotoUrl(photos[index].storage_path)}
            alt={`${alt} - foto ${index + 1}`}
            fill
            className="object-cover"
            priority={index === 0}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white opacity-100 backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />
            Perbesar
          </span>
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                prev();
              }}
              className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100"
              aria-label="Foto sebelumnya"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                next();
              }}
              className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100"
              aria-label="Foto berikutnya"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIndex(i);
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  )}
                  aria-label={`Foto ${i + 1}`}
                />
              ))}
            </div>
            <span className="absolute right-3 top-3 z-10 rounded-lg bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === index
                  ? "border-[var(--primary)]"
                  : "border-transparent opacity-70"
              )}
              aria-label={`Pilih foto ${i + 1}`}
            >
              <PhotoImage
                src={getPhotoUrl(photo.storage_path)}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {previewOpen && (
        <ImagePreviewDialog
          images={photos}
          index={index}
          onIndexChange={setIndex}
          onClose={() => setPreviewOpen(false)}
          alt={alt}
        />
      )}
    </div>
  );
}
