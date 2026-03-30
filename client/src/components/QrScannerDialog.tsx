import { useState, useEffect, useRef, useCallback } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  scannerId: string;
}

export function QrScannerDialog({ open, onClose, onScan, title = "Scan QR Code", scannerId }: Props) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setError(null);
    const startScanner = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted || !scannerRef.current) return;
      scannerRef.current.id = scannerId;
      const scanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = scanner;
      const scanConfig = { fps: 10, qrbox: { width: 220, height: 220 } };
      const onSuccess = (decodedText: string) => {
        onScan(decodedText);
        stopScanner();
      };
      try {
        await scanner.start({ facingMode: "environment" }, scanConfig, onSuccess, () => {});
      } catch {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices.length > 0) {
            await scanner.start(devices[0].id, scanConfig, onSuccess, () => {});
          } else if (mounted) {
            setError("Camera unavailable");
          }
        } catch {
          if (mounted) setError("Camera unavailable or permission denied");
        }
      }
    };
    const timer = setTimeout(startScanner, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, onScan, stopScanner, scannerId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopScanner(); onClose(); } }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Camera className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          {error ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { stopScanner(); onClose(); }}
                data-testid="button-close-qr-scanner"
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div ref={scannerRef} className="w-full" />
              <p className="text-center text-xs text-muted-foreground mt-2 pb-2">
                Point camera at the QR code
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
