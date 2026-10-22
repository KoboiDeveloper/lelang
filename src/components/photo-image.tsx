"use client";

import Image, { type ImageProps } from "next/image";

/**
 * Dropbox photos are served via BE proxy with query strings.
 * Next.js image optimizer returns 400 for those URLs — skip optimization.
 */
export function PhotoImage(props: Omit<ImageProps, "unoptimized">) {
  return <Image {...props} unoptimized />;
}
