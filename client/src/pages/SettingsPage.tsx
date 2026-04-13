import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { captureEvent } from "@/lib/analytics";
import { useTutorial } from "@/contexts/TutorialContext";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Users, Globe, ChevronLeft, Loader2, DollarSign, Trash2, AlertTriangle, Tag, Plus, X, GripVertical, Bell, BellOff, Clock, Repeat, Sparkles, ChevronDown, MessageCircle, CheckCircle, QrCode, Copy, Share2, TrendingUp, Info, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { QRCodeCanvas } from "qrcode.react";
import { shareOrCopy, canNativeShare } from "@/lib/share";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";

export const DEFAULT_CATEGORIES = ["Food", "Transport", "Entertainment", "Shopping", "Utilities", "Education", "Health", "Other"];
export const DEFAULT_RECURRING_CATEGORIES = ["Subscriptions", "Utilities", "Taxes", "Insurance"];
export const DEFAULT_INCOME_SOURCES = ["Family / Parents", "Work", "Gift or Unexpected", "Scholarship or Grant", "Other"];

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { language, setLanguage, t, isUpdating: isLanguageUpdating } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { startTutorial } = useTutorial();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || "");
  const [currency, setCurrency] = useState((user as any)?.currency || "EUR");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [appShareCopied, setAppShareCopied] = useState(false);

  const APP_URL = window.location.hostname === "localhost"
    ? window.location.origin
    : "https://sharedledger.app";

  useEffect(() => {
    captureEvent("app_share_qr_viewed");
  }, []);

  const handleShareAppLink = async () => {
    await shareOrCopy({
      url: APP_URL,
      title: "SharedLedger — shared finances made easy",
      text: "Track expenses, split bills, and manage budgets together with SharedLedger.",
      onShared: () => captureEvent("app_share_link_copied", { method: "share_sheet" }),
      onCopied: () => {
        setAppShareCopied(true);
        setTimeout(() => setAppShareCopied(false), 2000);
        captureEvent("app_share_link_copied", { method: "clipboard" });
      },
    });
  };
  
  const userCategories = (user as any)?.categories as string[] | null;
  const [categories, setCategories] = useState<string[]>(userCategories || DEFAULT_CATEGORIES);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<{ index: number; value: string } | null>(null);

  const userRecurringCategories = (user as any)?.recurringCategories as string[] | null;
  const [recurringCategories, setRecurringCategories] = useState<string[]>(userRecurringCategories || DEFAULT_RECURRING_CATEGORIES);
  const [newRecurringCategory, setNewRecurringCategory] = useState("");
  const [editingRecurringCategory, setEditingRecurringCategory] = useState<{ index: number; value: string } | null>(null);

  const userIncomeSources = (user as any)?.incomeSources as string[] | null;
  const [incomeSources, setIncomeSources] = useState<string[]>(userIncomeSources || DEFAULT_INCOME_SOURCES);
  const [newSource, setNewSource] = useState("");
  const [editingSource, setEditingSource] = useState<{ index: number; value: string } | null>(null);
  
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [recurringCategoriesOpen, setRecurringCategoriesOpen] = useState(false);
  const [incomeSourcesOpen, setIncomeSourcesOpen] = useState(false);

  const feedbackFormSchema = z.object({
    group: z.string().min(1, "Please select a group"),
    message: z.string().min(10, "Message must be at least 10 characters"),
  });
  type FeedbackValues = z.infer<typeof feedbackFormSchema>;

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const feedbackForm = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { group: "", message: "" },
  });

  const sendFeedbackMutation = useMutation({
    mutationFn: async (data: FeedbackValues) => {
      const res = await apiRequest("POST", "/api/feedback", data);
      return res.json();
    },
    onSuccess: () => {
      setFeedbackSent(true);
      captureEvent("settings_feedback_sent");
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Could not send feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCloseFeedback = () => {
    setFeedbackOpen(false);
    setFeedbackSent(false);
    feedbackForm.reset();
  };

  const [dailyReminderEnabled, setDailyReminderEnabled] = useState((user as any)?.dailyReminderEnabled ?? true);
  const [dailyReminderTime, setDailyReminderTime] = useState((user as any)?.dailyReminderTime || "19:00");
  const [weeklyReminderEnabled, setWeeklyReminderEnabled] = useState((user as any)?.weeklyReminderEnabled ?? true);
  const [monthlyReminderEnabled, setMonthlyReminderEnabled] = useState((user as any)?.monthlyReminderEnabled ?? true);
  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState((user as any)?.budgetAlertsEnabled ?? true);
  const [includeQuickGroupInSummary, setIncludeQuickGroupInSummary] = useState((user as any)?.includeQuickGroupInSummary ?? false);
  const [sageNotesPermission, setSageNotesPermission] = useState<boolean>((user as any)?.sageNotesPermission ?? false);
  const [financialProfile, setFinancialProfile] = useState<string>((user as any)?.financialProfile ?? "");
  const [financialProfileDraft, setFinancialProfileDraft] = useState<string>((user as any)?.financialProfile ?? "");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

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
      captureEvent("settings_account_deleted");
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
    mutationFn: async (data: { name?: string; email?: string | null; profileImageUrl?: string; currency?: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("profileUpdated"),
        description: t("changesSaved"),
      });
      captureEvent("settings_profile_saved");
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("failedToUpdate"),
        variant: "destructive",
      });
    },
  });

  const updateCategoriesMutation = useMutation({
    mutationFn: async (newCategories: string[]) => {
      const res = await apiRequest("PATCH", "/api/user/profile", { categories: newCategories });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("categoriesUpdated") || "Categories Updated",
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

  const updateNotificationMutation = useMutation({
    mutationFn: async (data: { dailyReminderTime?: string; dailyReminderEnabled?: boolean; weeklyReminderEnabled?: boolean; monthlyReminderEnabled?: boolean; budgetAlertsEnabled?: boolean; includeQuickGroupInSummary?: boolean }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("reminderUpdated"),
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

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") return;
    captureEvent("settings_notification_permission_requested");
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      await subscribeToPush();
    } else if (permission === "denied") {
      toast({
        title: t("error"),
        description: t("notificationPermissionDenied"),
        variant: "destructive",
      });
    }
  };

  const handleToggleDaily = (enabled: boolean) => {
    setDailyReminderEnabled(enabled);
    if (enabled && notificationPermission === "default") {
      requestNotificationPermission();
    }
    updateNotificationMutation.mutate({ dailyReminderEnabled: enabled });
  };

  const handleDailyTimeChange = (time: string) => {
    setDailyReminderTime(time);
    updateNotificationMutation.mutate({ dailyReminderTime: time });
  };

  const handleToggleWeekly = (enabled: boolean) => {
    setWeeklyReminderEnabled(enabled);
    if (enabled && notificationPermission === "default") {
      requestNotificationPermission();
    }
    updateNotificationMutation.mutate({ weeklyReminderEnabled: enabled });
  };

  const handleToggleMonthly = (enabled: boolean) => {
    setMonthlyReminderEnabled(enabled);
    if (enabled && notificationPermission === "default") {
      requestNotificationPermission();
    }
    updateNotificationMutation.mutate({ monthlyReminderEnabled: enabled });
  };

  const handleToggleBudgetAlerts = (enabled: boolean) => {
    setBudgetAlertsEnabled(enabled);
    updateNotificationMutation.mutate({ budgetAlertsEnabled: enabled });
  };

  const updateSageMutation = useMutation({
    mutationFn: async (data: { sageNotesPermission?: boolean; financialProfile?: string | null }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Sage AI updated", description: "Your settings have been saved." });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedToUpdate"), variant: "destructive" });
    },
  });

  const handleSaveFinancialProfile = () => {
    const trimmed = financialProfileDraft.trim();
    setFinancialProfile(trimmed);
    updateSageMutation.mutate({ financialProfile: trimmed || null });
  };

  const handleToggleSageNotes = (enabled: boolean) => {
    setSageNotesPermission(enabled);
    updateSageMutation.mutate({ sageNotesPermission: enabled });
  };

  const handleToggleQuickGroupSummary = (enabled: boolean) => {
    setIncludeQuickGroupInSummary(enabled);
    updateNotificationMutation.mutate({ includeQuickGroupInSummary: enabled });
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed) && categories.length < 20) {
      const updated = [...categories, trimmed];
      setCategories(updated);
      setNewCategory("");
      updateCategoriesMutation.mutate(updated);
      captureEvent("settings_category_added");
    }
  };

  const handleRemoveCategory = (index: number) => {
    if (categories.length > 1) {
      const updated = categories.filter((_, i) => i !== index);
      setCategories(updated);
      updateCategoriesMutation.mutate(updated);
      captureEvent("settings_category_removed");
    }
  };

  const handleEditCategory = (index: number) => {
    setEditingCategory({ index, value: categories[index] });
  };

  const handleSaveEditCategory = () => {
    if (editingCategory) {
      const trimmed = editingCategory.value.trim();
      if (trimmed && !categories.some((c, i) => c === trimmed && i !== editingCategory.index)) {
        const updated = [...categories];
        updated[editingCategory.index] = trimmed;
        setCategories(updated);
        updateCategoriesMutation.mutate(updated);
      }
      setEditingCategory(null);
    }
  };

  const handleResetCategories = () => {
    setCategories(DEFAULT_CATEGORIES);
    updateCategoriesMutation.mutate(DEFAULT_CATEGORIES);
    captureEvent("settings_categories_reset");
  };

  const updateRecurringCategoriesMutation = useMutation({
    mutationFn: async (newCategories: string[]) => {
      const res = await apiRequest("PATCH", "/api/user/profile", { recurringCategories: newCategories });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("recurringCategoriesUpdated"),
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

  const handleAddRecurringCategory = () => {
    const trimmed = newRecurringCategory.trim();
    if (trimmed && !recurringCategories.includes(trimmed) && recurringCategories.length < 20) {
      const updated = [...recurringCategories, trimmed];
      setRecurringCategories(updated);
      setNewRecurringCategory("");
      updateRecurringCategoriesMutation.mutate(updated);
      captureEvent("settings_recurring_category_added");
    }
  };

  const handleRemoveRecurringCategory = (index: number) => {
    if (recurringCategories.length > 1) {
      const updated = recurringCategories.filter((_, i) => i !== index);
      setRecurringCategories(updated);
      updateRecurringCategoriesMutation.mutate(updated);
      captureEvent("settings_recurring_category_removed");
    }
  };

  const handleEditRecurringCategory = (index: number) => {
    setEditingRecurringCategory({ index, value: recurringCategories[index] });
  };

  const handleSaveEditRecurringCategory = () => {
    if (editingRecurringCategory) {
      const trimmed = editingRecurringCategory.value.trim();
      if (trimmed && !recurringCategories.some((c, i) => c === trimmed && i !== editingRecurringCategory.index)) {
        const updated = [...recurringCategories];
        updated[editingRecurringCategory.index] = trimmed;
        setRecurringCategories(updated);
        updateRecurringCategoriesMutation.mutate(updated);
      }
      setEditingRecurringCategory(null);
    }
  };

  const handleResetRecurringCategories = () => {
    setRecurringCategories(DEFAULT_RECURRING_CATEGORIES);
    updateRecurringCategoriesMutation.mutate(DEFAULT_RECURRING_CATEGORIES);
  };

  const updateIncomeSourcesMutation = useMutation({
    mutationFn: async (newSources: string[]) => {
      const res = await apiRequest("PATCH", "/api/user/profile", { incomeSources: newSources });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: t("incomeSourcesUpdated"), description: t("changesSaved") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedToUpdate"), variant: "destructive" });
    },
  });

  const handleAddSource = () => {
    const trimmed = newSource.trim();
    if (!trimmed || incomeSources.includes(trimmed) || incomeSources.length >= 10) return;
    const updated = [...incomeSources, trimmed];
    setIncomeSources(updated);
    setNewSource("");
    updateIncomeSourcesMutation.mutate(updated);
  };

  const handleRemoveSource = (index: number) => {
    if (incomeSources.length <= 1) return;
    const updated = incomeSources.filter((_, i) => i !== index);
    setIncomeSources(updated);
    updateIncomeSourcesMutation.mutate(updated);
  };

  const handleEditSource = (index: number) => {
    setEditingSource({ index, value: incomeSources[index] });
  };

  const handleSaveEditSource = () => {
    if (!editingSource) return;
    const trimmed = editingSource.value.trim();
    if (trimmed && !incomeSources.some((s, i) => s === trimmed && i !== editingSource.index)) {
      const updated = [...incomeSources];
      updated[editingSource.index] = trimmed;
      setIncomeSources(updated);
      updateIncomeSourcesMutation.mutate(updated);
    }
    setEditingSource(null);
  };

  const handleResetSources = () => {
    setIncomeSources(DEFAULT_INCOME_SOURCES);
    updateIncomeSourcesMutation.mutate(DEFAULT_INCOME_SOURCES);
  };

  const handleSaveProfile = () => {
    const updates: { name?: string; email?: string | null; profileImageUrl?: string; currency?: string } = {};
    if (name !== user?.name) updates.name = name;
    if (email !== (user?.email || "")) updates.email = email || null;
    if (profileImageUrl !== user?.profileImageUrl) updates.profileImageUrl = profileImageUrl || undefined;
    if (currency !== (user as any)?.currency) updates.currency = currency;
    
    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  const hasChanges = name !== user?.name || email !== (user?.email || "") || profileImageUrl !== (user?.profileImageUrl || "") || currency !== ((user as any)?.currency || "USD");

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/app">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-display font-bold" data-tutorial="settings-link">{t("settingsTitle")}</h1>
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

          <div className="space-y-2">
            <Label htmlFor="profile-email" className="text-sm text-muted-foreground">
              Email address
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              data-testid="input-profile-email"
            />
            <p className="text-xs text-muted-foreground">
              Used for password resets and important account notifications.
            </p>
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

      <Card className="border-border/50" data-testid="card-app-share">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Share SharedLedger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Let someone scan this to open the app — no link needed.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50">
              <QRCodeCanvas
                value={APP_URL}
                size={160}
                level="M"
                fgColor="#000000"
                bgColor="#ffffff"
                data-testid="qr-code-app-share"
                style={{ borderRadius: 8 }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-mono">{APP_URL}</p>
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleShareAppLink}
            data-testid="button-copy-app-link"
          >
            {appShareCopied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                Copied!
              </>
            ) : canNativeShare() ? (
              <>
                <Share2 className="w-4 h-4" />
                Share
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy link
              </>
            )}
          </Button>
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
            <SelectTrigger className="w-full" data-testid="select-currency" data-tutorial="settings-currency">
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
            onValueChange={(val) => setLanguage(val as "en" | "fr" | "nl")}
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
              <SelectItem value="nl" data-testid="option-dutch">
                {t("dutch")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>


      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="w-5 h-5 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                data-testid={`button-theme-${value}`}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  theme === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card
        className="border-border/50 cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => setFeedbackOpen(true)}
        data-testid="card-contact-support"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Contact Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">For bugs or suggestions</p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <button
          className="w-full text-left"
          onClick={() => setCategoriesOpen((o) => !o)}
          data-testid="button-toggle-categories"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              <span className="flex-1">{t("expenseCategories") || "Expense Categories"}</span>
              <span className="text-xs font-normal text-muted-foreground mr-1">
                {categories.length} {t("categories") || "categories"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${categoriesOpen ? "rotate-180" : ""}`}
              />
            </CardTitle>
          </CardHeader>
        </button>

        {categoriesOpen && (
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">
              {t("customizeCategoriesDescription") || "Customize the categories for tracking your expenses. Click a category to edit its name."}
            </p>
            
            <div className="space-y-2">
              {categories.map((category, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                  data-testid={`category-item-${index}`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  {editingCategory?.index === index ? (
                    <Input
                      value={editingCategory.value}
                      onChange={(e) => setEditingCategory({ ...editingCategory, value: e.target.value })}
                      onBlur={handleSaveEditCategory}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEditCategory()}
                      className="flex-1 h-8"
                      autoFocus
                      maxLength={30}
                      data-testid={`input-edit-category-${index}`}
                    />
                  ) : (
                    <span 
                      className="flex-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleEditCategory(index)}
                      data-testid={`text-category-${index}`}
                    >
                      {category}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemoveCategory(index)}
                    disabled={categories.length <= 1 || updateCategoriesMutation.isPending}
                    data-testid={`button-remove-category-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={t("newCategoryPlaceholder") || "Add new category..."}
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                data-testid="input-new-category"
              />
              <Button
                onClick={handleAddCategory}
                disabled={!newCategory.trim() || categories.length >= 20 || updateCategoriesMutation.isPending}
                data-testid="button-add-category"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                {categories.length}/20 {t("categories") || "categories"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetCategories}
                disabled={updateCategoriesMutation.isPending}
                data-testid="button-reset-categories"
              >
                {t("resetToDefault") || "Reset to Default"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-border/50">
        <button
          className="w-full text-left"
          onClick={() => setRecurringCategoriesOpen((o) => !o)}
          data-testid="button-toggle-recurring-categories"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Repeat className="w-5 h-5 text-primary" />
              <span className="flex-1">{t("recurringCategoriesTitle")}</span>
              <span className="text-xs font-normal text-muted-foreground mr-1">
                {recurringCategories.length} {t("categories")}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${recurringCategoriesOpen ? "rotate-180" : ""}`}
              />
            </CardTitle>
          </CardHeader>
        </button>

        {recurringCategoriesOpen && (
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">
              {t("recurringCategoriesDescription")}
            </p>
            
            <div className="space-y-2">
              {recurringCategories.map((category, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                  data-testid={`recurring-category-item-${index}`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  {editingRecurringCategory?.index === index ? (
                    <Input
                      value={editingRecurringCategory.value}
                      onChange={(e) => setEditingRecurringCategory({ ...editingRecurringCategory, value: e.target.value })}
                      onBlur={handleSaveEditRecurringCategory}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEditRecurringCategory()}
                      className="flex-1 h-8"
                      autoFocus
                      maxLength={30}
                      data-testid={`input-edit-recurring-category-${index}`}
                    />
                  ) : (
                    <span 
                      className="flex-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleEditRecurringCategory(index)}
                      data-testid={`text-recurring-category-${index}`}
                    >
                      {category}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemoveRecurringCategory(index)}
                    disabled={recurringCategories.length <= 1 || updateRecurringCategoriesMutation.isPending}
                    data-testid={`button-remove-recurring-category-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newRecurringCategory}
                onChange={(e) => setNewRecurringCategory(e.target.value)}
                placeholder={t("newRecurringCategoryPlaceholder")}
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && handleAddRecurringCategory()}
                data-testid="input-new-recurring-category"
              />
              <Button
                onClick={handleAddRecurringCategory}
                disabled={!newRecurringCategory.trim() || recurringCategories.length >= 20 || updateRecurringCategoriesMutation.isPending}
                data-testid="button-add-recurring-category"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                {recurringCategories.length}/20 {t("categories")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetRecurringCategories}
                disabled={updateRecurringCategoriesMutation.isPending}
                data-testid="button-reset-recurring-categories"
              >
                {t("resetToDefault")}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-border/50">
        <button
          className="w-full text-left"
          onClick={() => setIncomeSourcesOpen((o) => !o)}
          data-testid="button-toggle-income-sources"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="flex-1">{t("incomeSourcesTitle")}</span>
              <span className="text-xs font-normal text-muted-foreground mr-1">
                {incomeSources.length} {t("categories")}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${incomeSourcesOpen ? "rotate-180" : ""}`}
              />
            </CardTitle>
          </CardHeader>
        </button>

        {incomeSourcesOpen && (
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">{t("incomeSourcesDescription")}</p>

            <div className="space-y-2">
              {incomeSources.map((source, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                  data-testid={`income-source-item-${index}`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  {editingSource?.index === index ? (
                    <Input
                      value={editingSource.value}
                      onChange={(e) => setEditingSource({ ...editingSource, value: e.target.value })}
                      onBlur={handleSaveEditSource}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEditSource()}
                      className="flex-1 h-8"
                      autoFocus
                      maxLength={40}
                      data-testid={`input-edit-source-${index}`}
                    />
                  ) : (
                    <span
                      className="flex-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleEditSource(index)}
                      data-testid={`text-source-${index}`}
                    >
                      {source}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemoveSource(index)}
                    disabled={incomeSources.length <= 1 || updateIncomeSourcesMutation.isPending}
                    data-testid={`button-remove-source-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder={t("newSourcePlaceholder")}
                maxLength={40}
                onKeyDown={(e) => e.key === "Enter" && handleAddSource()}
                data-testid="input-new-source"
              />
              <Button
                onClick={handleAddSource}
                disabled={!newSource.trim() || incomeSources.length >= 10 || updateIncomeSourcesMutation.isPending}
                data-testid="button-add-source"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted-foreground">
                {incomeSources.length}/10 {t("categories")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSources}
                disabled={updateIncomeSourcesMutation.isPending}
                data-testid="button-reset-sources"
              >
                {t("resetToDefault")}
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{t("incomeSourcesNotice")}</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            {t("notifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {notificationPermission === "denied" && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {t("notificationPermissionDenied")}
            </div>
          )}
          {notificationPermission === "default" && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={requestNotificationPermission}
              data-testid="button-enable-notifications"
            >
              <Bell className="w-4 h-4" />
              {t("enableNotifications")}
            </Button>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{t("dailyReminder")}</p>
              <p className="text-xs text-muted-foreground">{t("dailyReminderDescription")}</p>
            </div>
            <Switch
              checked={dailyReminderEnabled}
              onCheckedChange={handleToggleDaily}
              data-testid="switch-daily-reminder"
            />
          </div>

          {dailyReminderEnabled && (
            <div className="flex items-center gap-3 pl-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground">{t("reminderTime")}</Label>
              <Input
                type="time"
                value={dailyReminderTime}
                onChange={(e) => handleDailyTimeChange(e.target.value)}
                className="w-auto"
                data-testid="input-reminder-time"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{t("weeklyReminder")}</p>
              <p className="text-xs text-muted-foreground">{t("weeklyReminderDescription")}</p>
            </div>
            <Switch
              checked={weeklyReminderEnabled}
              onCheckedChange={handleToggleWeekly}
              data-testid="switch-weekly-reminder"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{t("monthlyReminder")}</p>
              <p className="text-xs text-muted-foreground">{t("monthlyReminderDescription")}</p>
            </div>
            <Switch
              checked={monthlyReminderEnabled}
              onCheckedChange={handleToggleMonthly}
              data-testid="switch-monthly-reminder"
            />
          </div>

          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <BellOff className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{t("budgetAlerts")}</p>
                  <p className="text-xs text-muted-foreground">{t("budgetAlertsDescription")}</p>
                </div>
              </div>
              <Switch
                checked={budgetAlertsEnabled}
                onCheckedChange={handleToggleBudgetAlerts}
                data-testid="switch-budget-alerts"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Sage AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-1">Your Financial Profile</p>
            <p className="text-xs text-muted-foreground mb-3">
              Tell Sage about yourself so it can give you better advice from the start. This is read every time you chat with Sage.
            </p>
            <Textarea
              value={financialProfileDraft}
              onChange={(e) => setFinancialProfileDraft(e.target.value)}
              placeholder={"For example:\n• My income usually arrives on the 1st and 15th\n• My biggest commitment is rent — 60% of income\n• I'm saving to move out by year-end\n• We split groceries and utilities with my flatmate"}
              className="min-h-[120px] text-sm resize-none"
              maxLength={2000}
              data-testid="textarea-financial-profile"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">{financialProfileDraft.length}/2000</span>
              <Button
                size="sm"
                onClick={handleSaveFinancialProfile}
                disabled={updateSageMutation.isPending || financialProfileDraft === financialProfile}
                data-testid="button-save-financial-profile"
              >
                {updateSageMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm">Let Sage read personal notes</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, Sage can read your private notes to give you more personalised advice. Your notes are never shared with your group.
                </p>
              </div>
              <Switch
                checked={sageNotesPermission}
                onCheckedChange={handleToggleSageNotes}
                data-testid="switch-sage-notes-permission"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Help &amp; Tour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            New to SharedLedger? Take a guided tour to discover all the features — from logging expenses to tracking shared goals.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => { startTutorial(); captureEvent("settings_tutorial_replayed"); }}
            data-testid="button-take-tour"
          >
            <Sparkles className="w-4 h-4" />
            Take the Tour
          </Button>
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

      <Dialog open={feedbackOpen} onOpenChange={(open) => { if (!open) handleCloseFeedback(); }}>
        <DialogContent className="sm:max-w-md">
          {feedbackSent ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle className="w-5 h-5" />
                  Message Sent
                </DialogTitle>
              </DialogHeader>
              <div className="py-6 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your message has been recorded and we shall get back to you within 5 business days.
                </p>
              </div>
              <DialogFooter>
                <Button className="w-full" onClick={handleCloseFeedback} data-testid="button-close-feedback-success">
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Contact Support
                </DialogTitle>
                <DialogDescription>
                  For bugs or suggestions — we read every message.
                </DialogDescription>
              </DialogHeader>
              <Form {...feedbackForm}>
                <form onSubmit={feedbackForm.handleSubmit((values) => sendFeedbackMutation.mutate(values))}>
                  <div className="space-y-4 py-4">
                    <FormField
                      control={feedbackForm.control}
                      name="group"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Which group do you use?</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-feedback-group">
                                <SelectValue placeholder="Select your group type…" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-popover">
                              <SelectItem value="Family" data-testid="option-feedback-family">Family</SelectItem>
                              <SelectItem value="Couples" data-testid="option-feedback-couples">Couples</SelectItem>
                              <SelectItem value="Roommates" data-testid="option-feedback-roommates">Roommates</SelectItem>
                              <SelectItem value="Friends" data-testid="option-feedback-friends">Friends</SelectItem>
                              <SelectItem value="Individual" data-testid="option-feedback-individual">Individual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={feedbackForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your message</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Describe your bug or suggestion…"
                              rows={5}
                              maxLength={2000}
                              data-testid="textarea-feedback-message"
                            />
                          </FormControl>
                          <div className="flex justify-between items-center">
                            <FormMessage />
                            <p className="text-xs text-muted-foreground ml-auto">{field.value.length}/2000</p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseFeedback}
                      data-testid="button-cancel-feedback"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={sendFeedbackMutation.isPending}
                      data-testid="button-send-feedback"
                    >
                      {sendFeedbackMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Send Feedback
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>

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
