import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Globe, Camera, ChevronLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { language, setLanguage, t, isUpdating: isLanguageUpdating } = useLanguage();
  const { toast } = useToast();
  
  const [name, setName] = useState(user?.name || "");
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || "");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; profileImageUrl?: string }) => {
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
    const updates: { name?: string; profileImageUrl?: string } = {};
    if (name !== user?.name) updates.name = name;
    if (profileImageUrl !== user?.profileImageUrl) updates.profileImageUrl = profileImageUrl || undefined;
    
    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  const hasChanges = name !== user?.name || profileImageUrl !== (user?.profileImageUrl || "");

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
            <SelectContent>
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

      <Card className="border-border/50 border-destructive/30">
        <CardContent className="pt-6">
          <Button 
            variant="destructive" 
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
    </div>
  );
}
