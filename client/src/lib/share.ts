export async function shareOrCopy({
  url,
  title,
  text,
  onShared,
  onCopied,
}: {
  url: string;
  title?: string;
  text?: string;
  onShared?: () => void;
  onCopied?: () => void;
}): Promise<"shared" | "copied" | "cancelled"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ url, title, text });
      onShared?.();
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
      // Share failed — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    onCopied?.();
    return "copied";
  } catch {
    return "cancelled";
  }
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}
