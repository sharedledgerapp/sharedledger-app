import { useEffect, useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { loginSchema, registerSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { Loader2, Users, ArrowRight, Eye, EyeOff, Camera } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SiGoogle, SiApple } from "react-icons/si";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import type { Html5Qrcode } from "html5-qrcode";

function OAuthButtons() {
  return (
    <div className="space-y-3">
      <a
        href="/api/auth/google"
        className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border border-border bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all shadow-sm"
        data-testid="button-google-signin"
      >
        <SiGoogle className="w-5 h-5" style={{ color: "#4285F4" }} />
        Continue with Google
      </a>
      <a
        href="/api/auth/apple"
        className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border border-border bg-black hover:bg-gray-900 text-white font-medium transition-all shadow-sm"
        data-testid="button-apple-signin"
      >
        <SiApple className="w-5 h-5" />
        Continue with Apple
      </a>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground uppercase tracking-wider">or</span>
        </div>
      </div>
    </div>
  );
}

function GroupSetupForm({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [groupType, setGroupType] = useState<"family" | "roommates" | "couple">("family");
  const [scannerOpen, setScannerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      groupName: "",
      groupCode: "",
      groupType: "family" as "family" | "roommates" | "couple",
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: { groupCode?: string; groupName?: string; groupType?: string; role?: string }) => {
      const res = await fetch("/api/auth/setup-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to set up group");
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Welcome!", description: "You're all set up." });
      onComplete();
    },
    onError: (error: Error) => {
      toast({ title: "Setup Failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: { groupName: string; groupCode: string; groupType: string }) => {
    if (mode === "join") {
      if (!data.groupCode) {
        form.setError("groupCode", { message: "Invite code is required to join a group" });
        return;
      }
      setupMutation.mutate({ groupCode: data.groupCode });
    } else {
      if (!data.groupName) {
        form.setError("groupName", { message: "Group name is required" });
        return;
      }
      setupMutation.mutate({
        groupName: data.groupName,
        groupType: groupType,
        role: groupType === "family" ? "parent" : "member",
      });
    }
  };

  const groupTypePlaceholders: Record<string, string> = {
    family: "The Smith Family",
    roommates: "Apartment 4B",
    couple: "Our Finances",
  };

  return (
    <Card className="border-border/50 shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle>Set Up Your Group</CardTitle>
        <CardDescription>Create a new group or join an existing one to start tracking shared finances.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => { setMode("create"); form.clearErrors(); }}
            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
              mode === "create"
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-background border-border hover:bg-muted"
            }`}
            data-testid="button-setup-mode-create"
          >
            Create Group
          </button>
          <button
            type="button"
            onClick={() => { setMode("join"); form.clearErrors(); }}
            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
              mode === "join"
                ? "bg-accent text-accent-foreground border-accent shadow-md"
                : "bg-background border-border hover:bg-muted"
            }`}
            data-testid="button-setup-mode-join"
          >
            Join Group
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {mode === "create" && (
            <>
              <div>
                <Label className="text-sm font-medium mb-2 block">Group Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["family", "roommates", "couple"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setGroupType(type)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all capitalize ${
                        groupType === type
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                      data-testid={`button-setup-group-type-${type}`}
                    >
                      {type === "roommates" ? "Roommates" : type === "couple" ? "Couple" : "Family"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Group Name</Label>
                <Input
                  placeholder={groupTypePlaceholders[groupType]}
                  {...form.register("groupName")}
                  className="h-11 rounded-xl"
                  data-testid="input-setup-group-name"
                />
                {form.formState.errors.groupName && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.groupName.message}</p>
                )}
              </div>
            </>
          )}

          {mode === "join" && (
            <>
              <div>
                <Label className="text-sm font-medium mb-2 block">Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="GRP-1234"
                    {...form.register("groupCode")}
                    className="h-11 rounded-xl font-mono flex-1"
                    autoComplete="off"
                    data-testid="input-setup-invite-code"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl shrink-0"
                    onClick={() => setScannerOpen(true)}
                    data-testid="button-setup-scan-qr"
                    title="Scan QR Code"
                  >
                    <Camera className="w-5 h-5" />
                  </Button>
                </div>
                {form.formState.errors.groupCode && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.groupCode.message}</p>
                )}
              </div>
              <QrScannerDialog
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={(code) => {
                  form.setValue("groupCode", code);
                  form.clearErrors("groupCode");
                  setScannerOpen(false);
                }}
              />
            </>
          )}

          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-md font-semibold mt-4 shadow-lg bg-primary hover:bg-primary/90 shadow-primary/25"
            disabled={setupMutation.isPending}
            data-testid="button-setup-submit"
          >
            {setupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
              <span className="flex items-center">Get Started <ArrowRight className="ml-2 w-4 h-4" /></span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const showGroupSetup = searchParams.get("setup") === "group";

  useEffect(() => {
    if (user && user.familyId && !showGroupSetup) {
      setLocation("/");
    }
  }, [user, setLocation, showGroupSetup]);

  if (user && !user.familyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />
        <div className="w-full max-w-md z-10 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-primary to-accent rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/20 rotate-[-6deg]">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display font-bold text-4xl tracking-tight text-foreground">SharedLedger</h1>
            <p className="text-muted-foreground">One more step — set up your group.</p>
          </div>
          <GroupSetupForm onComplete={() => setLocation("/")} />
        </div>
      </div>
    );
  }

  if (user && user.familyId) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-accent rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/20 rotate-[-6deg]">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display font-bold text-4xl tracking-tight text-foreground">SharedLedger</h1>
          <p className="text-muted-foreground">Manage shared finances together.</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Join Group</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="animate-in slide-in-from-bottom-2 duration-300">
            <LoginForm />
          </TabsContent>
          
          <TabsContent value="register" className="animate-in slide-in-from-bottom-2 duration-300">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <Card className="border-border/50 shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle>Welcome Back</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <OAuthButtons />
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your username" {...field} className="h-12 rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        {...field} 
                        className="h-12 rounded-xl pr-12" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-password-login"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-md font-semibold mt-4 shadow-lg shadow-primary/25"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function QrScannerDialog({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: (code: string) => void }) {
  const { t } = useLanguage();
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

      const scannerId = "qr-scanner-region";
      scannerRef.current.id = scannerId;

      const scanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = scanner;

      const scanConfig = { fps: 10, qrbox: { width: 220, height: 220 } };
      const onSuccess = (decodedText: string) => {
        onScan(decodedText);
        stopScanner();
      };
      const onFailure = () => {};

      try {
        await scanner.start({ facingMode: "environment" }, scanConfig, onSuccess, onFailure);
      } catch {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices.length > 0) {
            await scanner.start(devices[0].id, scanConfig, onSuccess, onFailure);
          } else if (mounted) {
            setError(t("cameraUnavailable"));
          }
        } catch (err2: unknown) {
          if (mounted) {
            const errMsg = err2 instanceof Error ? err2.message : String(err2);
            if (errMsg.includes("NotAllowedError") || errMsg.includes("Permission")) {
              setError(t("cameraPermissionDenied"));
            } else {
              setError(t("cameraUnavailable"));
            }
          }
        }
      }
    };

    const timer = setTimeout(startScanner, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, onScan, stopScanner, t]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopScanner(); onClose(); } }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Camera className="w-5 h-5 text-primary" />
            {t("scanQrCode")}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          {error ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => { stopScanner(); onClose(); }} data-testid="button-close-scanner">
                {t("close")}
              </Button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div ref={scannerRef} className="w-full" data-testid="qr-scanner-region" />
              <p className="text-center text-xs text-muted-foreground mt-2 pb-2">
                {t("pointCamera")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [groupType, setGroupType] = useState<"family" | "roommates" | "couple">("family");
  const [showPassword, setShowPassword] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      role: "parent",
      familyName: "",
      familyCode: "",
      groupName: "",
      groupCode: "",
      groupType: "family",
    },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    if (mode === "join") {
      if (!data.groupCode && !data.familyCode) {
        form.setError("groupCode", { message: "Invite code is required to join a group" });
        return;
      }
      data.role = "member";
    } else {
      data.groupType = groupType;
      data.role = groupType === "family" ? "parent" : "member";
      if (!data.groupName && !data.familyName) {
        form.setError("groupName", { message: "Group name is required" });
        return;
      }
    }
    registerMutation.mutate(data);
  };

  const groupTypePlaceholders: Record<string, string> = {
    family: "The Smith Family",
    roommates: "Apartment 4B",
    couple: "Our Finances",
  };

  return (
    <Card className="border-border/50 shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Start managing shared finances</CardDescription>
      </CardHeader>
      <CardContent>
        <OAuthButtons />
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => { setMode("create"); form.clearErrors(); }}
            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
              mode === "create" 
                ? "bg-primary text-primary-foreground border-primary shadow-md" 
                : "bg-background border-border hover:bg-muted"
            }`}
            data-testid="button-mode-create"
          >
            Create Group
          </button>
          <button
            type="button"
            onClick={() => { setMode("join"); form.clearErrors(); }}
            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
              mode === "join" 
                ? "bg-accent text-accent-foreground border-accent shadow-md" 
                : "bg-background border-border hover:bg-muted"
            }`}
            data-testid="button-mode-join"
          >
            Join Group
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} className="h-11 rounded-xl" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} className="h-11 rounded-xl" data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        {...field} 
                        className="h-11 rounded-xl pr-12" 
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-password-register"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "create" && (
              <>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Group Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["family", "roommates", "couple"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setGroupType(type);
                          form.setValue("groupType", type);
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all capitalize ${
                          groupType === type
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-background border-border hover:bg-muted"
                        }`}
                        data-testid={`button-group-type-${type}`}
                      >
                        {type === "roommates" ? "Roommates" : type === "couple" ? "Couple" : "Family"}
                      </button>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="groupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={groupTypePlaceholders[groupType]} 
                          {...field} 
                          className="h-11 rounded-xl" 
                          data-testid="input-group-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {mode === "join" && (
              <>
                <FormField
                  control={form.control}
                  name="groupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Code</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="GRP-1234" 
                            {...field} 
                            className="h-11 rounded-xl font-mono flex-1" 
                            autoComplete="off"
                            data-testid="input-invite-code"
                            onChange={(e) => {
                              field.onChange(e);
                              form.clearErrors("groupCode");
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-xl shrink-0"
                            onClick={() => setScannerOpen(true)}
                            data-testid="button-scan-qr"
                            title="Scan QR Code"
                          >
                            <Camera className="w-5 h-5" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <QrScannerDialog
                  open={scannerOpen}
                  onClose={() => setScannerOpen(false)}
                  onScan={(code) => {
                    form.setValue("groupCode", code);
                    form.clearErrors("groupCode");
                    setScannerOpen(false);
                  }}
                />
              </>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-md font-semibold mt-4 shadow-lg bg-primary hover:bg-primary/90 shadow-primary/25"
              disabled={registerMutation.isPending}
              data-testid="button-register-submit"
            >
              {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                <span className="flex items-center">Get Started <ArrowRight className="ml-2 w-4 h-4" /></span>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
