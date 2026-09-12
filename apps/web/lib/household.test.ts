import { describe, expect, it } from "vitest";
import { formatAmountEUR } from "@app/shared";
import { formatBalanceMessage, memberDisplayName, type MemberShare } from "./household";

const members: MemberShare[] = [
  { memberId: "m1", displayName: "Toi", defaultSharePct: 50 },
  { memberId: "m2", displayName: "Camille", defaultSharePct: 50 },
];

describe("memberDisplayName", () => {
  it("renvoie le nom affiché d'un membre connu", () => {
    expect(memberDisplayName(members, "m2")).toBe("Camille");
  });

  it('renvoie "" pour un membre introuvable (jamais l\'id brut)', () => {
    expect(memberDisplayName(members, "inconnu")).toBe("");
  });

  it('renvoie "" sur une liste vide', () => {
    expect(memberDisplayName([], "m1")).toBe("");
  });
});

describe("formatBalanceMessage", () => {
  it("solde nul → formule canonique, jamais réinventée", () => {
    expect(formatBalanceMessage({ from: "m1", to: "m2", amountCents: 0 }, members, "m1")).toBe(
      "vous êtes étale",
    );
  });

  it("membre courant créancier → « X te doit Y »", () => {
    expect(formatBalanceMessage({ from: "m2", to: "m1", amountCents: 4000 }, members, "m1")).toBe(
      `Camille te doit ${formatAmountEUR(4000)}`,
    );
  });

  it("membre courant débiteur → « tu dois Y à X »", () => {
    expect(formatBalanceMessage({ from: "m1", to: "m2", amountCents: 4000 }, members, "m1")).toBe(
      `tu dois ${formatAmountEUR(4000)} à Camille`,
    );
  });
});
