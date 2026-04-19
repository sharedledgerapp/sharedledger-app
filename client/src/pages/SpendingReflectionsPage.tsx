import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useExpenses } from "@/hooks/use-data";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, TrendingUp, Calendar, PieChart, Sparkles, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, RefreshCw, Share2, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, format } from "date-fns";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AiAnalysis {
  id: number;
  userId: number;
  type: "monthly_review" | "mid_month_check";
  periodKey: string;
  content: string;
  feedback: number | null;
  createdAt: string;
}

function AnalysisCard({ analysis }: { analysis: AiAnalysis }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<number | null>(analysis.feedback);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [shareSent, setShareSent] = useState(false);

  const openShare = () => {
    const plain = analysis.content.replace(/[#*`_]/g, "").replace(/\n+/g, " ").trim();
    const preview = plain.length > 200 ? plain.slice(0, 200) + "…" : plain;
    const typeLabel = analysis.type === "monthly_review" ? "Monthly Review" : "Mid-Month Check";
    setShareText(`📊 Sage ${typeLabel}: ${preview}`);
    setSharingOpen(true);
  };

  const shareToGroupMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setShareSent(true);
      setTimeout(() => {
        setSharingOpen(false);
        setShareText("");
        setShareSent(false);
      }, 2000);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: number) => {
      await apiRequest("PATCH", `/api/sage/analyses/${analysis.id}/feedback`, { feedback });
    },
    onSuccess: (_, feedback) => {
      setLocalFeedback(feedback);
      queryClient.invalidateQueries({ queryKey: ["/api/sage/analyses"] });
    },
  });

  const typeLabel = analysis.type === "monthly_review" ? "Monthly Review" : "Mid-Month Check";
  const periodLabel = analysis.type === "monthly_review"
    ? format(new Date(analysis.periodKey + "-01"), "MMMM yyyy")
    : format(new Date(analysis.periodKey.replace("-mid", "") + "-01"), "MMMM yyyy") + " (mid-month)";

  const preview = analysis.content.slice(0, 200).replace(/[#*]/g, "").trim() + "…";

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">{typeLabel}</span>
            </div>
            <p className="text-sm font-medium">{periodLabel}</p>
            <p className="text-xs text-muted-foreground font-medium">Generated on {format(new Date(analysis.createdAt), "MMM d, yyyy")}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0"
            data-testid={`button-expand-analysis-${analysis.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {!expanded && (
          <p className="text-sm text-muted-foreground leading-relaxed">{preview}</p>
        )}

        {expanded && (
          <div className="text-sm text-foreground leading-relaxed space-y-1">
            {analysis.content.split("\n").map((line, i) => {
              if (line.startsWith("### ")) return <p key={i} className="font-semibold text-sm mt-3">{line.slice(4)}</p>;
              if (line.startsWith("## ")) return <p key={i} className="font-semibold text-base mt-4">{line.slice(3)}</p>;
              if (line.startsWith("# ")) return <p key={i} className="font-bold text-lg mt-4">{line.slice(2)}</p>;
              if (line.startsWith("**") && line.endsWith("**") && !line.slice(2, -2).includes("**")) {
                return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
              }
              if (line.startsWith("- ") || line.startsWith("• ")) {
                const text = line.slice(2);
                const bParts = text.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>
                      {bParts.map((part, j) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={j}>{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </span>
                  </div>
                );
              }
              const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
              if (boldParts.length > 1) {
                return (
                  <p key={i}>
                    {boldParts.map((part, j) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </p>
                );
              }
              if (line.trim() === "") return <div key={i} className="h-2" />;
              return <p key={i}>{line}</p>;
            })}
          </div>
        )}

        <div className="pt-1 border-t border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Was this helpful?</span>
            <button
              onClick={() => feedbackMutation.mutate(1)}
              className={cn("p-1 rounded hover:bg-secondary transition-colors", localFeedback === 1 ? "text-primary" : "text-muted-foreground")}
              data-testid={`button-thumbs-up-analysis-${analysis.id}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => feedbackMutation.mutate(-1)}
              className={cn("p-1 rounded hover:bg-secondary transition-colors", localFeedback === -1 ? "text-destructive" : "text-muted-foreground")}
              data-testid={`button-thumbs-down-analysis-${analysis.id}`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            {user?.familyId && expanded && (
              <button
                onClick={() => sharingOpen ? setSharingOpen(false) : openShare()}
                className={cn("ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-secondary transition-colors", sharingOpen ? "text-primary" : "text-muted-foreground")}
                data-testid={`button-share-analysis-${analysis.id}`}
              >
                <Share2 className="w-3 h-3" />
                Share with group
              </button>
            )}
          </div>
          {sharingOpen && (
            <div className="rounded-xl border border-border/50 bg-background/80 p-3 space-y-2">
              {shareSent ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-0.5">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span>Sent to group!</span>
                </div>
              ) : (
                <>
                  <Textarea
                    value={shareText}
                    onChange={(e) => setShareText(e.target.value)}
                    rows={3}
                    className="text-sm resize-none bg-background border-border/40 focus-visible:ring-1 rounded-lg"
                    data-testid={`textarea-share-analysis-${analysis.id}`}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground h-7 px-2.5"
                      onClick={() => { setSharingOpen(false); setShareText(""); }}
                      data-testid={`button-cancel-share-analysis-${analysis.id}`}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 px-3"
                      disabled={!shareText.trim() || shareToGroupMutation.isPending}
                      onClick={() => shareToGroupMutation.mutate(shareText.trim())}
                      data-testid={`button-send-share-analysis-${analysis.id}`}
                    >
                      Send to group
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryTab() {
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const { data: analyses, isLoading } = useQuery<AiAnalysis[]>({
    queryKey: ["/api/sage/analyses"],
  });

  const generateMutation = useMutation({
    mutationFn: async (type: "monthly_review" | "mid_month_check") => {
      setGeneratingType(type);
      const res = await apiRequest("POST", "/api/sage/analyses/generate", { type });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sage/analyses"] });
      setGeneratingType(null);
    },
    onError: () => setGeneratingType(null),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Financial History
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Beta</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI-generated monthly reviews and mid-month checks</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate("mid_month_check")}
          disabled={generateMutation.isPending}
          className="flex-1 text-xs"
          data-testid="button-generate-midmonth"
        >
          {generatingType === "mid_month_check" ? (
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 mr-1" />
          )}
          Mid-month check
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate("monthly_review")}
          disabled={generateMutation.isPending}
          className="flex-1 text-xs"
          data-testid="button-generate-monthly"
        >
          {generatingType === "monthly_review" ? (
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 mr-1" />
          )}
          Monthly review
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : !analyses || analyses.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No analyses yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sage generates a mid-month check around the 14th and a full monthly review at the start of each month.
              You can also generate one manually above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {analyses.map(a => <AnalysisCard key={a.id} analysis={a} />)}
        </div>
      )}
    </div>
  );
}

const COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#fb7185"];

export default function SpendingReflectionsPage() {
  const { user } = useAuth();
  const { data: expenses, isLoading } = useExpenses();
  const { t, language } = useLanguage();

  if (isLoading) {
    return <ReflectionsSkeleton />;
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const weeklyExpenses = expenses?.filter(e => 
    isWithinInterval(new Date(e.date), { start: weekStart, end: weekEnd })
  ) || [];

  const monthlyExpenses = expenses?.filter(e => 
    isWithinInterval(new Date(e.date), { start: monthStart, end: monthEnd })
  ) || [];

  const weeklyTotal = weeklyExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const monthlyTotal = monthlyExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  const getTopCategory = (expenseList: typeof expenses) => {
    if (!expenseList?.length) return null;
    const categoryTotals = expenseList.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  };

  const getCategoryBreakdown = (expenseList: typeof expenses) => {
    if (!expenseList?.length) return [];
    const categoryTotals = expenseList.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const weeklyTopCategory = getTopCategory(weeklyExpenses);
  const monthlyTopCategory = getTopCategory(monthlyExpenses);
  const weeklyCategoryData = getCategoryBreakdown(weeklyExpenses);
  const monthlyCategoryData = getCategoryBreakdown(monthlyExpenses);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/app">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-display font-bold">{t("spendingReflections")}</h1>
      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weekly" data-testid="tab-weekly">
            {t("weeklyReflections")}
          </TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">
            {t("monthlyReflections")}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4 mt-4">
          <Card className="bg-gradient-to-br from-primary to-primary/80 border-none text-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{t("spentThisWeek")}</span>
              </div>
              <div className="text-4xl font-display font-bold" data-testid="text-weekly-total">
                ${weeklyTotal.toFixed(2)}
              </div>
              <div className="mt-2 text-sm text-white/70">
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
              </div>
            </CardContent>
          </Card>

          {weeklyTopCategory && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("topCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{weeklyTopCategory.name}</span>
                  <span className="text-lg font-bold text-primary">${weeklyTopCategory.amount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                {t("spendingBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              {weeklyCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={weeklyCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {weeklyCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {t("noData")}
                </div>
              )}
            </CardContent>
          </Card>

          {weeklyCategoryData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {t("categoryDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {weeklyCategoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold">${cat.value.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 mt-4">
          <Card className="bg-gradient-to-br from-accent to-accent/80 border-none text-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-white/80 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{t("spentThisMonth")}</span>
              </div>
              <div className="text-4xl font-display font-bold" data-testid="text-monthly-total">
                ${monthlyTotal.toFixed(2)}
              </div>
              <div className="mt-2 text-sm text-white/70">
                {format(monthStart, "MMMM yyyy")}
              </div>
            </CardContent>
          </Card>

          {monthlyTopCategory && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("topCategory")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{monthlyTopCategory.name}</span>
                  <span className="text-lg font-bold text-primary">${monthlyTopCategory.amount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                {t("spendingBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              {monthlyCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={monthlyCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {monthlyCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {t("noData")}
                </div>
              )}
            </CardContent>
          </Card>

          {monthlyCategoryData.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {t("categoryDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {monthlyCategoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold">${cat.value.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReflectionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
