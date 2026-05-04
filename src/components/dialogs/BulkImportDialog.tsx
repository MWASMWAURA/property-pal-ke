import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useData, TenantStatus } from "@/lib/data-store";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

type Step = "upload" | "map" | "preview";

const REQUIRED_FIELDS = [
  { key: "name", label: "Full name", required: true },
  { key: "phone", label: "Phone", required: false },
  { key: "property", label: "Property", required: true },
  { key: "unit", label: "Unit", required: true },
  { key: "rent", label: "Monthly rent (KSh)", required: true },
  { key: "status", label: "Status", required: false },
  { key: "method", label: "Payment method", required: false },
  { key: "dueDate", label: "Due date", required: false },
  { key: "leaseEnd", label: "Lease end (dd/mm/yyyy)", required: false },
] as const;

type FieldKey = typeof REQUIRED_FIELDS[number]["key"];

const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (l: string) => {
    const out: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { headers, rows };
};

const guessMapping = (headers: string[]): Record<FieldKey, string> => {
  const map = {} as Record<FieldKey, string>;
  const lc = headers.map(h => h.toLowerCase());
  const find = (...needles: string[]) => {
    for (const n of needles) {
      const i = lc.findIndex(h => h.includes(n));
      if (i >= 0) return headers[i];
    }
    return "";
  };
  map.name = find("name", "tenant");
  map.phone = find("phone", "mobile", "msisdn");
  map.property = find("property", "building", "estate");
  map.unit = find("unit", "house", "apt");
  map.rent = find("rent", "amount");
  map.status = find("status");
  map.method = find("method", "payment");
  map.dueDate = find("due", "deadline");
  map.leaseEnd = find("lease", "end", "expiry");
  return map;
};

export const BulkImportDialog = ({ trigger }: { trigger: React.ReactNode }) => {
  const { addTenantsBulk, properties } = useData();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as any);
  const [filename, setFilename] = useState("");

  const reset = () => {
    setStep("upload"); setHeaders([]); setRows([]); setMapping({} as any); setFilename("");
  };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    setHeaders(headers);
    setRows(rows);
    setMapping(guessMapping(headers));
    setStep("map");
  };

  const mapped = useMemo(() => {
    if (step !== "preview") return [];
    return rows.map(r => {
      const obj: any = {};
      (Object.keys(mapping) as FieldKey[]).forEach(k => {
        const col = mapping[k];
        const idx = col ? headers.indexOf(col) : -1;
        obj[k] = idx >= 0 ? r[idx] : "";
      });
      const status = (obj.status || "pending").toLowerCase() as TenantStatus;
      return {
        name: obj.name,
        phone: obj.phone,
        property: obj.property,
        unit: obj.unit,
        rent: Number(String(obj.rent).replace(/[^\d.]/g, "")) || 0,
        status: ["paid", "pending", "overdue"].includes(status) ? status : "pending" as TenantStatus,
        method: obj.method || "M-Pesa",
        dueDate: obj.dueDate || "",
        leaseEnd: obj.leaseEnd || "",
      };
    });
  }, [step, rows, headers, mapping]);

  const validRows = mapped.filter(r => r.name && r.unit && r.property && r.rent > 0);
  const invalidCount = mapped.length - validRows.length;

  const requiredOk = REQUIRED_FIELDS.filter(f => f.required).every(f => mapping[f.key]);

  const finish = () => {
    const n = addTenantsBulk(validRows);
    toast({ title: "Import complete", description: `${n} tenants added${invalidCount ? ` · ${invalidCount} skipped` : ""}.` });
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="size-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center mb-2">
            <FileSpreadsheet className="size-5" />
          </div>
          <DialogTitle>Bulk import tenants</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file exported from Excel or Google Sheets."}
            {step === "map" && `Map columns from ${filename} to tenant fields.`}
            {step === "preview" && `Preview ${mapped.length} rows before importing.`}
          </DialogDescription>
        </DialogHeader>

        {/* STEPPER */}
        <div className="flex items-center gap-2 text-xs">
          {(["upload", "map", "preview"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`size-6 rounded-full flex items-center justify-center font-bold ${step === s ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
              <span className={step === s ? "font-semibold" : "text-muted-foreground"}>{s}</span>
              {i < 2 && <span className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <label className="block border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/60 transition">
            <Upload className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-semibold">Drop CSV here or click to upload</div>
            <div className="text-xs text-muted-foreground mt-1">First row should contain column headers.</div>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        )}

        {step === "map" && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Detected {headers.length} columns and {rows.length} rows in <span className="font-mono">{filename}</span>.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REQUIRED_FIELDS.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select value={mapping[f.key] || "__none__"} onValueChange={(v) => setMapping(m => ({ ...m, [f.key]: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="— skip —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— skip —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!requiredOk && <p className="text-xs text-destructive">Map all required fields (marked *) before previewing.</p>}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 text-success font-semibold"><CheckCircle2 className="size-4" /> {validRows.length} valid</span>
              {invalidCount > 0 && <span className="text-destructive font-semibold">· {invalidCount} skipped (missing required fields)</span>}
            </div>
            <div className="border border-border rounded-lg overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>{REQUIRED_FIELDS.map(f => <th key={f.key} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 20).map((r, i) => {
                    const ok = r.name && r.unit && r.property && r.rent > 0;
                    return (
                      <tr key={i} className={`border-t border-border ${!ok ? "bg-destructive/5" : ""}`}>
                        {REQUIRED_FIELDS.map(f => (
                          <td key={f.key} className="px-3 py-2 whitespace-nowrap">{String((r as any)[f.key] ?? "")}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {mapped.length > 20 && <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">…and {mapped.length - 20} more</div>}
            </div>
            {properties.length === 0 && (
              <p className="text-xs text-warning">Tip: add the matching properties first so they appear in dashboards.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step !== "upload" && (
            <Button type="button" variant="outline" onClick={() => setStep(step === "preview" ? "map" : "upload")}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          )}
          {step === "map" && (
            <Button type="button" disabled={!requiredOk} onClick={() => setStep("preview")} className="gradient-primary text-primary-foreground">
              Preview <ArrowRight className="size-4" />
            </Button>
          )}
          {step === "preview" && (
            <Button type="button" onClick={finish} disabled={validRows.length === 0} className="gradient-primary text-primary-foreground">
              Import {validRows.length} tenants
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
