-- services_new_logic
--
-- Prepares the shared Item model for the new Services logic. Purely additive
-- and non-destructive: this migration contains NO DDL and NO data removal.
--
-- Background: services reuse the columns the Products work already added to the
-- shared model, so nothing needs to be created:
--   service code  -> productCode          name        -> name
--   selling price -> salesPrice           tax mode    -> sellingPriceTaxMode
--   GST rate      -> taxRate              unit        -> unitId
--   category      -> categoryId           description -> description
--                                  status -> status (ACTIVE/INACTIVE)
--
-- There is therefore no schema change: schema.prisma is untouched and Prisma
-- generates nothing. The index on (companyId, type) already exists, and no
-- unique constraint is added.
--
-- Safety: every statement below is gated on `type = 'SERVICE'`, so no product
-- row can ever be read or written by this migration, and each column is only
-- filled when it is currently empty. Services have no stock, so no stock
-- column is touched.

-- 1. Service code, carried over from the legacy sku / item code.
--    Only fills rows whose productCode is still empty, and only when the sku
--    actually has a value.
UPDATE items
SET productCode = TRIM(sku)
WHERE type = 'SERVICE'
  AND (productCode IS NULL OR productCode = '')
  AND sku IS NOT NULL
  AND TRIM(sku) <> '';

-- 2. Unit and category, matched by name against a Unit / Category belonging to
--    the SAME company (built-in rows have a NULL companyId and are therefore
--    deliberately never matched here). Matching is case-insensitive and
--    trimmed. A side is only filled when it is still empty, and a row is only
--    updated when at least one real match exists, so an unmatched free-text
--    unit or category is simply left NULL rather than guessed.
UPDATE items i
LEFT JOIN units u
  ON u.companyId = i.companyId
  AND LOWER(TRIM(u.fullName)) = LOWER(TRIM(i.unit))
LEFT JOIN categories c
  ON c.companyId = i.companyId
  AND LOWER(TRIM(c.name)) = LOWER(TRIM(i.category))
SET i.unitId = COALESCE(i.unitId, u.id),
    i.categoryId = COALESCE(i.categoryId, c.id)
WHERE i.type = 'SERVICE'
  AND (
    (i.unitId IS NULL AND u.id IS NOT NULL)
    OR (i.categoryId IS NULL AND c.id IS NOT NULL)
  );
