import type { Client } from "@/types";
import { cn } from "@/lib/utils";

type ClientLogoProps = {
  client: Pick<Client, "name" | "logoUrl" | "primaryColor">;
  size?: "xs" | "sm" | "md";
  className?: string;
};

const sizeClass: Record<NonNullable<ClientLogoProps["size"]>, string> = {
  xs: "h-4 max-w-[80px]",
  sm: "h-5 max-w-[96px]",
  md: "h-8 max-w-[128px]",
};

export function ClientLogo({ client, size = "sm", className }: ClientLogoProps) {
  if (!client.logoUrl) return null;

  return (
    <img
      src={client.logoUrl}
      alt={client.name}
      className={cn(sizeClass[size], "w-auto shrink-0 object-contain object-left", className)}
    />
  );
}
