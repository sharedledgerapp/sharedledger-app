import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrencySymbol } from "@/lib/currency";
import { Plus, Users, Search, Archive, Globe, CheckCircle2 } from "lucide-react";
import { CreateFriendGroupDialog } from "@/components/CreateFriendGroupDialog";
import { cn } from "@/lib/utils";

interface Balance {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amount: string;
}

interface FriendGroup {
  id: number;
  name: string;
  code: string;
  currency: string;
  archived: boolean;
  memberCount: number;
  memberRole: string;
  createdAt: string;
}

export default function FriendGroupsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const currentUserId = (user as { id: number })?.id;

  const { data: groups, isLoading } = useQuery<FriendGroup[]>({
    queryKey: ["/api/friend-groups"],
    queryFn: async () => {
      const res = await fetch("/api/friend-groups", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load groups");
      return res.json();
    },
  });

  const filtered = (groups || []).filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter((g) => !g.archived);
  const archived = filtered.filter((g) => g.archived);

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">My Groups</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Friends &amp; travel groups</p>
        </div>
        <Button
          className="rounded-full shadow-lg shadow-primary/25"
          size="icon"
          onClick={() => setShowCreate(true)}
          data-testid="button-new-group-fab"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {(groups?.length || 0) > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-groups"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">No groups yet</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Create a group for a trip, shared house, or any friend split
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-create-first-group">
            <Plus className="w-4 h-4 mr-2" /> Create or Join a Group
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <div className="space-y-3">
                {active.map((group) => (
                  <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
                ))}
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section>
              <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Archive className="w-4 h-4" /> Archived
              </h3>
              <div className="space-y-3 opacity-60">
                {archived.map((group) => (
                  <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && search && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No groups match "{search}"
            </div>
          )}
        </div>
      )}

      <CreateFriendGroupDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function GroupCard({ group, currentUserId }: { group: FriendGroup; currentUserId: number }) {
  const currencySymbol = getCurrencySymbol(group.currency);

  const { data: balances } = useQuery<Balance[]>({
    queryKey: ["/api/friend-groups", group.id, "balances"],
    queryFn: async () => {
      const res = await fetch(`/api/friend-groups/${group.id}/balances`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const netSummary = (() => {
    if (!balances) return null;
    let owedToMe = 0;
    let iOwe = 0;
    for (const b of balances) {
      const amt = Number(b.amount);
      if (b.toUserId === currentUserId) owedToMe += amt;
      if (b.fromUserId === currentUserId) iOwe += amt;
    }
    if (owedToMe === 0 && iOwe === 0) return { type: "settled" as const, amount: 0 };
    if (iOwe > owedToMe) return { type: "owe" as const, amount: iOwe - owedToMe };
    return { type: "owed" as const, amount: owedToMe - iOwe };
  })();

  return (
    <Link href={`/groups/${group.id}`}>
      <Card
        className="border-border/50 shadow-sm hover:border-primary/30 transition-all active:scale-[0.99] cursor-pointer"
        data-testid={`group-card-${group.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold truncate">{group.name}</h4>
                {group.archived && (
                  <Badge variant="secondary" className="text-xs gap-1 flex-shrink-0">
                    <Archive className="w-2.5 h-2.5" /> Archived
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                </span>
                <span className="text-xs text-muted-foreground">{group.currency}</span>
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 capitalize">{group.memberRole}</Badge>
              </div>

              {netSummary && (
                <div className="mt-2">
                  {netSummary.type === "settled" ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> All settled up
                    </span>
                  ) : netSummary.type === "owe" ? (
                    <span className={cn("text-xs font-medium text-destructive")}>
                      You owe {currencySymbol}{netSummary.amount.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-green-600">
                      You are owed {currencySymbol}{netSummary.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
