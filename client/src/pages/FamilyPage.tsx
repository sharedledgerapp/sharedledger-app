import { useState, useEffect } from "react";
import { useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { captureEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Shield, ShieldOff, LogOut, Home, Heart, QrCode, ChevronDown, ChevronUp, Plus, Camera, Share2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { shareOrCopy, canNativeShare } from "@/lib/share";

const APP_URL = window.location.hostname === "localhost"
  ? window.location.origin
  : "https://sharedledger.app";

function InviteQrDisplay({ code, appUrl, testId }: { code: string; appUrl: string; testId: string }) {
  useEffect(() => {
    captureEvent("invite_qr_url_shown", { code_prefix: code.split("-")[0] });
  }, [code]);

  return (
    <QRCodeCanvas
      value={`${appUrl}/join?code=${code}`}
      size={180}
      level="M"
      fgColor="#000000"
      bgColor="#ffffff"
      data-testid={testId}
      style={{ borderRadius: 8 }}
    />
  );
}

function extractInviteCode(raw: string): string {
  try {
    const url = new URL(raw);
    const code = url.searchParams.get("code");
    if (code) return code.toUpperCase().trim();
  } catch {}
  return raw.toUpperCase().trim();
}

const groupTypeIcons: Record<string, any> = {
  family: Users,
  roommates: Home,
  couple: Heart,
  friends: Users,
};

const groupTypeLabels: Record<string, Record<string, string>> = {
  en: { family: "Family", roommates: "Roommates", couple: "Couple", friends: "Friends" },
  fr: { family: "Famille", roommates: "Colocataires", couple: "Couple", friends: "Amis" },
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

  const [createDialog, setCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"family" | "roommates" | "couple">("family");

  const [joinDialog, setJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinScannerOpen, setJoinScannerOpen] = useState(false);
  const [inviteRevealCode, setInviteRevealCode] = useState<string | null>(null);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);

  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      const code = joinCode.toUpperCase().trim();
      if (!code) throw new Error("Please enter an invite code");
      const res = await apiRequest("POST", "/api/auth/setup-group", { groupCode: code });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to join group");
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setJoinDialog(false);
      setJoinCode("");
      toast({ title: "Joined!", description: "You have joined the group." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!newGroupName.trim()) return;
      const res = await apiRequest("POST", "/api/auth/setup-group", {
        groupName: newGroupName.trim(),
        groupType: newGroupType,
        role: newGroupType === "family" ? "parent" : "member",
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.setQueryData(["/api/user"], result);
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setCreateDialog(false);
      setNewGroupName("");
      if (result?.inviteCode) {
        setInviteRevealCode(result.inviteCode);
      } else {
        toast({ title: "Group created!", description: "You can now invite others to join." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading group info...</div>;

  const family = data?.family;
  const members = data?.members || [];
  const parentCount = members.filter((m: any) => m.role === 'parent').length;
  const familyGroupType = (family as any)?.groupType || "family";
  const isFamily = familyGroupType === "family";
  const isAdmin = user?.role === "parent";
  const GroupIcon = groupTypeIcons[familyGroupType] || Users;

  const shareInvite = async () => {
    if (!family?.code) return;
    const url = `${APP_URL}/join?code=${family.code}`;
    const result = await shareOrCopy({
      url,
      title: "Join my group on SharedLedger",
      text: `Join "${family.name}" on SharedLedger — shared finances made easy.`,
      onShared: () => captureEvent("group_invite_code_copied", { type: "url", method: "share_sheet" }),
      onCopied: () => {
        toast({ title: "Copied!", description: "Invite link copied to clipboard" });
        captureEvent("group_invite_code_copied", { type: "url", method: "clipboard" });
      },
    });
    return result;
  };

  const noGroupUI = !user?.familyId && !isLoading;

  return (
    <div className="space-y-6 pb-20">
      {/* Invite Reveal Dialog — always rendered so it persists after familyId is set */}
      <Dialog open={!!inviteRevealCode} onOpenChange={(v) => { if (!v) setInviteRevealCode(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Group Created!</DialogTitle>
            <DialogDescription>Share this invite code or QR with others so they can join.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
              <span className="flex-1 text-lg font-mono font-bold tracking-widest text-center" data-testid="text-family-invite-code">
                {inviteRevealCode}
              </span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0"
                onClick={async () => {
                  if (!inviteRevealCode) return;
                  const url = `${APP_URL}/join?code=${inviteRevealCode}`;
                  await shareOrCopy({
                    url,
                    title: "Join my group on SharedLedger",
                    text: "You've been invited to join a group on SharedLedger.",
                    onShared: () => captureEvent("group_invite_code_copied", { type: "url", method: "share_sheet", source: "reveal_dialog" }),
                    onCopied: () => {
                      setInviteCodeCopied(true);
                      setTimeout(() => setInviteCodeCopied(false), 2000);
                      captureEvent("group_invite_code_copied", { type: "url", method: "clipboard", source: "reveal_dialog" });
                    },
                  });
                }}
                data-testid="button-copy-family-invite-code"
              >
                {inviteCodeCopied ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                ) : canNativeShare() ? (
                  <Share2 className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-col items-center gap-2">
              {inviteRevealCode && (
                <InviteQrDisplay
                  code={inviteRevealCode}
                  appUrl={APP_URL}
                  testId="qr-code-family-invite"
                />
              )}
              <p className="text-xs text-muted-foreground">Scan to join this group</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteRevealCode(null)} className="w-full" data-testid="button-close-invite-reveal">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {noGroupUI ? (
        <>
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl mx-auto flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-display font-bold text-2xl mb-2">No Group Yet</h1>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              Groups let you track shared finances with family, roommates, or a partner. Create one to get started, or join an existing group with an invite code.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setCreateDialog(true)}
                className="h-12 px-8 rounded-xl shadow-lg shadow-primary/25"
                data-testid="button-create-group-empty"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create a Group
              </Button>
              <Button
                variant="outline"
                onClick={() => setJoinDialog(true)}
                className="h-12 px-8 rounded-xl"
                data-testid="button-join-group-empty"
              >
                Join a Group
              </Button>
            </div>
          </div>

          {/* Join Group Dialog */}
          <Dialog open={joinDialog} onOpenChange={setJoinDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Join a Group</DialogTitle>
                <DialogDescription>Enter the invite code shared by a group member.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Invite Code</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. FAM-ABCD"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="font-mono tracking-widest text-center text-lg h-11 rounded-xl flex-1"
                      data-testid="input-join-group-code"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-xl"
                      onClick={() => setJoinScannerOpen(true)}
                      title="Scan QR Code"
                      data-testid="button-scan-qr-family-join"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setJoinDialog(false)} data-testid="button-cancel-join-group">Cancel</Button>
                <Button
                  onClick={() => joinGroupMutation.mutate()}
                  disabled={joinGroupMutation.isPending || !joinCode.trim()}
                  data-testid="button-confirm-join-group"
                >
                  {joinGroupMutation.isPending ? "Joining..." : "Join Group"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <QrScannerDialog
            open={joinScannerOpen}
            onClose={() => setJoinScannerOpen(false)}
            scannerId="family-join-qr-scanner"
            onScan={(raw) => {
              setJoinCode(extractInviteCode(raw));
              setJoinScannerOpen(false);
            }}
          />

          {/* Create Group Dialog */}
          <Dialog open={createDialog} onOpenChange={setCreateDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create a Group</DialogTitle>
                <DialogDescription>Set up a group to track shared finances together.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Group Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["family", "roommates", "couple"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewGroupType(type)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all capitalize ${
                          newGroupType === type
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-background border-border hover:bg-muted"
                        }`}
                        data-testid={`button-new-group-type-${type}`}
                      >
                        {type === "roommates" ? "Roommates" : type === "couple" ? "Couple" : "Family"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Group Name</Label>
                  <Input
                    placeholder={
                      newGroupType === "family" ? "The Smith Family"
                      : newGroupType === "roommates" ? "Apartment 4B"
                      : "Our Finances"
                    }
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="h-11 rounded-xl"
                    data-testid="input-new-group-name"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setCreateDialog(false)} data-testid="button-cancel-create-group">Cancel</Button>
                <Button
                  onClick={() => createGroupMutation.mutate()}
                  disabled={createGroupMutation.isPending || !newGroupName.trim()}
                  data-testid="button-confirm-create-group"
                >
                  {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          <div className="text-center py-6 bg-primary/5 rounded-3xl border border-primary/10" data-tutorial="group-section">
            <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-md mb-4 text-primary">
              <GroupIcon className="w-8 h-8" />
            </div>
            <h1 className="font-display font-bold text-3xl mb-1" data-testid="text-group-name">{family?.name || "My Group"}</h1>
            <Badge variant="secondary" className="mb-3 capitalize" data-testid="badge-group-type">
              {groupTypeLabels[language]?.[familyGroupType] || familyGroupType}
            </Badge>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>{t("inviteCode")}:</span>
              <code className="bg-muted px-2 py-1 rounded font-mono font-bold" data-testid="text-invite-code">{family?.code}</code>
              <Button variant="ghost" size="icon" onClick={shareInvite} data-testid="button-copy-code">
                {canNativeShare() ? <Share2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                onClick={shareInvite}
                data-testid="button-share-invite"
                data-tutorial="share-invite"
              >
                <Share2 className="w-4 h-4" />
                {canNativeShare() ? "Share invite" : "Copy invite link"}
              </Button>
            </div>
            {family?.code && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => {
                    if (!showQr) captureEvent("group_qr_shown", { type: "url" });
                    setShowQr(!showQr);
                  }}
                  data-testid="button-toggle-qr"
                >
                  <QrCode className="w-4 h-4" />
                  {showQr ? t("hideQrCode") : t("showQrCode")}
                  {showQr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
                {showQr && (
                  <div className="mt-3 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <InviteQrDisplay
                      code={family.code}
                      appUrl={APP_URL}
                      testId="qr-code-display"
                    />
                    <p className="text-xs text-muted-foreground">Anyone who scans this can join the group</p>
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
        </>
      )}
    </div>
  );
}
