import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { loginSchema, registerSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Loader2, Users, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-accent rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/20 rotate-[-6deg]">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display font-bold text-4xl tracking-tight text-foreground">FamilyLedger</h1>
          <p className="text-muted-foreground">Manage your family finances together.</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Join Family</TabsTrigger>
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

function RegisterForm() {
  const { registerMutation } = useAuth();
  const [role, setRole] = useState<"parent" | "child">("parent");
  const [joinStep, setJoinCodeValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      role: "parent",
      familyName: "",
      familyCode: "",
    },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    // Explicitly set role based on state
    data.role = role;
    
    // Safety check for familyCode
    if (role === "child" && !data.familyCode) {
      form.setError("familyCode", { message: "Family invite code is required for teens/young adults" });
      return;
    }

    registerMutation.mutate(data);
  };

  return (
    <Card className="border-border/50 shadow-xl shadow-black/5">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Start managing your family finances</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => { 
              setRole("parent"); 
              form.setValue("role", "parent");
              form.clearErrors();
            }}
            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
              role === "parent" 
                ? "bg-primary text-primary-foreground border-primary shadow-md" 
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            I'm a Parent
          </button>
          <button
            type="button"
            onClick={() => { 
              setRole("child"); 
              form.setValue("role", "child");
              form.clearErrors();
            }}
            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
              role === "child" 
                ? "bg-accent text-accent-foreground border-accent shadow-md" 
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            I'm a Teen / Young Adult
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
                      <Input placeholder="John Doe" {...field} className="h-11 rounded-xl" />
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
                      <Input placeholder="johndoe" {...field} className="h-11 rounded-xl" />
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

            <div className={role === "parent" ? "block" : "hidden"}>
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Family Name</FormLabel>
                    <FormControl>
                      <Input placeholder="The Smith Family" {...field} className="h-11 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={role === "child" ? "block" : "hidden"}>
              <FormField
                control={form.control}
                name="familyCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Invite Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="FAM-1234" 
                        {...field} 
                        className="h-11 rounded-xl font-mono" 
                        autoComplete="off"
                        onChange={(e) => {
                          field.onChange(e);
                          form.clearErrors("familyCode");
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className={`w-full h-12 rounded-xl text-md font-semibold mt-4 shadow-lg ${role === 'child' ? 'bg-accent hover:bg-accent/90 shadow-accent/25' : 'bg-primary hover:bg-primary/90 shadow-primary/25'}`}
              disabled={registerMutation.isPending}
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
