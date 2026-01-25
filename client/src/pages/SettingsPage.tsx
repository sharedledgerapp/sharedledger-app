import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Globe, ChevronLeft, Loader2, DollarSign, Trash2, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CURRENCIES } from "@/lib/currency";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { language, setLanguage, t, isUpdating: isLanguageUpdating } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [name, setName] = useState(user?.name || "");
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || "");
  const [currency, setCurrency] = useState((user as any)?.currency || "EUR");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/account");
      if (!res.ok) throw new Error("Failed to delete account");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("accountDeleted") || "Account Deleted",
        description: t("accountDeletedMessage") || "Your account has been permanently deleted.",
      });
      setLocation("/auth");
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("failedToDeleteAccount") || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; profileImageUrl?: string; currency?: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("profileUpdated"),
        description: t("changesSaved"),
      });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("failedToUpdate"),
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    const updates: { name?: string; profileImageUrl?: string; currency?: string } = {};
    if (name !== user?.name) updates.name = name;
    if (profileImageUrl !== user?.profileImageUrl) updates.profileImageUrl = profileImageUrl || undefined;
    if (currency !== (user as any)?.currency) updates.currency = currency;
    
    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  const hasChanges = name !== user?.name || profileImageUrl !== (user?.profileImageUrl || "") || currency !== ((user as any)?.currency || "USD");

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-display font-bold">{t("settingsTitle")}</h1>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {t("profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 border-2 border-primary/20">
              <AvatarImage src={profileImageUrl || undefined} alt={user?.name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="profile-image" className="text-sm text-muted-foreground">
                {t("profileImage")}
              </Label>
              <Input
                id="profile-image"
                type="url"
                placeholder={t("imageUrlPlaceholder")}
                value={profileImageUrl}
                onChange={(e) => setProfileImageUrl(e.target.value)}
                className="text-sm"
                data-testid="input-profile-image"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-sm text-muted-foreground">
              {t("profileName")}
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("yourName")}
              data-testid="input-profile-name"
            />
          </div>

          {hasChanges && (
            <Button 
              onClick={handleSaveProfile} 
              disabled={updateProfileMutation.isPending}
              className="w-full"
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            {t("currency")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={currency} 
            onValueChange={(val) => setCurrency(val)}
          >
            <SelectTrigger className="w-full" data-testid="select-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {CURRENCIES.map((curr) => (
                <SelectItem key={curr.code} value={curr.code} data-testid={`option-currency-${curr.code}`}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{curr.symbol}</span>
                    <span>{curr.code} - {curr.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {t("language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={language} 
            onValueChange={(val) => setLanguage(val as "en" | "fr")}
            disabled={isLanguageUpdating}
          >
            <SelectTrigger className="w-full" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="en" data-testid="option-english">
                {t("english")}
              </SelectItem>
              <SelectItem value="fr" data-testid="option-french">
                {t("french")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-sign-out"
          >
            {logoutMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            {t("signOut")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {t("dangerZone") || "Danger Zone"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("deleteAccountWarning") || "Once you delete your account, there is no going back. All your data will be permanently removed."}
          </p>
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={() => setShowDeleteDialog(true)}
            data-testid="button-delete-account"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("deleteAccount") || "Delete Account"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t("confirmDeleteAccount") || "Delete Your Account?"}
            </DialogTitle>
            <DialogDescription>
              {t("deleteAccountPermanent") || "This action cannot be undone. All your expenses, goals, and data will be permanently deleted."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="delete-confirm">
              {t("typeDeleteToConfirm") || 'Type "DELETE" to confirm:'}
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              data-testid="input-delete-confirm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
              data-testid="button-cancel-delete"
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteAccountMutation.mutate();
                setShowDeleteDialog(false);
              }}
              disabled={deleteConfirmText !== "DELETE" || deleteAccountMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {t("deleteAccountPermanently") || "Delete Account Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
