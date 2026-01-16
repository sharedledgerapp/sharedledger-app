import { useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function FamilyPage() {
  const { data, isLoading } = useFamily();
  const { user } = useAuth();
  const { toast } = useToast();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading family info...</div>;

  const family = data?.family;
  const members = data?.members || [];

  const copyCode = () => {
    if (family?.code) {
      navigator.clipboard.writeText(family.code);
      toast({ title: "Copied!", description: "Invite code copied to clipboard" });
    }
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
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyCode}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <section>
        <h2 className="font-display font-bold text-xl mb-4">Members</h2>
        <div className="grid gap-3">
          {members.map((member) => (
            <Card key={member.id} className="border-border/50 shadow-sm flex items-center p-4">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm mr-4 bg-primary/10">
                <AvatarFallback className="text-primary font-bold">{member.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{member.name}</h3>
                  {member.id === user?.id && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                </div>
                <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
              </div>
              {member.role === 'parent' && <Badge variant="outline" className="border-primary/20 text-primary">Admin</Badge>}
            </Card>
          ))}
        </div>
      </section>

      {/* Placeholder for Allowance management - would go here */}
      {user?.role === 'parent' && (
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="p-6 text-center">
             <h3 className="font-bold text-lg mb-2">Manage Allowances</h3>
             <p className="text-sm text-muted-foreground mb-4">Set up weekly or monthly allowances for children.</p>
             <Button variant="outline" className="border-accent text-accent hover:bg-accent hover:text-white">Coming Soon</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
