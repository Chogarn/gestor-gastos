import { Category, Transaction } from "@/lib/api";
import TransactionsByDay from "./TransactionsByDay";

type Props = {
  emptyText: string;
  items: Transaction[];
  /** Categorías del mismo tipo que la lista (para el filtro) */
  categories: Category[];
  filter: number;
  onFilterChange: (categoryId: number) => void;
  /** Color del monto (verde para ingresos, rojo para gastos) */
  amountClass: string;
  onEdit: (item: Transaction) => void;
  onDelete: (item: Transaction) => void;
};

export default function TransactionList({
  emptyText,
  items,
  categories,
  filter,
  onFilterChange,
  amountClass,
  onEdit,
  onDelete,
}: Props) {
  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-end gap-2">
        <select
          value={filter}
          onChange={(e) => onFilterChange(Number(e.target.value))}
          aria-label="Filtrar por categoría"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          <option value={0}>Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <TransactionsByDay
        items={items}
        emptyText={emptyText}
        amountClass={amountClass}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </section>
  );
}
