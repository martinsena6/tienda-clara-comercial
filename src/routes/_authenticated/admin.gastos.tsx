import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/PageHeader";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import {
  EXPENSE_CATEGORIES,
  deleteExpense,
  errorMessage,
  expensesQuery,
  saveExpense,
  todayAR,
} from "@/lib/data";
import { formatDate, formatPrice } from "@/lib/format";
import { requireAdminRoute } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/gastos")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [
      { title: "Gastos — Panel Festiva" },
      { name: "description", content: "Gastos del negocio por mes." },
      { property: "og:title", content: "Gastos — Panel Festiva" },
      { property: "og:description", content: "Gastos del negocio por mes." },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <Gastos />
    </RequireAdmin>
  ),
});

function Gastos() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(todayAR().slice(0, 7));
  const [editing, setEditing] = useState<{
    id: string;
    date: string;
    category: string;
    description: string;
    amount: number;
  } | null>(null);
  const rows = useQuery(expensesQuery(month)).data ?? [];
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(String(fd.get("amount")).replace(",", "."));
    if (!(amount > 0)) {
      toast.error("Ingresá un monto mayor a 0");
      return;
    }
    try {
      await saveExpense({
        ...(editing ? { id: editing.id } : {}),
        date: String(fd.get("date")),
        category: String(fd.get("category")),
        description: String(fd.get("description") ?? ""),
        amount,
      });
      form.reset();
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(editing ? "Gasto actualizado" : "Gasto guardado");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const remove = async (id: string) => {
    if (!confirm("¿Borrar este gasto?")) return;
    try {
      await deleteExpense(id);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <>
      <PageHeader
        title="Gastos"
        description={`Total del mes: ${formatPrice(total)}`}
        actions={
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        }
      />
      <form
        key={editing?.id ?? "new-expense"}
        onSubmit={submit}
        className="mb-6 grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-5"
      >
        <Input name="date" type="date" defaultValue={editing?.date ?? todayAR()} required />
        <select
          name="category"
          defaultValue={editing?.category ?? EXPENSE_CATEGORIES[0]}
          className="h-9 rounded-md border bg-card px-3 text-sm"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Input
          name="description"
          placeholder="Descripción"
          defaultValue={editing?.description ?? ""}
        />
        <Input
          name="amount"
          inputMode="decimal"
          placeholder="Monto"
          defaultValue={editing?.amount ?? ""}
          required
        />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {editing ? "Guardar cambios" : "Agregar gasto"}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              aria-label="Cancelar edición"
              onClick={() => setEditing(null)}
            >
              <X />
            </Button>
          )}
        </div>
      </form>
      <DataTable
        rows={rows}
        getKey={(e) => e.id}
        columns={[
          { header: "Fecha", cell: (e) => formatDate(e.date) },
          { header: "Categoría", cell: (e) => e.category },
          { header: "Descripción", cell: (e) => e.description, hideOnMobile: true },
          { header: "Monto", cell: (e) => formatPrice(e.amount), className: "text-right" },
          {
            header: "Acciones",
            cell: (e) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Editar gasto ${e.description || e.category}`}
                  onClick={() =>
                    setEditing({
                      id: e.id,
                      date: e.date,
                      category: e.category,
                      description: e.description,
                      amount: e.amount,
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Borrar" onClick={() => remove(e.id)}>
                  <Trash2 />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
