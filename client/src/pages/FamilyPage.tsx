import { useState } from "react";
import { useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function FamilyPage() {
  const { data, isLoading } = useFamily();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [roleDialog, setRoleDialog] = useState<{ memberId: number; memberName: string; action: "promote" | "demote" } | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading family info...</div>;

  const family = data?.family;
  const members = data?.members || [];
  const parentCount = members.filter(m => m.role === 'parent').length;

  const copyCode = () => {
    if (family?.code) {
      navigator.clipboard.writeText(family.code);
      toast({ title: "Copied!", description: "Invite code copied to clipboard" });
    }
  };

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
    },
    onError: (error: Error) => {
      toast({
        title: t("error"),
        description: error.message === "Maximum of 2 admins per family" ? t("maxAdminsReached") : error.message,
        variant: "destructive",
      });
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

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center py-6 bg-primary/5 rounded-3xl border border-primary/10">
        <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-md mb-4 text-primary">
          <Users className="w-8 h-8" />
        </div>
        <h1 className="font-display font-bold text-3xl mb-1">{family?.name || "My Family"}</h1>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Invite Code:</span>
          <code className="bg-muted px-2 py-1 rounded font-mono font-bold">{family?.code}</code>
          <Button variant="ghost" size="icon" onClick={copyCode} data-testid="button-copy-code">
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <section>
        <h2 className="font-display font-bold text-xl mb-4">{t("members")}</h2>
        <div className="grid gap-3">
          {members.map((member) => (
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
                  <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'parent' && (
                    <Badge variant="outline" className="border-primary/20 text-primary">Admin</Badge>
                  )}
                  {user?.role === 'parent' && member.id !== user?.id && (
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
            <Button
              variant="outline"
              onClick={() => setRoleDialog(null)}
              data-testid="button-cancel-role-change"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={changeRoleMutation.isPending}
              data-testid="button-confirm-role-change"
            >
              {roleDialog?.action === "promote" ? t("makeAdmin") : t("removeAdmin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
