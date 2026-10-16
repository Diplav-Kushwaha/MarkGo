import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  FileText,
  Mail,
  Palette,
  Pencil,
  Save,
  User,
} from "lucide-react";
import {
  getSettings,
  updateSettings,
  getCompanyDetails,
  updateCompanyDetails,
  getAdminProfile,
  updateAdminProfile,
} from "../../api/settingsAdminApi";
import { isValidPhone, normalizePhone, INVALID_PHONE_MESSAGE } from "../../lib/phone";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormActionBar,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui";

/**
 * Settings sections.
 *
 * "Company" and "Profile" used to be two separate sections here; they are now a
 * single "Profile" section (the first item, same place and style) that shows the
 * personal details and the company details together on one page. The other
 * sections are unchanged. There is no separate route per section — they all
 * live under /admin/settings — so no old link can break.
 */
const SECTIONS = [
  { key: "PROFILE", label: "Profile", icon: User },
  { key: "INVOICING", label: "Invoicing", icon: FileText },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "BRAND", label: "Brand", icon: Palette },
  { key: "NOTIFICATIONS", label: "Notifications", icon: Bell },
];

// Sections below this line have no backend endpoint yet, so their save action
// is intentionally disabled rather than silently doing nothing.
const PENDING_SECTIONS = new Set(["EMAIL", "BRAND", "NOTIFICATIONS"]);

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

/** "4" → "April", used by the read-only view of the financial year month. */
const MONTH_LABELS = MONTH_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

/**
 * One read-only row of the Profile page: label on the left, value on the right,
 * and an em dash whenever the value is empty. Mirrors the row/`orDash` styling
 * the details drawers already use.
 */
function DetailRow({ label, value }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-sm text-ink">
        {empty ? <span className="text-muted">—</span> : value}
      </dd>
    </div>
  );
}

const EMPTY_COMPANY = {
  name: "",
  address: "",
  state: "",
  country: "",
  email: "",
  gstNumber: "",
  currency: "INR",
  financialYearStart: 4,
};

const EMPTY_PROFILE = {
  fullName: "",
  phoneNumber: "",
  email: "",
};

function validateCompany(values) {
  const errors = {};

  if (!values.name.trim()) {
    errors.name = "Company name is required.";
  } else if (values.name.trim().length < 2) {
    errors.name = "Company name must be at least 2 characters.";
  } else if (values.name.trim().length > 120) {
    errors.name = "Company name must be 120 characters or fewer.";
  }

  if (values.address.trim().length > 300) {
    errors.address = "Company address must be 300 characters or fewer.";
  }

  if (values.state.trim().length > 100) {
    errors.state = "State must be 100 characters or fewer.";
  }

  if (values.country.trim().length > 100) {
    errors.country = "Country must be 100 characters or fewer.";
  }

  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (values.gstNumber.trim() && !GSTIN_PATTERN.test(values.gstNumber.trim().toUpperCase())) {
    errors.gstNumber = "Enter a valid 15-character GST number.";
  }

  if (values.currency.trim() && !CURRENCY_PATTERN.test(values.currency.trim())) {
    errors.currency = "Currency must be a 3-letter code such as INR.";
  }

  const fy = Number(values.financialYearStart);
  if (!Number.isInteger(fy) || fy < 1 || fy > 12) {
    errors.financialYearStart = "Select the financial year start month.";
  }

  return errors;
}

function validateProfile(values) {
  const errors = {};

  if (values.fullName.trim()) {
    if (values.fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters.";
    } else if (values.fullName.trim().length > 120) {
      errors.fullName = "Full name must be 120 characters or fewer.";
    }
  }

  if (values.phoneNumber.trim() && !isValidPhone(values.phoneNumber)) {
    errors.phoneNumber = INVALID_PHONE_MESSAGE;
  }

  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

function CompanySection({ values, errors, saving, loading, onChange, onSubmit, error, success }) {
  return (
    <Card>
      <CardHeader
        title="Company details"
        description="Your organization's registered details. Company mail, GST number and country are optional."
      />
      <CardBody>
        <form id="company-form" onSubmit={onSubmit} noValidate className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Company name"
              required
              value={values.name}
              onChange={(e) => onChange("name", e.target.value)}
              error={errors.name}
              placeholder="Acme Technologies"
              containerClassName="sm:col-span-2"
            />

            <Input
              label="Company address"
              value={values.address}
              onChange={(e) => onChange("address", e.target.value)}
              error={errors.address}
              placeholder="Optional"
              containerClassName="sm:col-span-2"
            />

            <Input
              label="State"
              value={values.state}
              onChange={(e) => onChange("state", e.target.value)}
              error={errors.state}
              placeholder="Optional"
            />

            <Input
              label="Country"
              value={values.country}
              onChange={(e) => onChange("country", e.target.value)}
              error={errors.country}
              placeholder="Optional"
            />

            <Input
              label="Company mail (optional)"
              type="email"
              value={values.email}
              onChange={(e) => onChange("email", e.target.value)}
              error={errors.email}
              placeholder="accounts@acme.com"
            />

            <Input
              label="GST number (optional)"
              value={values.gstNumber}
              onChange={(e) => onChange("gstNumber", e.target.value.toUpperCase())}
              error={errors.gstNumber}
              placeholder="27ABCDE1234F1Z5"
            />

            <Input
              label="Currency"
              value={values.currency}
              onChange={(e) => onChange("currency", e.target.value.toUpperCase())}
              error={errors.currency}
              placeholder="INR"
              hint="3-letter code, e.g. INR"
            />

            <Select
              label="Financial year start month"
              value={String(values.financialYearStart)}
              onChange={(e) => onChange("financialYearStart", Number(e.target.value))}
              error={errors.financialYearStart}
              options={MONTH_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
            />
          </div>
        </form>
      </CardBody>

      <FormActionBar inset={false} className="border-t">
        <Button type="submit" form="company-form" loading={saving} disabled={saving || loading}>
          {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
          {saving ? "Saving…" : "Save company details"}
        </Button>
      </FormActionBar>
    </Card>
  );
}

/**
 * The merged Profile page.
 *
 * Read-only by default: "Personal details" (what the old Profile page showed)
 * and "Company details" (what the old Company page showed) in one place, with
 * an "Edit Profile" button at the top. Editing turns the same rows into exactly
 * the inputs the two old pages used, and the button row becomes Save Changes /
 * Cancel.
 */
function ProfileSection({
  editing,
  saving,
  loading,
  company,
  companyErrors,
  profile,
  profileErrors,
  onEdit,
  onCancel,
  onSubmit,
  onCompanyChange,
  onProfileChange,
  error,
  success,
}) {
  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={onEdit} disabled={loading}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit Profile
          </Button>
        </div>

        {/* Personal details — from the old Profile page */}
        <Card>
          <CardHeader
            title="Personal details"
            description="Your personal admin details. Changing the phone number changes your login."
            actions={<User className="h-4 w-4 text-muted" aria-hidden="true" />}
          />
          <CardBody>
            <dl>
              <DetailRow label="Full name" value={profile.fullName} />
              <DetailRow label="Phone number" value={profile.phoneNumber} />
              <DetailRow label="Personal mail" value={profile.email} />
            </dl>
          </CardBody>
        </Card>

        {/* Company details — from the old Company page */}
        <Card>
          <CardHeader
            title="Company details"
            description="Your organization's registered details. Company mail, GST number and country are optional."
            actions={<Building2 className="h-4 w-4 text-muted" aria-hidden="true" />}
          />
          <CardBody>
            <dl>
              <DetailRow label="Company name" value={company.name} />
              <DetailRow label="Company address" value={company.address} />
              <DetailRow label="State" value={company.state} />
              <DetailRow label="Country" value={company.country} />
              <DetailRow label="Company mail" value={company.email} />
              <DetailRow label="GST number" value={company.gstNumber} />
              <DetailRow label="Currency" value={company.currency} />
              <DetailRow
                label="Financial year start month"
                value={MONTH_LABELS[company.financialYearStart] ?? company.financialYearStart}
              />
            </dl>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form id="profile-edit-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {/* Personal details — the old Profile form, unchanged */}
        <Card>
          <CardHeader
            title="Personal details"
            description="Your personal admin details. Changing the phone number changes your login."
            actions={<User className="h-4 w-4 text-muted" aria-hidden="true" />}
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                value={profile.fullName}
                onChange={(e) => onProfileChange("fullName", e.target.value)}
                error={profileErrors.fullName}
                placeholder="John Doe"
                containerClassName="sm:col-span-2"
              />

              <Input
                label="Phone number"
                type="tel"
                value={profile.phoneNumber}
                onChange={(e) => onProfileChange("phoneNumber", e.target.value)}
                error={profileErrors.phoneNumber}
                placeholder="9876543210"
                hint="10 digits. Used for login. Must be unique across all companies."
              />

              <Input
                label="Personal mail (optional)"
                type="email"
                value={profile.email}
                onChange={(e) => onProfileChange("email", e.target.value)}
                error={profileErrors.email}
                placeholder="john@example.com"
              />
            </div>
          </CardBody>
        </Card>

        {/* Company details — the old Company form, unchanged */}
        <Card>
          <CardHeader
            title="Company details"
            description="Your organization's registered details. Company mail, GST number and country are optional."
            actions={<Building2 className="h-4 w-4 text-muted" aria-hidden="true" />}
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Company name"
                required
                value={company.name}
                onChange={(e) => onCompanyChange("name", e.target.value)}
                error={companyErrors.name}
                placeholder="Acme Technologies"
                containerClassName="sm:col-span-2"
              />

              <Input
                label="Company address"
                value={company.address}
                onChange={(e) => onCompanyChange("address", e.target.value)}
                error={companyErrors.address}
                placeholder="Optional"
                containerClassName="sm:col-span-2"
              />

              <Input
                label="State"
                value={company.state}
                onChange={(e) => onCompanyChange("state", e.target.value)}
                error={companyErrors.state}
                placeholder="Optional"
              />

              <Input
                label="Country"
                value={company.country}
                onChange={(e) => onCompanyChange("country", e.target.value)}
                error={companyErrors.country}
                placeholder="Optional"
              />

              <Input
                label="Company mail (optional)"
                type="email"
                value={company.email}
                onChange={(e) => onCompanyChange("email", e.target.value)}
                error={companyErrors.email}
                placeholder="accounts@acme.com"
              />

              <Input
                label="GST number (optional)"
                value={company.gstNumber}
                onChange={(e) => onCompanyChange("gstNumber", e.target.value.toUpperCase())}
                error={companyErrors.gstNumber}
                placeholder="27ABCDE1234F1Z5"
              />

              <Input
                label="Currency"
                value={company.currency}
                onChange={(e) => onCompanyChange("currency", e.target.value.toUpperCase())}
                error={companyErrors.currency}
                placeholder="INR"
                hint="3-letter code, e.g. INR"
              />

              <Select
                label="Financial year start month"
                value={String(company.financialYearStart)}
                onChange={(e) => onCompanyChange("financialYearStart", Number(e.target.value))}
                error={companyErrors.financialYearStart}
                options={MONTH_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
              />
            </div>
          </CardBody>
        </Card>
      </form>

      <FormActionBar inset={false} className="border-t lg:rounded-b-xl">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form="profile-edit-form" loading={saving} disabled={saving || loading}>
          {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </FormActionBar>
    </div>
  );
}

function InvoicingSection({ values, errors, saving, onChange, onSubmit, error, success }) {
  return (
    <Card>
      <CardHeader
        title="Invoicing settings"
        description="Defaults applied to new invoices and bills across your workspace."
      />
      <CardBody>
        <form id="invoicing-form" onSubmit={onSubmit} noValidate className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Invoice prefix"
              value={values.invoicePrefix}
              onChange={(e) => onChange("invoicePrefix", e.target.value)}
              error={errors.invoicePrefix}
              placeholder="INV-"
              hint="Prepended to generated invoice numbers"
            />
            <Input
              label="Bill prefix"
              value={values.billPrefix}
              onChange={(e) => onChange("billPrefix", e.target.value)}
              error={errors.billPrefix}
              placeholder="BILL-"
              hint="Prepended to generated bill numbers"
            />
            <Input
              label="Default tax %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={values.defaultTaxPercent}
              onChange={(e) => onChange("defaultTaxPercent", e.target.value)}
              error={errors.defaultTaxPercent}
              placeholder="18"
            />
            <Input
              label="Default payment terms (days)"
              type="number"
              step="1"
              min="0"
              value={values.defaultPaymentTermsDays}
              onChange={(e) => onChange("defaultPaymentTermsDays", e.target.value)}
              error={errors.defaultPaymentTermsDays}
              placeholder="15"
            />
          </div>

          <Textarea
            label="Default invoice notes"
            rows={4}
            value={values.invoiceNotes}
            onChange={(e) => onChange("invoiceNotes", e.target.value)}
            error={errors.invoiceNotes}
            placeholder="e.g. Payment is due within 15 days of the invoice date."
            hint="Pre-filled on every new invoice."
          />
        </form>
      </CardBody>

      <FormActionBar inset={false} className="border-t">
        <Button type="submit" form="invoicing-form" loading={saving} disabled={saving}>
          {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
          {saving ? "Saving…" : "Save invoicing settings"}
        </Button>
      </FormActionBar>
    </Card>
  );
}

function PendingSection({ section }) {
  if (section === "EMAIL") {
    return (
      <Card>
        <CardHeader title="Email" description="Outbound email templates and sender identity." />
        <CardBody>
          <div className="rounded-card border border-dashed border-primary-100 bg-primary-50/50 px-6 py-14 text-center">
            <Mail className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-ink">Not connected yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              Email settings are not wired to a backend endpoint yet, so nothing here can be saved.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (section === "NOTIFICATIONS") {
    return (
      <Card>
        <CardHeader title="Notifications" description="Choose which alerts your team receives." />
        <CardBody>
          <div className="rounded-card border border-dashed border-primary-100 bg-primary-50/50 px-6 py-14 text-center">
            <Bell className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-ink">Not connected yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              Notification preferences are not wired to a backend endpoint yet, so nothing here can be
              saved.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={section === "CURRENCY" ? "Currency" : "Brand"}
        description={
          section === "CURRENCY"
            ? "Monetary formatting used across invoices, bills and reports."
            : "Logo, tagline and workspace theme."
        }
      />
      <CardBody className="space-y-4">
        <div className="rounded-card border border-dashed border-primary-100 bg-primary-50/50 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Not connected yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            {section === "CURRENCY"
              ? "Currency settings are not wired to a backend endpoint yet, so nothing here can be saved."
              : "Brand customisation is not wired to a backend endpoint yet, so nothing here can be saved."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 opacity-60 sm:grid-cols-2">
          {section === "CURRENCY" ? (
            <>
              <Select
                label="Currency type"
                value="INR"
                onChange={() => {}}
                disabled
                options={[
                  { value: "INR", label: "INR (₹) — Indian Rupee" },
                  { value: "USD", label: "USD ($) — US Dollar" },
                  { value: "EUR", label: "EUR (€) — Euro" },
                  { value: "GBP", label: "GBP (£) — British Pound" },
                ]}
              />
              <Select
                label="Decimal places"
                value="2"
                onChange={() => {}}
                disabled
                options={[
                  { value: "2", label: "2 (e.g. 100.00)" },
                  { value: "0", label: "0 (e.g. 100)" },
                  { value: "3", label: "3 (e.g. 100.000)" },
                ]}
              />
            </>
          ) : (
            <>
              <Input label="Branding text / tagline" placeholder="e.g. Accounting & billing simplified" disabled />
              <Select
                label="Theme"
                value="indigo"
                onChange={() => {}}
                disabled
                options={[{ value: "indigo", label: "MarkGo Indigo (Default)" }]}
              />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

const EMPTY_INVOICING = {
  invoicePrefix: "",
  billPrefix: "",
  defaultTaxPercent: "",
  defaultPaymentTermsDays: "",
  invoiceNotes: "",
};

export default function CompanyAdminSetting() {
  // The merged Profile page is the first section, so it opens by default.
  const [activeSection, setActiveSection] = useState("PROFILE");

  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY);
  const [companyErrors, setCompanyErrors] = useState({});
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companySuccess, setCompanySuccess] = useState("");

  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE);
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Merged Profile page: the saved values above are what view mode shows, and
  // the drafts below hold what the admin is typing in edit mode. Cancel throws
  // the drafts away; a successful save writes them back.
  const [profileEditing, setProfileEditing] = useState(false);
  const [companyDraft, setCompanyDraft] = useState(EMPTY_COMPANY);
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE);

  const [invoicing, setInvoicing] = useState(EMPTY_INVOICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  // `error` / `success` belong to the Invoicing section, which keeps its own
  // independent save flow and is untouched.
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const loadCompany = getCompanyDetails()
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        setCompanyForm({
          name: res.data.name ?? "",
          address: res.data.address ?? "",
          state: res.data.state ?? "",
          country: res.data.country ?? "",
          email: res.data.email ?? "",
          gstNumber: res.data.gstNumber ?? "",
          currency: res.data.currency ?? "INR",
          financialYearStart: res.data.financialYearStart ?? 4,
        });
      })
      .catch((err) => {
        if (active) setCompanyError(err.response?.data?.message || "Failed to load company details.");
      });

    const loadProfile = getAdminProfile()
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        setProfileForm({
          fullName: res.data.fullName ?? "",
          phoneNumber: res.data.phoneNumber ?? "",
          email: res.data.email ?? "",
        });
      })
      .catch((err) => {
        if (active) setProfileError(err.response?.data?.message || "Failed to load your profile.");
      });

    const loadInvoicing = getSettings()
      .then((res) => {
        if (!active || !res.success || !res.data) return;
        setInvoicing({
          invoicePrefix: res.data.invoicePrefix ?? "",
          billPrefix: res.data.billPrefix ?? "",
          defaultTaxPercent: res.data.defaultTaxPercent ?? "",
          defaultPaymentTermsDays: res.data.defaultPaymentTermsDays ?? "",
          invoiceNotes: res.data.invoiceNotes ?? "",
        });
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Failed to load invoicing settings.");
      });

    Promise.all([loadCompany, loadProfile, loadInvoicing]).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  /**
   * The old standalone Company page's handlers, kept in place with the
   * `CompanySection` component below. The Settings menu no longer links to that
   * section — everything it edited is now part of the merged Profile page — so
   * these only run if some code still selects the "COMPANY" section key.
   */
  const handleCompanyChange = (key, value) => {
    setCompanyForm((previous) => ({ ...previous, [key]: value }));
    setCompanySuccess("");
    setCompanyError("");
    setCompanyErrors((previous) => ({ ...previous, [key]: "" }));
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();

    const found = validateCompany(companyForm);
    setCompanyErrors(found);
    if (Object.values(found).some(Boolean)) return;

    try {
      setCompanySaving(true);
      setCompanyError("");
      setCompanySuccess("");

      const res = await updateCompanyDetails({
        name: companyForm.name.trim(),
        address: companyForm.address.trim() || null,
        state: companyForm.state.trim() || null,
        country: companyForm.country.trim() || null,
        email: companyForm.email.trim().toLowerCase() || null,
        gstNumber: companyForm.gstNumber.trim().toUpperCase() || null,
        currency: companyForm.currency.trim().toUpperCase(),
        financialYearStart: Number(companyForm.financialYearStart),
      });

      if (res.success) {
        setCompanySuccess("Company details saved successfully.");
        if (res.data) {
          setCompanyForm({
            name: res.data.name ?? "",
            address: res.data.address ?? "",
            state: res.data.state ?? "",
            country: res.data.country ?? "",
            email: res.data.email ?? "",
            gstNumber: res.data.gstNumber ?? "",
            currency: res.data.currency ?? "INR",
            financialYearStart: res.data.financialYearStart ?? 4,
          });
        }
      } else {
        setCompanyError(res.message || "Failed to save company details.");
      }
    } catch (err) {
      setCompanyError(err.response?.data?.message || "Failed to save company details.");
    } finally {
      setCompanySaving(false);
    }
  };

  /** Keys whose value actually differs from the saved one, as strings. */
  const changedKeys = (draft, saved) =>
    Object.keys(draft).filter((key) => String(draft[key] ?? "") !== String(saved[key] ?? ""));

  const companyDirty = changedKeys(companyDraft, companyForm).length > 0;
  const profileDirty = changedKeys(profileDraft, profileForm).length > 0;

  const clearProfileMessages = () => {
    setCompanyError("");
    setCompanySuccess("");
    setProfileError("");
    setProfileSuccess("");
  };

  /** Edits the company half of the merged Profile page (the draft). */
  const handleCompanyDraftChange = (key, value) => {
    setCompanyDraft((previous) => ({ ...previous, [key]: value }));
    clearProfileMessages();
    setCompanyErrors((previous) => ({ ...previous, [key]: "" }));
  };

  const handleProfileChange = (key, value) => {
    setProfileDraft((previous) => ({ ...previous, [key]: value }));
    clearProfileMessages();
    setProfileErrors((previous) => ({ ...previous, [key]: "" }));
  };

  /** Enter edit mode with the currently saved values. */
  const handleProfileEdit = () => {
    setCompanyDraft(companyForm);
    setProfileDraft(profileForm);
    setCompanyErrors({});
    setProfileErrors({});
    clearProfileMessages();
    setProfileEditing(true);
  };

  /** Discard the drafts and go back to the read-only view. */
  const handleProfileCancel = () => {
    setCompanyDraft(companyForm);
    setProfileDraft(profileForm);
    setCompanyErrors({});
    setProfileErrors({});
    clearProfileMessages();
    setProfileEditing(false);
  };

  /**
   * Save both sections, each only when it actually changed, with exactly the
   * payloads the old Company and Profile pages sent.
   *
   * Validation runs per changed section, a failing section keeps edit mode open
   * with its own error and the admin's typing intact, and view mode is only
   * restored once every changed section has been stored.
   */
  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    if (!companyDirty && !profileDirty) {
      setProfileEditing(false);
      return;
    }

    let blocked = false;

    if (companyDirty) {
      const found = validateCompany(companyDraft);
      setCompanyErrors(found);
      if (Object.values(found).some(Boolean)) blocked = true;
    } else {
      setCompanyErrors({});
    }

    if (profileDirty) {
      const found = validateProfile(profileDraft);
      setProfileErrors(found);
      if (Object.values(found).some(Boolean)) blocked = true;
    } else {
      setProfileErrors({});
    }

    if (blocked) return;

    clearProfileMessages();
    setCompanySaving(true);
    setProfileSaving(true);

    const failures = [];

    if (companyDirty) {
      try {
        const res = await updateCompanyDetails({
          name: companyDraft.name.trim(),
          address: companyDraft.address.trim() || null,
          state: companyDraft.state.trim() || null,
          country: companyDraft.country.trim() || null,
          email: companyDraft.email.trim().toLowerCase() || null,
          gstNumber: companyDraft.gstNumber.trim().toUpperCase() || null,
          currency: companyDraft.currency.trim().toUpperCase(),
          financialYearStart: Number(companyDraft.financialYearStart),
        });

        if (!res.success) {
          // Named by section, so the admin can see which half failed.
          setCompanyError(
            `Company details: ${res.message || "Failed to save company details."}`
          );
          failures.push("Company details");
        } else {
          // Store the response exactly like the old Company page did, and keep
          // the draft in step so a later failure elsewhere cannot re-send it.
          setCompanySuccess("Company details saved successfully.");
          const next = {
            name: res.data?.name ?? "",
            address: res.data?.address ?? "",
            state: res.data?.state ?? "",
            country: res.data?.country ?? "",
            email: res.data?.email ?? "",
            gstNumber: res.data?.gstNumber ?? "",
            currency: res.data?.currency ?? "INR",
            financialYearStart: res.data?.financialYearStart ?? 4,
          };
          setCompanyForm(next);
          setCompanyDraft(next);
        }
      } catch (err) {
        setCompanyError(
          `Company details: ${err.response?.data?.message || "Failed to save company details."}`
        );
        failures.push("Company details");
      }
    }

    if (profileDirty) {
      try {
        const res = await updateAdminProfile({
          fullName: profileDraft.fullName.trim() || undefined,
          phoneNumber: profileDraft.phoneNumber.trim()
            ? normalizePhone(profileDraft.phoneNumber)
            : undefined,
          email: profileDraft.email.trim().toLowerCase() || null,
        });

        if (!res.success) {
          // Named by section, so the admin can see which half failed.
          setProfileError(`Personal details: ${res.message || "Failed to save profile."}`);
          failures.push("Personal details");
        } else {
          setProfileSuccess("Profile saved successfully.");
          const next = {
            fullName: res.data?.fullName ?? "",
            phoneNumber: res.data?.phoneNumber ?? "",
            email: res.data?.email ?? "",
          };
          setProfileForm(next);
          setProfileDraft(next);
        }
      } catch (err) {
        setProfileError(
          `Personal details: ${err.response?.data?.message || "Failed to save profile."}`
        );
        failures.push("Personal details");
      }
    }

    setCompanySaving(false);
    setProfileSaving(false);

    // Both saved: the drafts now match what was stored, so simply close edit
    // mode and the read-only view shows the refreshed values.
    if (failures.length === 0) {
      setCompanyErrors({});
      setProfileErrors({});
      setProfileEditing(false);
    }
  };

  const handleChange = (key, value) => {
    setInvoicing((previous) => ({ ...previous, [key]: value }));
    setSuccess("");
    setError("");
    setErrors((previous) => ({ ...previous, [key]: "" }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const found = {};
    const tax = Number(invoicing.defaultTaxPercent);
    if (invoicing.defaultTaxPercent !== "" && (Number.isNaN(tax) || tax < 0 || tax > 100)) {
      found.defaultTaxPercent = "Enter a percentage between 0 and 100.";
    }
    const terms = Number(invoicing.defaultPaymentTermsDays);
    if (invoicing.defaultPaymentTermsDays !== "" && (Number.isNaN(terms) || terms < 0)) {
      found.defaultPaymentTermsDays = "Enter 0 or more days.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await updateSettings({
        invoicePrefix: invoicing.invoicePrefix,
        billPrefix: invoicing.billPrefix,
        defaultTaxPercent: Number(invoicing.defaultTaxPercent) || 0,
        defaultPaymentTermsDays: Number(invoicing.defaultPaymentTermsDays) || 0,
        invoiceNotes: invoicing.invoiceNotes,
      });

      if (res.success) setSuccess("Invoicing settings saved successfully.");
      else setError(res.message || "Failed to save invoicing settings.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save invoicing settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your personal and company details, plus invoicing defaults."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-2">
          <nav className="space-y-0.5" aria-label="Settings sections">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-body hover:bg-primary-50 hover:text-ink"
                  }`}
                >
                  <Icon className={active ? "text-primary-600" : "text-muted"} aria-hidden="true" />
                  {section.label}
                  {PENDING_SECTIONS.has(section.key) && (
                    <span className="ml-auto rounded-full bg-muted-soft px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </Card>

        <div className="min-w-0">
          {loading ? (
            <Card>
              <CardBody className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))}
              </CardBody>
            </Card>
          ) : (
            <>
              {activeSection === "PROFILE" && (
                <ProfileSection
                  editing={profileEditing}
                  saving={companySaving || profileSaving}
                  loading={loading}
                  company={profileEditing ? companyDraft : companyForm}
                  companyErrors={companyErrors}
                  profile={profileEditing ? profileDraft : profileForm}
                  profileErrors={profileErrors}
                  onEdit={handleProfileEdit}
                  onCancel={handleProfileCancel}
                  onSubmit={handleProfileSubmit}
                  onCompanyChange={handleCompanyDraftChange}
                  onProfileChange={handleProfileChange}
                  error={companyError || profileError}
                  success={companySuccess || profileSuccess}
                />
              )}

              {/*
                Legacy section, kept in place but no longer linked from the menu:
                every field it held now lives in the merged Profile page above.
                Nothing sets "COMPANY" any more (the menu and the default both use
                PROFILE), and there is no /admin/settings/company route, so no
                link can reach it.
              */}
              {activeSection === "COMPANY" && (
                <CompanySection
                  values={companyForm}
                  errors={companyErrors}
                  saving={companySaving}
                  loading={loading}
                  onChange={handleCompanyChange}
                  onSubmit={handleCompanySubmit}
                  error={companyError}
                  success={companySuccess}
                />
              )}

              {activeSection === "INVOICING" && (
                <InvoicingSection
                  values={invoicing}
                  errors={errors}
                  saving={saving}
                  onChange={handleChange}
                  onSubmit={handleSave}
                  error={error}
                  success={success}
                />
              )}

              {PENDING_SECTIONS.has(activeSection) && (
                <PendingSection section={activeSection} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
