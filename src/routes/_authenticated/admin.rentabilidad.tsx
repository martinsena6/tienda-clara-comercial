import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReportPanel } from "@/components/admin/ReportPanel";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { requireAdminRoute } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/rentabilidad")({
  beforeLoad: requireAdminRoute,
  head: () => ({
    meta: [
      { title: "Rentabilidad — Panel Festiva" },
      { name: "description", content: "Resultado del período con costo congelado en cada venta." },
      { property: "og:title", content: "Rentabilidad — Panel Festiva" },
      { property: "og:description", content: "Resultado del período." },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <PageHeader
        title="Rentabilidad"
        description="Calculada con ventas confirmadas y el costo congelado de cada venta."
      />
      <ReportPanel />
    </RequireAdmin>
  ),
});
