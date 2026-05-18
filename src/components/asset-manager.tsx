import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/format";
import { toast } from "sonner";

type AssetType = Database["public"]["Enums"]["asset_type"];
type Investment = Database["public"]["Tables"]["investments"]["Row"];

const TYPE_LABELS_ES: Record<string, string> = {
  STOCK_US: "Acción EEUU",
  STOCK_CO: "Acción COL",
  ETF: "ETF",
  BOND: "Bono",
  CRYPTO: "Cripto",
};

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
                  <th className="text-left p-3">{t("type")}</th>
                  <th className="text-left">{t("assetName")}</th>
                  <th className="text-left">{t("platform")}</th>
                  <th className="text-right">{t("avgCost")}</th>
                  <th className="text-right">{t("currentPrice")}</th>
                  <th className="text-right">{t("pnl")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => {
                  const inv = Number(h.quantity) * Number(h.avg_cost_usd);
                  const v = Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd);
                  const pnl = v - inv;
                  const pct = inv ? pnl / inv : 0;
                  return (
                    <tr key={h.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs font-semibold">
                          {TYPE_LABELS_ES[h.asset_type] ?? h.asset_type}
                        </span>
                      </td>
                      <td className="font-semibold">{h.name}</td>
                      <td className="text-muted-foreground">{h.platform ?? "—"}</td>
                      <td className="text-right tabular">{fmtUSD(inv)}</td>
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

type Rates = { COP: number; EUR: number; MXN: number; BRL: number };

function useUsdRates() {
  const [rates, setRates] = useState<Rates>({ COP: 4000, EUR: 0.92, MXN: 18, BRL: 5 });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !j?.rates) return;
        setRates({
          COP: j.rates.COP ?? 4000,
          EUR: j.rates.EUR ?? 0.92,
          MXN: j.rates.MXN ?? 18,
          BRL: j.rates.BRL ?? 5,
        });
        setLoaded(true);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);
  return { rates, loaded };
}

function MoneyPair({
  label, usd, setUsd, trm,
}: { label: string; usd: string; setUsd: (v: string) => void; trm: number }) {
  const [cop, setCop] = useState<string>(() => {
    const n = Number(usd);
    return n ? String(Math.round(n * trm)) : "";
  });
  // when usd changes externally
  useEffect(() => {
    const n = Number(usd);
    setCop(n ? String(Math.round(n * trm)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usd, trm]);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">USD</div>
          <Input type="number" step="any" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="0.00" />
        </div>
        <ArrowLeftRight className="size-4 text-muted-foreground mt-4" />
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">COP</div>
          <Input
            type="number" step="any" value={cop}
            onChange={(e) => {
              const v = e.target.value;
              setCop(v);
              const n = Number(v);
              setUsd(n && trm ? (n / trm).toFixed(2) : "");
            }}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}

function AssetDialog({ open, onClose, editing, allowedTypes, defaultType }: {
  open: boolean; onClose: () => void; editing: Investment | null;
  allowedTypes: { value: AssetType; label: string }[]; defaultType: AssetType;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { rates } = useUsdRates();

  const [form, setForm] = useState({
    asset_type: defaultType as AssetType,
    name: "",
    platform: "",
    invested_usd: "",
    current_usd: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      asset_type: (editing?.asset_type ?? defaultType) as AssetType,
      name: editing?.name ?? "",
      platform: editing?.platform ?? "",
      invested_usd: editing ? String(Number(editing.quantity) * Number(editing.avg_cost_usd) || "") : "",
      current_usd: editing ? String(Number(editing.quantity) * Number(editing.current_price_usd) || "") : "",
    });
  }, [open, editing, defaultType]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const invested = Number(form.invested_usd) || 0;
      const current = Number(form.current_usd) || invested;
      const payload = {
        user_id: u.user.id,
        asset_type: form.asset_type,
        ticker: (form.name.trim().slice(0, 8) || form.asset_type).toUpperCase(),
        name: form.name.trim() || (TYPE_LABELS_ES[form.asset_type] ?? form.asset_type),
        platform: form.platform.trim() || null,
        quantity: 1,
        avg_cost_usd: invested,
        current_price_usd: current,
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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? t("editAsset") : t("addAsset")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>{t("type")}</Label>
            <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v as AssetType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedTypes.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t("assetName")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Apple, S&P 500, Bitcoin..." />
          </div>
          <div className="col-span-2">
            <Label>{t("platform")}</Label>
            <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Insight, Buda.com, Trii..." />
          </div>

          <div className="col-span-2">
            <MoneyPair
              label={t("avgCost")}
              usd={form.invested_usd}
              setUsd={(v) => setForm((f) => ({ ...f, invested_usd: v }))}
              trm={rates.COP}
            />
          </div>
          <div className="col-span-2">
            <MoneyPair
              label={t("currentPrice")}
              usd={form.current_usd}
              setUsd={(v) => setForm((f) => ({ ...f, current_usd: v }))}
              trm={rates.COP}
            />
          </div>

          <div className="col-span-2 rounded-lg border border-border p-3 bg-muted/10">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("liveRates")} · 1 USD</div>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <RateCell code="COP" value={fmtNum(rates.COP, 0)} />
              <RateCell code="EUR" value={fmtNum(rates.EUR, 4)} />
              <RateCell code="MXN" value={fmtNum(rates.MXN, 2)} />
              <RateCell code="BRL" value={fmtNum(rates.BRL, 2)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RateCell({ code, value }: { code: string; value: string }) {
  return (
    <div className="rounded-md bg-background/60 px-2 py-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{code}</div>
      <div className="font-mono tabular font-semibold">{value}</div>
    </div>
  );
}
