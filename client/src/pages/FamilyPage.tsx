import { useState } from "react";
import { useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { captureEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Shield, ShieldOff, LogOut, Home, Heart, QrCode, ChevronDown, ChevronUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const groupTypeIcons: Record<string, any> = {
  family: Users,
  roommates: Home,
  couple: Heart,
};

const groupTypeLabels: Record<string, Record<string, string>> = {
  en: { family: "Family", roommates: "Roommates", couple: "Couple" },
  fr: { family: "Famille", roommates: "Colocataires", couple: "Couple" },
};

export default function FamilyPage() {
  const { data, isLoading } = useFamily();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [roleDialog, setRoleDialog] = useState<{ memberId: number; memberName: string; action: "promote" | "demote" } | null>(null);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/family/members/${memberId}/role`, { role });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      toast({
        title: variables.role === "parent" ? t("adminPromoted") : t("adminDemoted"),
        description: t("changesSaved"),
      });
      captureEvent("group_member_role_changed", { action: variables.role === "parent" ? "promote" : "demote" });
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message === "Maximum of 2 admins per family" ? t("maxAdminsReached") : error.message,
        variant: "destructive",
      });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/group/leave");
      if (!res.ok) throw new Error("Failed to leave group");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      toast({ title: "Left group", description: "You have left the group." });
      captureEvent("group_left");
    },
  });

  const handleRoleChange = () => {
    if (!roleDialog) return;
    changeRoleMutation.mutate({
      memberId: roleDialog.memberId,
      role: roleDialog.action === "promote" ? "parent" : "child",
    });
    setRoleDialog(null);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading group info...</div>;

  const family = data?.family;
  const members = data?.members || [];
  const parentCount = members.filter((m: any) => m.role === 'parent').length;
  const groupType = (family as any)?.groupType || "family";
  const isFamily = groupType === "family";
  const isAdmin = user?.role === "parent";
  const GroupIcon = groupTypeIcons[groupType] || Users;

  const copyCode = () => {
    if (family?.code) {
      navigator.clipboard.writeText(family.code);
      toast({ title: "Copied!", description: "Invite code copied to clipboard" });
      captureEvent("group_invite_code_copied");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center py-6 bg-primary/5 rounded-3xl border border-primary/10" data-tutorial="group-section">
        <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-md mb-4 text-primary">
          <GroupIcon className="w-8 h-8" />
        </div>
        <h1 className="font-display font-bold text-3xl mb-1" data-testid="text-group-name">{family?.name || "My Group"}</h1>
        <Badge variant="secondary" className="mb-3 capitalize" data-testid="badge-group-type">
          {groupTypeLabels[language]?.[groupType] || groupType}
        </Badge>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>{t("inviteCode")}:</span>
          <code className="bg-muted px-2 py-1 rounded font-mono font-bold" data-testid="text-invite-code">{family?.code}</code>
          <Button variant="ghost" size="icon" onClick={copyCode} data-testid="button-copy-code">
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        {family?.code && (
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => { if (!showQr) captureEvent("group_qr_shown"); setShowQr(!showQr); }}
              data-testid="button-toggle-qr"
            >
              <QrCode className="w-4 h-4" />
              {showQr ? t("hideQrCode") : t("showQrCode")}
              {showQr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            {showQr && (
              <div className="mt-3 flex justify-center animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50">
                  <QRCodeSVG
                    value={family.code}
                    size={180}
                    level="M"
                    data-testid="qr-code-display"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <section>
        <h2 className="font-display font-bold text-xl mb-4">{t("groupMembers")}</h2>
        <div className="grid gap-3">
          {members.map((member: any) => (
            <Card key={member.id} className="border-border/50 shadow-sm" data-testid={`member-card-${member.id}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-white shadow-sm bg-primary/10">
                  <AvatarFallback className="text-primary font-bold">{member.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <h3 className="font-bold text-lg">{member.name}</h3>
                    {member.id === user?.id && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">
                    {isFamily ? member.role : t("member")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'parent' && isFamily && (
                    <Badge variant="outline" className="border-primary/20 text-primary">Admin</Badge>
                  )}
                  {isAdmin && isFamily && member.id !== user?.id && (
                    <>
                      {member.role === 'child' && parentCount < 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRoleDialog({ memberId: member.id, memberName: member.name, action: "promote" })}
                          title={t("makeAdmin")}
                          data-testid={`button-make-admin-${member.id}`}
                        >
                          <Shield className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      {member.role === 'parent' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRoleDialog({ memberId: member.id, memberName: member.name, action: "demote" })}
                          title={t("removeAdmin")}
                          data-testid={`button-remove-admin-${member.id}`}
                        >
                          <ShieldOff className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
          onClick={() => setLeaveDialog(true)}
          data-testid="button-leave-group"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t("leaveGroup")}
        </Button>
      </section>

      <Dialog open={!!roleDialog} onOpenChange={(open) => !open && setRoleDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {roleDialog?.action === "promote" ? (
                <Shield className="w-5 h-5 text-primary" />
              ) : (
                <ShieldOff className="w-5 h-5 text-muted-foreground" />
              )}
              {roleDialog?.action === "promote" ? t("makeAdmin") : t("removeAdmin")}
            </DialogTitle>
            <DialogDescription>
              {roleDialog?.action === "promote" ? t("confirmMakeAdmin") : t("confirmRemoveAdmin")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium py-2">{roleDialog?.memberName}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRoleDialog(null)} data-testid="button-cancel-role-change">
              {t("cancel")}
            </Button>
            <Button onClick={handleRoleChange} disabled={changeRoleMutation.isPending} data-testid="button-confirm-role-change">
              {roleDialog?.action === "promote" ? t("makeAdmin") : t("removeAdmin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveDialog} onOpenChange={setLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leaveGroup")}</DialogTitle>
            <DialogDescription>{t("confirmLeaveGroup")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLeaveDialog(false)} data-testid="button-cancel-leave">
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => { leaveGroupMutation.mutate(); setLeaveDialog(false); }}
              disabled={leaveGroupMutation.isPending}
              data-testid="button-confirm-leave"
            >
              {t("leaveGroup")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
