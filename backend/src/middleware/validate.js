import { rawQueryWithCompanyGuard } from "../validators/reportValidators.js";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req.body = result.data;
    next();
  };
}

// Same contract as validate(), but for query strings. Assigns the parsed result
// to req.validatedQuery instead of req.body. Use this for list/search endpoints
// so pagination, filters and date ranges are validated like any other input.
//
// A query that carries a company key is rejected here, BEFORE the schema runs,
// because a schema's own preprocessing strips the keys it does not know about
// and would otherwise swallow the mistake silently. The company comes from the
// verified token, so this can only ever be a caller mistake — reported as a 400
// naming the key rather than a silently wider result.
export function validateQuery(schema) {
  return (req, res, next) => {
    const smuggled = rawQueryWithCompanyGuard(req.query);
    if (smuggled) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: [{ field: smuggled.path.join("."), message: smuggled.message }],
      });
    }

    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req.validatedQuery = result.data;
    next();
  };
}

// Same contract as validate(), but for path params. `validate()` reads req.body,
// so a params-only schema ({ id: z.string().uuid() }) can never pass through it —
// the route has no body to read. Use this for `/:id` style routes.
//
// `req.params` is deliberately NOT reassigned: controllers and services read
// `req.params.id` / `req.params.paymentId` directly everywhere in this project.
// The parsed copy is published as `req.validatedParams` for anything that wants
// the normalised value.
//
// `options.status` / `options.message` let a caller answer a malformed id the way
// that endpoint already answers a missing row, instead of a generic 400.
export function validateParams(schema, options = {}) {
  const status = options.status ?? 400;
  const message = options.message ?? "Validation failed.";

  return (req, res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(status).json({
        success: false,
        message,
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    req.validatedParams = result.data;
    next();
  };
}
