import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { InsertExpense, InsertGoal, InsertAllowance } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// === FAMILY ===
export function useFamily() {
  return useQuery({
    queryKey: [api.family.get.path],
    queryFn: async () => {
      const res = await fetch(api.family.get.path);
      if (!res.ok) throw new Error("Failed to fetch family");
      return api.family.get.responses[200].parse(await res.json());
    },
  });
}

// === EXPENSES ===
export function useExpenses(userId?: number) {
  return useQuery({
    queryKey: [api.expenses.list.path, userId],
    queryFn: async () => {
      // Need to handle optional input correctly in URL if it were a query param
      // The schema defines it as input, but typically GETs put it in query string.
      // Assuming standard fetch behavior for now or ignoring filter if backend endpoint supports it via query params.
      // Since the input schema is optional, let's just fetch list. 
      // If we need filtering, we'd append ?userId=...
      
      const url = userId 
        ? `${api.expenses.list.path}?userId=${userId}` 
        : api.expenses.list.path;
        
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return api.expenses.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertExpense) => {
      const res = await fetch(api.expenses.create.path, {
        method: api.expenses.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || "Failed to create expense");
      }
      return api.expenses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.family.get.path] });
      toast({ title: "Expense Added", description: "Your spending has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Save", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertExpense> & { id: number; splits?: any[] }) => {
      const url = buildUrl(api.expenses.update.path, { id });
      const res = await fetch(url, {
        method: api.expenses.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update expense");
      return api.expenses.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.family.get.path] });
      toast({ title: "Expense Updated", description: "Your spending has been updated." });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.expenses.delete.path, { id });
      const res = await fetch(url, { method: api.expenses.delete.method });
      if (!res.ok) throw new Error("Failed to delete expense");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.family.get.path] });
      toast({ title: "Deleted", description: "Expense removed successfully." });
    },
  });
}

// === GOALS ===
export function useGoals() {
  return useQuery({
    queryKey: [api.goals.list.path],
    queryFn: async () => {
      const res = await fetch(api.goals.list.path);
      if (!res.ok) throw new Error("Failed to fetch goals");
      return api.goals.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertGoal) => {
      const res = await fetch(api.goals.create.path, {
        method: api.goals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create goal");
      return api.goals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.goals.list.path] });
      toast({ title: "Goal Created", description: "Good luck with your savings!" });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertGoal>) => {
      const url = buildUrl(api.goals.update.path, { id });
      const res = await fetch(url, {
        method: api.goals.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update goal");
      return api.goals.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.goals.list.path] });
      toast({ title: "Goal Updated", description: "Progress saved." });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.goals.delete.path, { id });
      const res = await fetch(url, { method: api.goals.delete.method });
      if (!res.ok) throw new Error("Failed to delete goal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.goals.list.path] });
      toast({ title: "Goal Removed", description: "Goal deleted successfully." });
    },
  });
}

export function useSharedGoals() {
  return useQuery({
    queryKey: ["/api/goals/shared"],
    queryFn: async () => {
      const res = await fetch("/api/goals/shared");
      if (!res.ok) throw new Error("Failed to fetch shared goals");
      return res.json();
    },
  });
}

export function useApproveGoal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (goalId: number) => {
      const res = await fetch(`/api/goals/${goalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to approve goal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals/shared"] });
      queryClient.invalidateQueries({ queryKey: [api.goals.list.path] });
      toast({ title: "Goal Approved", description: "The family goal has been approved." });
    },
    onError: (error: Error) => {
      toast({ title: "Approval Failed", description: error.message, variant: "destructive" });
    },
  });
}

// === ALLOWANCES ===
export function useAllowances() {
  return useQuery({
    queryKey: [api.allowances.list.path],
    queryFn: async () => {
      const res = await fetch(api.allowances.list.path);
      if (!res.ok) throw new Error("Failed to fetch allowances");
      return api.allowances.list.responses[200].parse(await res.json());
    },
  });
}

// === UPLOAD ===
export function useUpload() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(api.upload.create.path, {
        method: api.upload.create.method,
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      return api.upload.create.responses[200].parse(await res.json());
    },
    onError: () => {
      toast({ title: "Upload Failed", variant: "destructive" });
    }
  });
}
