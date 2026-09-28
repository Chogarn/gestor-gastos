import type { Metadata } from "next";
import TransactionsSection from "@/components/TransactionsSection";

export const metadata: Metadata = { title: "Ingresos · Gestor de gastos" };

export default function IncomesPage() {
  return <TransactionsSection view="incomes" />;
}
