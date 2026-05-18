import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtUSD, fmtPct } from "@/lib/format";
import { toast } from "sonner";

type AssetType = Database["public"]["Enums"]["asset_type"];
type Investment = Database["public"]["Tables"]["investments"]["Row"];

export function AssetManager({
  title,
  allowedTypes,
  defaultType,
  filterTypes,
}: {
  title: string;
  allowedTypes: { value: AssetType; label: string }[];
  defaultType: AssetType;
  filterTypes: AssetType[];
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);

  const q = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = (q.data ?? []).filter((h) => filterTypes.includes(h.asset_type));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments"] }); toast.success(t("saved")); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{title}</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1" /> {t("addAsset")}
        </Button>
      </div>

      <div className="card-surface p-2 md:p-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">{t("ticker")}</th>
                  <th className="text-left">{t("assetName")}</th>
                  <th className="text-left">{t("platform")}</th>
                  <th className="text-right">{t("quantity")}</th>
                  <th className="text-right">{t("avgCost")}</th>
                  <th className="text-right">{t("currentPrice")}</th>
                  <th className="text-right">USD</th>
                  <th className="text-right">{t("pnl")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => {
                  const v = Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd);
                  const inv = Number(h.quantity) * Number(h.avg_cost_usd);
                  const pnl = v - inv;
                  const pct = inv ? pnl / inv : 0;
                  return (
                    <tr key={h.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 font-mono font-semibold">{h.ticker}</td>
                      <td>{h.name}</td>
                      <td className="text-muted-foreground">{h.platform ?? "—"}</td>
                      <td className="text-right tabular">{Number(h.quantity)}</td>
                      <td className="text-right tabular">{fmtUSD(Number(h.avg_cost_usd))}</td>
                      <td className="text-right tabular">{fmtUSD(Number(h.current_price_usd))}</td>
                      <td className="text-right tabular font-semibold">{fmtUSD(v)}</td>
                      <td className={`text-right tabular ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmtUSD(pnl)} <span className="text-xs">({fmtPct(pct)})</span>
                      </td>
                      <td className="text-right pr-3">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(h); setOpen(true); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(t("confirmDelete"))) del.mutate(h.id); }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssetDialog open={open} onClose={() => setOpen(false)} editing={editing} allowedTypes={allowedTypes} defaultType={defaultType} />
    </div>
  );
}

function AssetDialog({ open, onClose, editing, allowedTypes, defaultType }: {
  open: boolean; onClose: () => void; editing: Investment | null;
  allowedTypes: { value: AssetType; label: string }[]; defaultType: AssetType;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    asset_type: (editing?.asset_type ?? defaultType) as AssetType,
    ticker: editing?.ticker ?? "",
    name: editing?.name ?? "",
    platform: editing?.platform ?? "",
    quantity: String(editing?.quantity ?? ""),
    avg_cost_usd: String(editing?.avg_cost_usd ?? ""),
    current_price_usd: String(editing?.current_price_usd ?? ""),
  }));

  // reset when editing changes
  useState(() => form);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const payload = {
        user_id: u.user.id,
        asset_type: form.asset_type,
        ticker: form.ticker.trim().toUpperCase(),
        name: form.name.trim() || form.ticker.trim().toUpperCase(),
        platform: form.platform.trim() || null,
        quantity: Number(form.quantity) || 0,
        avg_cost_usd: Number(form.avg_cost_usd) || 0,
        current_price_usd: Number(form.current_price_usd) || Number(form.avg_cost_usd) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("investments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["investments"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? t("error")),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? t("editAsset") : t("addAsset")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>{t("type")}</Label>
            <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v as AssetType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("ticker")}</Label><Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} /></div>
          <div><Label>{t("assetName")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="col-span-2"><Label>{t("platform")}</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Insight, Buda.com, ..." /></div>
          <div><Label>{t("quantity")}</Label><Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><Label>{t("avgCost")}</Label><Input type="number" step="any" value={form.avg_cost_usd} onChange={(e) => setForm({ ...form, avg_cost_usd: e.target.value })} /></div>
          <div className="col-span-2"><Label>{t("currentPrice")}</Label><Input type="number" step="any" value={form.current_price_usd} onChange={(e) => setForm({ ...form, current_price_usd: e.target.value })} placeholder={t("refreshPrices")} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
