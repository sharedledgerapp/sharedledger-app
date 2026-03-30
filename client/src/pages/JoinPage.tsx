import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { captureEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Home, Heart, CheckCircle2, AlertCircle } from "lucide-react";

const groupTypeIcons: Record<string, any> = {
  family: Users,
  roommates: Home,
  couple: Heart,
  friends: Users,
};

const groupTypeLabels: Record<string, string> = {
  family: "Family Group",
  roommates: "Roommates Group",
  couple: "Couple",
  friends: "Friends Group",
};

export default function JoinPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const code = new URLSearchParams(window.location.search).get("code")?.toUpperCase().trim() ?? "";

  const { data: groupInfo, isLoading: lookupLoading, isError: lookupError } = useQuery({
    queryKey: ["/api/invite/lookup", code],
    queryFn: async () => {
      const res = await fetch(`/api/invite/lookup?code=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<{ name: string; groupType: string; code: string }>;
    },
    enabled: !!code,
    retry: false,
  });

  useEffect(() => {
    if (authLoading) return;
    captureEvent("join_page_viewed", {
      had_code: !!code,
      already_logged_in: !!user,
      ...(code ? { code_prefix: code.split("-")[0] } : {}),
    });
  }, [authLoading]);

  const joinMutation = useMutation({
    mutationFn: async () => {
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
      captureEvent("join_group_confirmed", {
        code_prefix: code.split("-")[0],
        group_type: groupInfo?.groupType ?? "unknown",
      });
      setJoined(true);
      setTimeout(() => setLocation("/app"), 1500);
    },
    onError: (err: Error) => {
      setJoinError(err.message);
    },
  });

  const handleCreateAccount = () => {
    localStorage.setItem("pending_invite_code", code);
    setLocation("/auth?mode=register");
  };

  const handleSignIn = () => {
    localStorage.setItem("pending_invite_code", code);
    setLocation("/auth?mode=login");
  };

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm border-border/50 shadow-xl shadow-black/5 text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-semibold">Invalid invite link</p>
            <p className="text-sm text-muted-foreground">
              This invite link is missing the group code. Ask the group owner for a fresh link.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              Go to SharedLedger
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || lookupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const GroupIcon = groupInfo ? (groupTypeIcons[groupInfo.groupType] || Users) : Users;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />

      <div className="w-full max-w-md z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-accent rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/20 rotate-[-6deg]">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight text-foreground">SharedLedger</h1>
          <p className="text-muted-foreground text-sm">Shared finances, simplified.</p>
        </div>

        {joined ? (
          <Card className="border-border/50 shadow-xl shadow-black/5 text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold text-lg">You're in!</p>
              <p className="text-sm text-muted-foreground">Taking you to your group…</p>
            </CardContent>
          </Card>
        ) : lookupError ? (
          <Card className="border-border/50 shadow-xl shadow-black/5 text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
              <p className="font-semibold">Invite link not found</p>
              <p className="text-sm text-muted-foreground">
                This invite code (<code className="font-mono">{code}</code>) doesn't match any active group. It may have been mistyped or the group no longer exists.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
                Go to SharedLedger
              </Button>
            </CardContent>
          </Card>
        ) : user ? (
          /* Logged-in: one-tap join confirmation */
          <Card className="border-border/50 shadow-xl shadow-black/5">
            <CardContent className="pt-6 pb-6 space-y-5">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <GroupIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{groupInfo?.name ?? "Shared Group"}</p>
                  <p className="text-xs text-muted-foreground">
                    {groupInfo ? (groupTypeLabels[groupInfo.groupType] ?? groupInfo.groupType) : "Group"}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-center">You've been invited!</p>
                <p className="text-sm text-muted-foreground text-center">
                  Join <span className="font-medium text-foreground">{groupInfo?.name ?? "this group"}</span> to start tracking shared finances together.
                </p>
              </div>

              {joinError && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {joinError}
                </div>
              )}

              <Button
                className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-primary/25"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                data-testid="button-join-confirm"
              >
                {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join this group"}
              </Button>

              <button
                onClick={() => setLocation("/app")}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
                data-testid="link-skip-join"
              >
                Maybe later
              </button>
            </CardContent>
          </Card>
        ) : (
          /* Not logged in: welcome + CTA */
          <Card className="border-border/50 shadow-xl shadow-black/5">
            <CardContent className="pt-6 pb-6 space-y-5">
              {groupInfo && (
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <GroupIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{groupInfo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {groupTypeLabels[groupInfo.groupType] ?? groupInfo.groupType}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-center">
                <p className="font-semibold text-lg">You've been invited to SharedLedger</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  SharedLedger is a shared finance app for families, roommates, and couples — track expenses, split bills, and manage budgets together.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-primary/25"
                  onClick={handleCreateAccount}
                  data-testid="button-join-create-account"
                >
                  Create a free account
                </Button>
                <button
                  onClick={handleSignIn}
                  className="w-full text-sm text-primary hover:underline text-center"
                  data-testid="link-join-signin"
                >
                  Already have an account? Sign in
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Your invite code <code className="font-mono font-semibold">{code}</code> will be filled in automatically after you sign up.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
