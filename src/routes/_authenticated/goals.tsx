import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { fmtUSD } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/goals")({ component: GoalsPage });

function GoalsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");

  const goalsQ = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("created_at");
      if (error) throw error; return data ?? [];
    },
  });

  const invQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data } = await supabase.from("investments").select("quantity,current_price_usd");
      return data ?? [];
    },
  });

  const total = (invQ.data ?? []).reduce((a, h) => a + Number(h.quantity) * Number(h.current_price_usd), 0);

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("goals").insert({
        user_id: u.user!.id, name: name.trim(), target_amount_usd: Number(target), target_date: date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setOpen(false); setName(""); setTarget(""); setDate("");
      toast.success(t("saved"));
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("goals").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t("goals")}</h1>
        <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />{t("addGoal")}</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(goalsQ.data ?? []).length === 0 && (
          <div className="card-surface p-6 text-sm text-muted-foreground md:col-span-2">{t("noData")}</div>
        )}
        {(goalsQ.data ?? []).map((g) => {
          const pct = Math.min(1, total / Number(g.target_amount_usd));
          return (
            <div key={g.id} className="card-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{g.name}</h3>
                  {g.target_date && <p className="text-xs text-muted-foreground mt-0.5">{g.target_date}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(g.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{t("progress")}</span>
                  <span className="font-mono tabular">{fmtUSD(total)} / {fmtUSD(Number(g.target_amount_usd))}</span>
                </div>
                <Progress value={pct * 100} />
                <p className="text-right text-xs text-muted-foreground mt-1 font-mono">{(pct * 100).toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addGoal")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("goalName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>{t("target")} (USD)</Label><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            <div><Label>{t("targetDate")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => add.mutate()} disabled={!name || !target || add.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
