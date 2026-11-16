import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, MessageCircle, ShoppingBasket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: ShoppingBasket,
    title: "Elegí tus golosinas y combos",
    description: "Explorá las categorías y agregá al carrito todo lo que te guste.",
  },
  {
    icon: ClipboardList,
    title: "Revisá tu pedido",
    description:
      "En el carrito elegí retiro por el local o envío, y completá tus datos de contacto.",
  },
  {
    icon: MessageCircle,
    title: "Mandanos el pedido por WhatsApp",
    description:
      "Se abrirá el chat con el detalle listo. Te confirmamos disponibilidad y coordinamos el pago.",
  },
];

export function HowToBuyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const startShopping = () => {
    onOpenChange(false);
    void navigate({ to: "/catalogo/categorias" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cómo comprar en Festiva?</DialogTitle>
          <DialogDescription>
            Armá tu pedido en pocos pasos y coordiná directamente con el local.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">
                  {index + 1}. {step.title}
                </h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <Button className="w-full" onClick={startShopping}>
          ¡Empezar a comprar! <ArrowRight />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
