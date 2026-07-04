import base from "./packages/config/eslint.base.mjs";

// Config racine : sert les packages en TS pur qui n'ont pas de config locale
// (domain-*, shared). calc-engine et db ont une config locale (garde de
// dépendance spécifique) ; apps/web a la sienne (basée sur eslint-config-next).
export default [...base];
