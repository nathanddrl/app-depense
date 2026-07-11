import { describe, expect, it } from "vitest";
import { memberDisplayName, type MemberShare } from "./household";

const members: MemberShare[] = [
  { memberId: "m1", displayName: "Toi", defaultSharePct: 50 },
  { memberId: "m2", displayName: "Camille", defaultSharePct: 50 },
];

describe("memberDisplayName", () => {
  it("renvoie le nom affiché d'un membre connu", () => {
    expect(memberDisplayName(members, "m2")).toBe("Camille");
  });

  it("renvoie \"\" pour un membre introuvable (jamais l'id brut)", () => {
    expect(memberDisplayName(members, "inconnu")).toBe("");
  });

  it("renvoie \"\" sur une liste vide", () => {
    expect(memberDisplayName([], "m1")).toBe("");
  });
});
