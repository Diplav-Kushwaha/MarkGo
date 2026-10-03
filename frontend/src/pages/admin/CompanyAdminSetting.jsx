import { useEffect, useState } from "react";
import {
  Bell,
  CircleDollarSign,
  FileText,
  Mail,
  Palette,
  Save,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getSettings, updateSettings } from "../../api/settingsAdminApi";
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

const SECTIONS = [
  { key: "PROFILE", label: "Profile", icon: User },
  { key: "INVOICING", label: "Invoicing", icon: FileText },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "CURRENCY", label: "Currency", icon: CircleDollarSign },
  { key: "BRAND", label: "Brand", icon: Palette },
  { key: "NOTIFICATIONS", label: "Notifications", icon: Bell },
];

// Sections below this line have no backend endpoint yet, so their save action
// is intentionally disabled rather than silently doing nothing.
const PENDING_SECTIONS = new Set(["EMAIL", "CURRENCY", "BRAND", "NOTIFICATIONS"]);

function ProfileSection({ user, company }) {
  const rows = [
    { label: "Company name", value: company?.name },
    { label: "Company ID", value: company?.id, mono: true },
    { label: "Domain slug", value: company?.slug, mono: true },
    { label: "Company email", value: company?.email },
    { label: "GST number", value: company?.gstNumber, mono: true },
    {
      label: "Location",
      value:
        company?.city && company?.country
          ? `${company.city}, ${company.country}`
          : company?.city || company?.country,
    },
    { label: "Address", value: company?.address },
    { label: "Admin full name", value: user?.fullName },
    { label: "Admin login email", value: user?.email },
    { label: "Admin phone", value: user?.phoneNumber },
  ];

  return (
    <Card>
      <CardHeader
        title="Company profile"
        description="Your registered organization and admin details. Change these with your account team."
      />
      <CardBody>
        <dl className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0"
            >
              <dt className="text-sm text-muted">{row.label}</dt>
              <dd
                className={`text-right text-sm text-ink ${row.mono ? "font-mono text-xs" : ""} ${
                  row.label === "Address" ? "max-w-64" : ""
                }`}
              >
                {row.value || <span className="text-muted">Not provided</span>}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
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
          <div className="rounded-lg border border-dashed border-line bg-slate-50 px-6 py-14 text-center">
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
          <div className="rounded-lg border border-dashed border-line bg-slate-50 px-6 py-14 text-center">
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
        <div className="rounded-lg border border-dashed border-line bg-slate-50 px-6 py-10 text-center">
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
  const { user, company } = useAuth();
  const [activeSection, setActiveSection] = useState("PROFILE");

  const [invoicing, setInvoicing] = useState(EMPTY_INVOICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    getSettings()
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
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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
        subtitle="Company profile, invoicing defaults and workspace preferences."
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
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-body hover:bg-slate-50 hover:text-ink"
                  }`}
                >
                  <Icon className={active ? "text-primary-600" : "text-muted"} aria-hidden="true" />
                  {section.label}
                  {PENDING_SECTIONS.has(section.key) && (
                    <span className="ml-auto rounded-full bg-muted-soft px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </Card>

        <div className="min-w-0">
          {activeSection === "PROFILE" && <ProfileSection user={user} company={company} />}

          {activeSection === "INVOICING" &&
            (loading ? (
              <Card>
                <CardBody className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full" />
                  ))}
                </CardBody>
              </Card>
            ) : (
              <InvoicingSection
                values={invoicing}
                errors={errors}
                saving={saving}
                onChange={handleChange}
                onSubmit={handleSave}
                error={error}
                success={success}
              />
            ))}

          {PENDING_SECTIONS.has(activeSection) && (
            <PendingSection section={activeSection} />
          )}
        </div>
      </div>
    </>
  );
}
