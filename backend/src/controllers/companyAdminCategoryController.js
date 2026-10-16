import * as categoryService from "../services/categoryService.js";

// POST /api/admin/categories
export async function createCategory(req, res) {
  try {
    const category = await categoryService.createCategory({
      companyId: req.user.companyId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Category created.", data: category });
  } catch (err) {
    console.error("createCategory error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error.", ...(err.existing ? { existing: err.existing } : {}) });
  }
}

// GET /api/admin/categories?search=&source=&type=&page=&pageSize=
export async function getCategories(req, res) {
  try {
    const { search, source, type, page, pageSize } = req.query;
    const result = await categoryService.listCategories({
      companyId: req.user.companyId,
      search,
      source,
      type,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getCategories error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/categories/options
export async function getCategoryOptions(req, res) {
  try {
    const options = await categoryService.getCategoryOptions({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: options });
  } catch (err) {
    console.error("getCategoryOptions error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// GET /api/admin/categories/:id
export async function getCategoryById(req, res) {
  try {
    const category = await categoryService.getCategoryById({
      companyId: req.user.companyId,
      categoryId: req.params.id,
    });
    return res.status(200).json({ success: true, data: category });
  } catch (err) {
    console.error("getCategoryById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// PATCH /api/admin/categories/:id
export async function updateCategory(req, res) {
  try {
    const category = await categoryService.updateCategory({
      companyId: req.user.companyId,
      categoryId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Category updated.", data: category });
  } catch (err) {
    console.error("updateCategory error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

// DELETE /api/admin/categories/:id
export async function deleteCategory(req, res) {
  try {
    await categoryService.deleteCategory({
      companyId: req.user.companyId,
      categoryId: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Category deleted." });
  } catch (err) {
    console.error("deleteCategory error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
