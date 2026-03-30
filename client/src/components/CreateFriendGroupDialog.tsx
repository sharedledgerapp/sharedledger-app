import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import { Camera } from "lucide-react";
import { QrScannerDialog } from "./QrScannerDialog";

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  currency: z.string().default("EUR"),
});

const joinSchema = z.object({
  code: z.string().regex(/^FRD-[A-Z0-9]{4}$/i, "Enter a valid invite code (e.g. FRD-ABCD)"),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFriendGroupDialog({ open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", currency: (user as { currency?: string })?.currency || "EUR" },
  });

  useEffect(() => {
    if (open && user) {
      const userCurrency = (user as { currency?: string }).currency;
      if (userCurrency) {
        createForm.setValue("currency", userCurrency);
      }
    }
  }, [open, user]);

  const joinForm = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof createSchema>) => {
      const res = await apiRequest("POST", "/api/friend-groups", values);
      return res.json() as Promise<{ id: number; name: string; code: string }>;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups"] });
      onOpenChange(false);
      createForm.reset();
      navigate(`/app/groups/${group.id}?code=${group.code}`);
    },
    onError: (e: Error) => {
      toast({ title: "Error creating group", description: e.message, variant: "destructive" });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (values: z.infer<typeof joinSchema>) => {
      const res = await apiRequest("POST", "/api/friend-groups/join", { code: values.code.toUpperCase().trim() });
      return res.json() as Promise<{ id: number; name: string }>;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-groups"] });
      toast({ title: "Joined group!", description: `You joined ${group.name}` });
      onOpenChange(false);
      navigate(`/app/groups/${group.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Error joining group", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Friends &amp; Travel Groups</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="create">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="flex-1" data-testid="tab-create-group">Create</TabsTrigger>
            <TabsTrigger value="join" className="flex-1" data-testid="tab-join-group">Join</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Paris Trip, House Rules, etc." {...field} data-testid="input-group-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.symbol} {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-create-group">
                  {createMutation.isPending ? "Creating..." : "Create Group"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="join" className="mt-4">
            <Form {...joinForm}>
              <form onSubmit={joinForm.handleSubmit((v) => joinMutation.mutate(v))} className="space-y-4">
                <FormField
                  control={joinForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Code</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            placeholder="FRD-XXXX"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            className="font-mono tracking-widest text-center text-lg flex-1"
                            data-testid="input-invite-code"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => setScannerOpen(true)}
                            title="Scan QR Code"
                            data-testid="button-scan-qr-friend-group"
                          >
                            <Camera className="w-4 h-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={joinMutation.isPending} data-testid="button-join-group">
                  {joinMutation.isPending ? "Joining..." : "Join Group"}
                </Button>
              </form>
            </Form>
            <QrScannerDialog
              open={scannerOpen}
              onClose={() => setScannerOpen(false)}
              scannerId="friend-group-join-qr-scanner"
              onScan={(code) => {
                joinForm.setValue("code", code.toUpperCase().trim());
                setScannerOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
