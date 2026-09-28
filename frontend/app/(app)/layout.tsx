import AppShell from "@/components/AppShell";

// Páginas con sesión: comparten la cabecera de navegación. El grupo `(app)` no forma parte de la URL.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
