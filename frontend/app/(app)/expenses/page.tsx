import type { Metadata } from "next";
import TransactionsSection from "@/components/TransactionsSection";

export const metadata: Metadata = { title: "Gastos · Gestor de gastos" };

export default function ExpensesPage() {
  return <TransactionsSection view="expenses" />;
}
