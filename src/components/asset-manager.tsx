import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowDownUp, CalendarIcon } from "lucide-react";
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

const CURRENCIES = ["USD", "COP", "EUR", "MXN", "BRL"] as const;
type Currency = (typeof CURRENCIES)[number];

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
                  <th className="text-left">{t("purchaseDate")}</th>
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
                      <td className="text-muted-foreground tabular text-xs">{(h as any).purchase_date ?? "—"}</td>
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

type Rates = Record<Currency, number>;

function useUsdRates() {
  const [rates, setRates] = useState<Rates>({ USD: 1, COP: 4000, EUR: 0.92, MXN: 18, BRL: 5 });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD");
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !j?.rates) return;
        setRates({
          USD: 1,
          COP: j.rates.COP ?? 4000,
          EUR: j.rates.EUR ?? 0.92,
          MXN: j.rates.MXN ?? 18,
          BRL: j.rates.BRL ?? 5,
        });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);
  return rates;
}

/**
 * Amount input in a chosen currency. Value stored in parent as USD (number string).
 * Local `amount` is the source of truth while user types; conversion to USD on each change.
 */
function MoneyField({
  label,
  currency,
  setCurrency,
  usd,
  setUsd,
  rates,
}: {
  label: string;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  usd: string;
  setUsd: (v: string) => void;
  rates: Rates;
}) {
  // local input string in selected currency, decoupled from parent usd to preserve precision while typing
  const initial = useMemo(() => {
    const n = Number(usd);
    if (!n) return "";
    const v = n * rates[currency];
    return currency === "COP" || currency === "MXN" ? String(Math.round(v)) : v.toFixed(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [amount, setAmount] = useState<string>(initial);

  // when currency changes, reflow the amount from the canonical USD
  useEffect(() => {
    const n = Number(usd);
    if (!n) { setAmount(""); return; }
    const v = n * rates[currency];
    setAmount(currency === "COP" || currency === "MXN" ? String(Math.round(v)) : v.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  const onAmountChange = (v: string) => {
    setAmount(v);
    const n = Number(v);
    const rate = rates[currency] || 1;
    setUsd(n ? (n / rate).toFixed(6) : "");
  };

  const usdPreview = Number(usd) ? fmtUSD(Number(usd)) : "—";

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
        />
        <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="text-[11px] text-muted-foreground font-mono">≈ {usdPreview} USD</div>
    </div>
  );
}

function AssetDialog({ open, onClose, editing, allowedTypes, defaultType }: {
  open: boolean; onClose: () => void; editing: Investment | null;
  allowedTypes: { value: AssetType; label: string }[]; defaultType: AssetType;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const rates = useUsdRates();

  const [form, setForm] = useState({
    asset_type: defaultType as AssetType,
    name: "",
    platform: "",
    currency: "USD" as Currency,
    invested_usd: "",
    current_usd: "",
    purchase_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (!open) return;
    const editCurrency = ((editing as any)?.currency as Currency) ?? "USD";
    setForm({
      asset_type: (editing?.asset_type ?? defaultType) as AssetType,
      name: editing?.name ?? "",
      platform: editing?.platform ?? "",
      currency: CURRENCIES.includes(editCurrency) ? editCurrency : "USD",
      invested_usd: editing ? String(Number(editing.quantity) * Number(editing.avg_cost_usd) || "") : "",
      current_usd: editing ? String(Number(editing.quantity) * Number(editing.current_price_usd) || "") : "",
      purchase_date: (editing as any)?.purchase_date ?? new Date().toISOString().slice(0, 10),
    });
  }, [open, editing, defaultType]);

  const swapAmounts = () => {
    setForm((f) => ({ ...f, invested_usd: f.current_usd, current_usd: f.invested_usd }));
    toast.success(t("amountsSwapped"));
  };

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
        currency: form.currency,
        purchase_date: form.purchase_date,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
          <div className="col-span-1">
            <Label>{t("platform")}</Label>
            <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Insight, Buda, Trii..." />
          </div>
          <div className="col-span-1">
            <Label className="flex items-center gap-1"><CalendarIcon className="size-3.5" /> {t("purchaseDate")}</Label>
            <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </div>

          <div className="col-span-2">
            <MoneyField
              label={t("avgCost")}
              currency={form.currency}
              setCurrency={(c) => setForm((f) => ({ ...f, currency: c }))}
              usd={form.invested_usd}
              setUsd={(v) => setForm((f) => ({ ...f, invested_usd: v }))}
              rates={rates}
            />
          </div>

          <div className="col-span-2 flex justify-center -my-1">
            <Button type="button" variant="ghost" size="sm" onClick={swapAmounts} className="gap-1.5">
              <ArrowDownUp className="size-4" /> {t("swapAmounts")}
            </Button>
          </div>

          <div className="col-span-2">
            <MoneyField
              label={t("currentPrice")}
              currency={form.currency}
              setCurrency={(c) => setForm((f) => ({ ...f, currency: c }))}
              usd={form.current_usd}
              setUsd={(v) => setForm((f) => ({ ...f, current_usd: v }))}
              rates={rates}
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
