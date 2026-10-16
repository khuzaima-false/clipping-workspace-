/**
 * The host stays rendered (rather than using `display: none`) so Chromium
 * keeps preview media on an active audio pipeline. It is supplied by the
 * workspace layout and shared by the V1 and A-lane playback elements.
 */
export const PREVIEW_MEDIA_CONTAINER_ID = "preview-media-container";

export function mountPreviewMedia(element: HTMLMediaElement): void {
  if (typeof document === "undefined") return;
  const host = document.getElementById(PREVIEW_MEDIA_CONTAINER_ID);
  if (host && element.parentElement !== host) host.appendChild(element);
}

export function unmountPreviewMedia(element: HTMLMediaElement): void {
  element.remove();
}
