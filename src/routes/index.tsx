import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { CatalogLayout } from "@/components/catalog/CatalogLayout";
import { HowToBuyDialog } from "@/components/catalog/HowToBuyDialog";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/festiva-portada.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Festiva — Golosinas y cotillón" },
      {
        name: "description",
        content:
          "Golosinas, chocolates, gomitas, combos y cotillón para tus fiestas. Pedí por WhatsApp.",
      },
      { property: "og:title", content: "Festiva — Golosinas y cotillón" },
      { property: "og:description", content: "Todo para festejar: golosinas, combos y cotillón." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [howToBuyOpen, setHowToBuyOpen] = useState(false);

  return (
    <CatalogLayout>
      <section className="mx-auto grid max-w-4xl items-center gap-8 overflow-hidden rounded-3xl bg-secondary p-6 text-center sm:p-10 md:grid-cols-2 md:text-left">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            Festiva — Golosinas, combos y cotillón
          </h1>
          <p className="mt-4 text-muted-foreground">
            Todo para festejar tus cumpleaños y eventos en Resistencia.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            <Button asChild size="lg">
              <Link to="/catalogo/categorias">
                Ver Categorías <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => setHowToBuyOpen(true)}>
              ¿Cómo comprar?
            </Button>
          </div>
        </div>
        <img
          src={heroImg.url}
          alt="Festiva — golosinas, combos y cotillón"
          width={816}
          height={816}
          className="mx-auto aspect-square w-full max-w-sm rounded-2xl object-cover shadow-lift"
        />
      </section>

      <section
        aria-label="Beneficios de comprar en Festiva"
        className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3"
      >
        {[
          { icon: MessageCircle, title: "Pedido por WhatsApp", description: "Sin tarjetas." },
          {
            icon: ShieldCheck,
            title: "Confirmación de stock",
            description: "Revisamos disponibilidad antes de confirmar.",
          },
          {
            icon: Truck,
            title: "Retiro o envío",
            description: "Retiro en Salta 124 o envío a domicilio.",
          },
        ].map((benefit) => (
          <div key={benefit.title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <benefit.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-medium">{benefit.title}</h2>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          </div>
        ))}
      </section>
      <HowToBuyDialog open={howToBuyOpen} onOpenChange={setHowToBuyOpen} />
    </CatalogLayout>
  );
}
