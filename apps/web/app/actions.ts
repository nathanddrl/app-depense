"use server";

// Server Actions. Wrappers fins (archi ch.1.4) : résolution du contexte, injection
// du repo, appel au domain package, retour de l'ActionResult tel quel — aucune
// logique métier ici (elle vit dans @app/domain-expense).

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";
import { getCurrentContext } from "../lib/auth/context";
import { createExpense, listExpenses, getBalance, getBalanceDetail } from "@app/domain-expense";
import type {
  Balance,
  BalanceDetailLine,
  CreateExpenseInput,
  Expense,
  ListExpensesFilters,
} from "@app/domain-expense";
import { addAid, removeAid } from "@app/domain-aid";
import type { AddAidInput, RemoveAidInput, Expense as AidExpense } from "@app/domain-aid";
import { SupabaseExpenseRepository, SupabaseAidRepository } from "@app/db";
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
