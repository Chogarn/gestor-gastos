"use client";

import { Category, Transaction, TransactionInput, api, isUnauthorized } from "@/lib/api";
import { VIEWS, View } from "@/lib/views";
import Modal from "./Modal";
import TransactionForm from "./TransactionForm";

type Props = {
  view: View;
  /** Categorías de ese tipo, ya filtradas */
  categories: Category[];
  /** El movimiento a editar, o `null` para crear uno nuevo */
  editing: Transaction | null;
  onClose: () => void;
  /** Se llama tras crear o guardar el movimiento, antes de cerrar */
  onSaved: () => void;
  onUnauthorized: () => void;
};

/** Diálogo para crear o editar un gasto o un ingreso. */
export default function TransactionModal({
  view,
  categories,
  editing,
  onClose,
  onSaved,
  onUnauthorized,
}: Props) {
  const config = VIEWS[view];
  const resource = api[view];

  async function save(data: TransactionInput) {
    try {
      if (editing) await resource.update(editing.id, data);
      else await resource.create(data);
    } catch (err) {
      // El formulario ya muestra el error de validación; solo se gestiona la sesión caducada
      if (!isUnauthorized(err)) throw err;
      onUnauthorized();
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal title={editing ? config.editTitle : config.newTitle} onClose={onClose}>
      <TransactionForm
        noun={config.noun}
        categories={categories}
        editing={editing}
        onSubmit={save}
        onCancel={onClose}
      />
    </Modal>
  );
}
