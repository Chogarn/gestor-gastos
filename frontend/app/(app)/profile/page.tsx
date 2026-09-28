import type { Metadata } from "next";
import ProfileView from "@/components/ProfileView";

export const metadata: Metadata = { title: "Mi perfil · Gestor de gastos" };

export default function ProfilePage() {
  return <ProfileView />;
}
