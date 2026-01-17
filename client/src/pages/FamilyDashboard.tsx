import { useFamily } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, ShieldOff, TrendingDown } from "lucide-react";

export default function FamilyDashboard() {
  const { user } = useAuth();
  const { data: familyData, isLoading } = useFamily();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const members = (familyData?.members || []) as any[];
  const familyTotal = members.reduce((sum, m) => sum + (m.total ? Number(m.total) : 0), 0);

  return (
    <div className="space-y-6 pb-20 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-bold text-3xl">Family Dashboard</h1>
        <p className="text-muted-foreground">{familyData?.family.name}</p>
      </div>

      <div className="grid gap-4">
        {members.map((member) => (
          <Card key={member.id} className="overflow-hidden border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>
              <div className="text-right">
                {member.isPrivate ? (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ShieldOff className="w-3 h-3" />
                    <span className="text-sm font-medium italic">Private</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-lg font-bold">${Number(member.total).toFixed(2)}</span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">This Month</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium opacity-80 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Combined Family Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">${familyTotal.toFixed(2)}</div>
          <p className="text-xs opacity-70 mt-1">Total aggregated spending across all visible members</p>
        </CardContent>
      </Card>

      <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-muted flex items-start gap-3">
        <Shield className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Privacy Protection: This dashboard only shows aggregated monthly totals. 
          Individual purchases, categories, and receipts are never visible to other family members.
        </p>
      </div>
    </div>
  );
}
