"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * Dropbox photos via BE proxy — skip Next optimizer.
 * Shows skeleton shimmer until the image finishes loading.
 */
export function PhotoImage({
  className,
  onLoad,
  alt,
  src,
  ...props
}: Omit<ImageProps, "unoptimized">) {
  const [loaded, setLoaded] = useState(false);
  const fill = Boolean(props.fill);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <>
      {!loaded && (
        <div
          aria-hidden
          className={cn(
            "skeleton pointer-events-none z-[1]",
            fill ? "absolute inset-0 h-full w-full" : "h-full w-full"
          )}
        />
      )}
      <Image
        {...props}
        src={src}
        alt={alt}
        unoptimized
        className={cn(
          className,
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={(event) => {
          setLoaded(true);
          onLoad?.(event);
        }}
      />
    </>
  );
}
