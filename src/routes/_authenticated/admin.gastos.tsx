import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { EXPENSE_CATEGORIES, deleteExpense, errorMessage, expensesQuery, saveExpense, todayAR } from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/gastos")({
  head: () => ({
    meta: [
      { title: "Gastos — Panel Festiva" },
      { name: "description", content: "Gastos del negocio por mes." },
      { property: "og:title", content: "Gastos — Panel Festiva" },
      { property: "og:description", content: "Gastos del negocio por mes." },
    ],
  }),
  component: () => <RequireAdmin><Gastos /></RequireAdmin>,
});

function Gastos() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(todayAR().slice(0, 7));
  const rows = useQuery(expensesQuery(month)).data ?? [];
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(String(fd.get("amount")).replace(",", "."));
    if (!(amount > 0)) { toast.error("Ingresá un monto mayor a 0"); return; }
    try {
      await saveExpense({ date: String(fd.get("date")), category: String(fd.get("category")), description: String(fd.get("description") ?? ""), amount });
      form.reset();
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto guardado");
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const remove = async (id: string) => {
    if (!confirm("¿Borrar este gasto?")) return;
    try { await deleteExpense(id); await qc.invalidateQueries({ queryKey: ["expenses"] }); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <>
      <PageHeader title="Gastos" description={`Total del mes: ${formatPrice(total)}`} actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />} />
      <form onSubmit={submit} className="mb-6 grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-5">
        <Input name="date" type="date" defaultValue={todayAR()} required />
        <select name="category" className="h-9 rounded-md border bg-card px-3 text-sm">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <Input name="description" placeholder="Descripción" />
        <Input name="amount" inputMode="decimal" placeholder="Monto" required />
        <Button type="submit">Agregar gasto</Button>
      </form>
      <DataTable rows={rows} getKey={(e) => e.id} columns={[
        { header: "Fecha", cell: (e) => formatDate(e.date) },
        { header: "Categoría", cell: (e) => e.category },
        { header: "Descripción", cell: (e) => e.description, hideOnMobile: true },
        { header: "Monto", cell: (e) => formatPrice(e.amount), className: "text-right" },
        { header: "", cell: (e) => <Button size="sm" variant="ghost" aria-label="Borrar" onClick={() => remove(e.id)}><Trash2 /></Button> },
      ]} />
    </>
  );
}
