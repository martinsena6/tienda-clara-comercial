import { ImageOff } from "lucide-react";

export function ProductImage({
  src,
  alt,
  className = "",
  imgClassName = "size-full object-cover",
  loading = "lazy",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
}) {
  if (!src?.trim() || src.startsWith("data:")) {
    return (
      <div
        role="img"
        aria-label={`${alt}: foto próximamente`}
        className={`grid place-items-center bg-[#f7efe5] text-[#c98c5d] ${className}`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <ImageOff className="size-8 stroke-[1.4]" aria-hidden="true" />
          <span className="text-xs font-medium text-[#94745c]">Foto próximamente</span>
        </div>
      </div>
    );
  }

  return <img src={src} alt={alt} loading={loading} className={imgClassName} />;
}
