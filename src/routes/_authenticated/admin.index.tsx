import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportPanel } from "@/components/admin/ReportPanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Rentabilidad — Panel Festiva" },
      { name: "description", content: "Resumen de rentabilidad y ventas del negocio." },
      { property: "og:title", content: "Rentabilidad — Panel Festiva" },
      { property: "og:description", content: "Resumen de rentabilidad." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <>
      <PageHeader
        title="Rentabilidad"
        description="Ventas, costos, gastos y ganancia neta del negocio."
      />
      <ReportPanel compact />
    </>
  );
}
