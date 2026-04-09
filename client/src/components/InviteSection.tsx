import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Copy, QrCode, ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import { shareOrCopy, canNativeShare } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

const APP_URL =
  window.location.hostname === "localhost"
    ? window.location.origin
    : "https://sharedledger.app";

interface InviteSectionProps {
  familyCode: string;
  groupName?: string;
}

export function InviteSection({ familyCode, groupName }: InviteSectionProps) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const inviteUrl = `${APP_URL}/join?code=${familyCode}`;

  const handleShare = async () => {
    await shareOrCopy({
      url: inviteUrl,
      title: "Join my group on SharedLedger",
      text: groupName
        ? `Join "${groupName}" on SharedLedger — track expenses, income, and budgets together.`
        : "Join my group on SharedLedger — track expenses, income, and budgets together.",
      onShared: () => {},
      onCopied: () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Copied!", description: "Invite link copied to clipboard" });
      },
    });
  };

  return (
    <Card
      className="border-dashed border-2 border-primary/30 bg-primary/5 shadow-none"
      data-testid="card-invite-section"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground leading-tight">Invite code</p>
              <code
                className="font-mono font-bold text-sm tracking-widest text-foreground"
                data-testid="text-dashboard-invite-code"
              >
                {familyCode}
              </code>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 rounded-lg text-xs px-3"
              onClick={handleShare}
              data-testid="button-dashboard-share-invite"
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : canNativeShare() ? (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy link
                </>
              )}
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-lg"
              onClick={() => setShowQr((v) => !v)}
              data-testid="button-dashboard-toggle-qr"
              title={showQr ? "Hide QR code" : "Show QR code"}
            >
              <QrCode className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {showQr && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-border/50">
              <QRCodeCanvas
                value={inviteUrl}
                size={160}
                fgColor="#000000"
                bgColor="#ffffff"
                data-testid="qr-code-dashboard-invite"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Scan to join · or share the link above
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground gap-1"
              onClick={() => setShowQr(false)}
              data-testid="button-dashboard-hide-qr"
            >
              <ChevronUp className="w-3 h-3" />
              Hide QR code
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
