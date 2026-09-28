import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Crear cuenta · Gestor de gastos" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
