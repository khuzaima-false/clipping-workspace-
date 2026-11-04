"use client";

import { useState } from "react";

export function useIsMobileDevice() {
  const [isMobile] = useState(() =>
    typeof navigator !== "undefined"
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
      : false
  );

  return isMobile;
}

export function DeviceNotAvailable({
  title = "Not available for your device",
}: {
  title?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm leading-6 text-zinc-400">
          Forgevyn runs as a desktop application. Open this page on a PC to use
          the editor or download the desktop app.
        </p>
      </div>
    </main>
  );
}
