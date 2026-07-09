"use server";

// Server Actions. Wrappers fins (archi ch.1.4) : résolution du contexte, injection
// du repo, appel au domain package, retour de l'ActionResult tel quel — aucune
// logique métier ici (elle vit dans @app/domain-expense).

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { getCurrentContext, requireAdmin } from "../lib/auth/context";
import {
  createExpense,
  listExpenses,
  getBalance,
  getBalanceDetail,
  getAdminExpenseOverview,
  adminUpdateExpense,
} from "@app/domain-expense";
import type {
  AdminExpenseOverviewLine,
  Balance,
  BalanceDetailLine,
  CreateExpenseInput,
  Expense,
  ListExpensesFilters,
  UpdateExpenseInput,
} from "@app/domain-expense";
import { addAid, removeAid } from "@app/domain-aid";
import type { AddAidInput, RemoveAidInput, Expense as AidExpense } from "@app/domain-aid";
import {
  initiateSettlement,
  confirmSettlement,
  cancelSettlement,
  getCurrentSettlement,
} from "@app/domain-settlement";
import type {
  CancelSettlementInput,
  ConfirmSettlementInput,
  Settlement,
} from "@app/domain-settlement";
import { createRecurringTemplate } from "@app/domain-recurrence";
import type {
  CreateRecurringTemplateInput,
  RecurringTemplate,
} from "@app/domain-recurrence";
import {
  SupabaseExpenseRepository,
  SupabaseAidRepository,
  SupabaseSettlementRepository,
  SupabaseRecurringTemplateRepository,
} from "@app/db";
import type { ActionResult } from "@app/shared";

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createExpenseAction(
  input: Omit<CreateExpenseInput, "householdId">,
): Promise<ActionResult<Expense>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseExpenseRepository(ctx.supabase);
  return createExpense(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId },
    { ...input, householdId: ctx.householdId },
  );
}

export async function listExpensesAction(
  filters: ListExpensesFilters = {},
): Promise<ActionResult<Expense[]>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseExpenseRepository(ctx.supabase);
  return listExpenses(repo, { memberId: ctx.member.id, householdId: ctx.householdId }, filters);
}

export async function getBalanceAction(): Promise<ActionResult<Balance>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseExpenseRepository(ctx.supabase);
  return getBalance(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId },
    { householdId: ctx.householdId },
  );
}

export async function getBalanceDetailAction(): Promise<ActionResult<BalanceDetailLine[]>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseExpenseRepository(ctx.supabase);
  return getBalanceDetail(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId },
    { householdId: ctx.householdId },
  );
}

// Réservée à /admin (T-C8.2, DA14) : revérification serveur systématique, le
// layout `/admin` (T-C8.1) ne suffit pas à couvrir un appel direct de l'action.
export async function getAdminExpenseOverviewAction(): Promise<
  ActionResult<AdminExpenseOverviewLine[]>
> {
  const ctx = await getCurrentContext();
  const forbidden = requireAdmin(ctx);
  if (forbidden) return forbidden;

  const repo = new SupabaseExpenseRepository(ctx.supabase);
  return getAdminExpenseOverview(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId, role: ctx.role },
    { householdId: ctx.householdId },
  );
}

// Réservée à /admin (T-C8.3, DA14) : corrige une dépense verrouillée en
// contournant EXPENSE_LOCKED via `adminUpdateExpense` (bypass isolé au domaine,
// `updateExpense` classique reste intact). Revérification serveur systématique.
export async function adminUpdateExpenseAction(
  input: UpdateExpenseInput,
): Promise<ActionResult<Expense>> {
  const ctx = await getCurrentContext();
  const forbidden = requireAdmin(ctx);
  if (forbidden) return forbidden;

  const repo = new SupabaseExpenseRepository(ctx.supabase);
  return adminUpdateExpense(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId, role: ctx.role },
    input,
  );
}

export async function addAidAction(input: AddAidInput): Promise<ActionResult<AidExpense>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseAidRepository(ctx.supabase);
  return addAid(repo, { memberId: ctx.member.id, householdId: ctx.householdId }, input);
}

export async function removeAidAction(input: RemoveAidInput): Promise<ActionResult<AidExpense>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseAidRepository(ctx.supabase);
  return removeAid(repo, { memberId: ctx.member.id, householdId: ctx.householdId }, input);
}

export async function getCurrentSettlementAction(): Promise<ActionResult<Settlement | null>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseSettlementRepository(ctx.supabase);
  return getCurrentSettlement(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId },
    { householdId: ctx.householdId },
  );
}

// Seul endroit légitime pour la composition getBalance (@app/domain-expense) →
// initiateSettlement (@app/domain-settlement) : un domaine n'important jamais
// un autre domain-* (DA4, cf. T-C6.2/T-C6.5), cette orchestration vit ici.
export async function initiateSettlementAction(): Promise<ActionResult<Settlement>> {
  const ctx = await getCurrentContext();
  const domainCtx = { memberId: ctx.member.id, householdId: ctx.householdId };

  const expenseRepo = new SupabaseExpenseRepository(ctx.supabase);
  const balance = await getBalance(expenseRepo, domainCtx, { householdId: ctx.householdId });
  if (!balance.ok) return balance;

  const settlementRepo = new SupabaseSettlementRepository(ctx.supabase);
  return initiateSettlement(settlementRepo, domainCtx, {
    householdId: ctx.householdId,
    fromMemberId: balance.data.from,
    toMemberId: balance.data.to,
    amountCents: balance.data.amountCents,
  });
}

export async function confirmSettlementAction(
  input: ConfirmSettlementInput,
): Promise<ActionResult<Settlement>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseSettlementRepository(ctx.supabase);
  return confirmSettlement(repo, { memberId: ctx.member.id, householdId: ctx.householdId }, input);
}

export async function cancelSettlementAction(
  input: CancelSettlementInput,
): Promise<ActionResult<Settlement>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseSettlementRepository(ctx.supabase);
  return cancelSettlement(repo, { memberId: ctx.member.id, householdId: ctx.householdId }, input);
}

export async function createRecurringTemplateAction(
  input: Omit<CreateRecurringTemplateInput, "householdId">,
): Promise<ActionResult<RecurringTemplate>> {
  const ctx = await getCurrentContext();
  const repo = new SupabaseRecurringTemplateRepository(ctx.supabase);
  return createRecurringTemplate(
    repo,
    { memberId: ctx.member.id, householdId: ctx.householdId },
    { ...input, householdId: ctx.householdId },
  );
}
