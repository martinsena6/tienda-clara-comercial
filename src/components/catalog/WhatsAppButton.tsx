import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { businessSettings } from "@/lib/domain/mock-data";
import { buildWhatsAppMessage, buildWhatsAppUrl, type WhatsAppLine } from "@/lib/whatsapp";

/** Abre WhatsApp con el pedido. NO registra una venta ni descuenta stock. */
export function WhatsAppButton({ lines, disabled }: { lines: WhatsAppLine[]; disabled?: boolean }) {
  const send = () => {
    const url = buildWhatsAppUrl(businessSettings.whatsapp, buildWhatsAppMessage(businessSettings.name, lines));
    window.open(url, "_blank", "noopener");
    toast("Pedido enviado por WhatsApp", { description: "Queda pendiente hasta que el negocio lo confirme." });
  };
  return (
    <Button size="lg" disabled={disabled} onClick={send} className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90">
      <MessageCircle /> Pedir por WhatsApp
    </Button>
  );
}
