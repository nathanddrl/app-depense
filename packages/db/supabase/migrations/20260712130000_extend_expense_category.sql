-- Étend la liste des catégories de dépense (D18) : ajout additif, aucune valeur
-- existante retirée (compat données/seed/tests déjà en place).
alter type expense_category add value if not exists 'abonnements';
alter type expense_category add value if not exists 'assurances';
alter type expense_category add value if not exists 'transports';
alter type expense_category add value if not exists 'animaux';
alter type expense_category add value if not exists 'restos';
alter type expense_category add value if not exists 'shopping';
