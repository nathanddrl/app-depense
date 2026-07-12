// @app/domain-expense — baril public. Orchestration des dépenses ponctuelles
// (spec ch.5.1). Importe calc-engine + shared + db (types), jamais un autre
// domain-*. Ne réimplémente aucun calcul (DA4) : parts figées via calc-engine.

export { createExpense } from "./create-expense";
export { updateExpense } from "./update-expense";
export { deleteExpense } from "./delete-expense";
export { listExpenses } from "./list-expenses";
export { getBalance } from "./get-balance";
export { getBalanceDetail } from "./get-balance-detail";
export { getAdminExpenseOverview } from "./get-admin-expense-overview";
export { adminUpdateExpense } from "./admin-update-expense";

export type {
  ExpenseRepository,
  NewExpense,
  ExpenseScalarPatch,
  StoredExpense,
} from "./repository";

export type {
  Category,
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesFilters,
  Expense,
  ExpenseShareDTO,
  ExpenseAidDTO,
  ShareInput,
  ExpenseContext,
  ExpenseSource,
  SettlementStatus,
  BalanceAid,
  BalanceExpenseRow,
  RawBalanceExpenseRow,
  Balance,
  BalanceDetailAidLine,
  BalanceDetailLine,
  AdminExpenseOverviewLine,
} from "./types";
