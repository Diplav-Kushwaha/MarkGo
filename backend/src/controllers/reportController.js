import * as reportService from "../services/reportService.js";
import * as reportReadService from "../services/reportReadService.js";

export async function getSalesReport(req, res) {
  try {
    const { from, to } = req.validatedQuery || req.query;
    const data = await reportService.getSalesReport({
      companyId: req.user.companyId,
      from,
      to,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getSalesReport error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getOutstandingReport(req, res) {
  try {
    const data = await reportService.getOutstandingReport({
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("getOutstandingReport error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// ---------------------------------------------------------------------------
// Reports 1-10. All GET-only, all company-scoped from the verified token.
//
// The company is read from `req.user.companyId` in every one of them; nothing
// below accepts a company from the query string or the body. `req.validatedQuery`
// carries the already-cleaned filters, and the service destructures with
// defaults so a present-but-empty filter simply means "no filter".
// ---------------------------------------------------------------------------

const send = async (res, handler, params) => {
  try {
    const data = await handler({ companyId: params.companyId, ...params.rest });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(`${handler.name} error:`, err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Internal server error.",
      // A service can attach field-level detail (for example the too-long
      // daily range), which is passed straight through so a client always gets
      // the same rich shape it gets from a validation failure.
      ...(Array.isArray(err.errors) && err.errors.length ? { errors: err.errors } : {}),
    });
  }
};

/** 1. Sales report — invoices in a date range. */
export async function getSalesListReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getSalesReportList, {
    companyId: req.user.companyId,
    rest: {
      customerId: q.customerId,
      paymentStatus: q.paymentStatus,
      search: q.search,
      from: q.from,
      to: q.to,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 2. Purchases report — bills in a date range. */
export async function getPurchasesReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getPurchasesReportList, {
    companyId: req.user.companyId,
    rest: {
      vendorId: q.vendorId,
      paymentStatus: q.paymentStatus,
      search: q.search,
      from: q.from,
      to: q.to,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 3. All transactions — every recorded money movement. */
export async function getTransactionsReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getTransactionsReport, {
    companyId: req.user.companyId,
    rest: {
      type: q.type,
      status: q.status,
      mode: q.mode,
      partyId: q.partyId,
      search: q.search,
      from: q.from,
      to: q.to,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 4. Profit & loss — overall and by day / month / year. */
export async function getProfitLossReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getProfitLossReport, {
    companyId: req.user.companyId,
    rest: {
      groupBy: q.groupBy,
      from: q.from,
      to: q.to,
      customerId: q.customerId,
    },
  });
}

/** 5. Product-wise profit & loss. */
export async function getSoldProductsReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getSoldProductsReport, {
    companyId: req.user.companyId,
    rest: {
      productId: q.productId,
      search: q.search,
      from: q.from,
      to: q.to,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 6. Service-wise profit & loss. */
export async function getSoldServicesReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getSoldServicesReport, {
    companyId: req.user.companyId,
    rest: {
      serviceId: q.serviceId,
      search: q.search,
      from: q.from,
      to: q.to,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** The sale lines of one sold product or service (reports 5 and 6). */
export async function getSoldItemLines(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getSoldItemLines, {
    companyId: req.user.companyId,
    rest: {
      itemId: q.itemId,
      itemType: q.itemType,
      from: q.from,
      to: q.to,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 7. All customers. */
export async function getCustomersReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getCustomersReport, {
    companyId: req.user.companyId,
    rest: {
      search: q.search,
      hasDues: q.hasDues,
      from: q.from,
      to: q.to,
      sortField: q.sortField,
      order: q.order,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 8. All vendors. */
export async function getVendorsReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getVendorsReport, {
    companyId: req.user.companyId,
    rest: {
      search: q.search,
      hasDues: q.hasDues,
      from: q.from,
      to: q.to,
      sortField: q.sortField,
      order: q.order,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 9. All products. */
export async function getProductsReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getProductsReport, {
    companyId: req.user.companyId,
    rest: {
      search: q.search,
      category: q.category,
      status: q.status,
      stock: q.stock,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}

/** 10. All services. */
export async function getServicesReport(req, res) {
  const q = req.validatedQuery || req.query;
  return send(res, reportReadService.getServicesReport, {
    companyId: req.user.companyId,
    rest: {
      search: q.search,
      category: q.category,
      status: q.status,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
}
