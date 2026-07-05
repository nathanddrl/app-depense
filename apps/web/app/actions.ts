"use server";

// Server Actions. Wrappers fins (archi ch.1.4) : résolution du contexte, injection
// du repo, appel au domain package, retour de l'ActionResult tel quel — aucune
// logique métier ici (elle vit dans @app/domain-expense).

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { getCurrentContext } from "../lib/auth/context";
import { createExpense, listExpenses, getBalance } from "@app/domain-expense";
import type { Balance, CreateExpenseInput, Expense, ListExpensesFilters } from "@app/domain-expense";
import { SupabaseExpenseRepository } from "@app/db";
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
