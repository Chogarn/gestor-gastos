"use client";

import { Category, RecurringInput, RecurringTransaction, api, isUnauthorized } from "@/lib/api";
import { View, VIEWS } from "@/lib/views";
import Modal from "./Modal";
import RecurringForm from "./RecurringForm";

type Props = {
  view: View;
  categories: Category[];
  editing: RecurringTransaction | null;
  onClose: () => void;
  onSaved: () => void;
  onUnauthorized: () => void;
};

export default function RecurringModal({
  view,
  categories,
  editing,
  onClose,
  onSaved,
  onUnauthorized,
}: Props) {
  const config = VIEWS[view];

  async function save(data: RecurringInput) {
    try {
      if (editing) await api.recurring.update(editing.id, data);
      else await api.recurring.create(data);
    } catch (err) {
      if (!isUnauthorized(err)) throw err;
      onUnauthorized();
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal title={`${editing ? config.editTitle : config.newTitle} recurrente`} onClose={onClose}>
      <RecurringForm
        noun={config.noun}
        kind={config.kind}
        categories={categories}
        editing={editing}
        onSubmit={save}
        onCancel={onClose}
      />
    </Modal>
  );
}
