import { useCallback, useEffect, useState } from "react";
import { getVendorProfile } from "../../api/vendorDashboardApi";
import { formatDate } from "../../lib/format";
import { Alert, Card, CardHeader, PageHeader, SkeletonText } from "../../components/ui";

/** Read-only profile. Label + value, with "-" for anything empty. No edit controls. */

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value === null || value === undefined || value === "" ? "-" : value}</span>
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-5 py-2">{children}</div>
    </Card>
  );
}

function AddressBlock({ address }) {
  const line = [address.line1, address.line2, address.city, address.state, address.country, address.postalCode]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{address.type}</p>
      <p className="mt-0.5 text-sm text-ink">{line || "-"}</p>
    </div>
  );
}

export default function VendorProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getVendorProfile();
      if (res.success && res.data) setProfile(res.data);
      else setError("Could not load your profile.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  if (loading) {
    return (
      <>
        <PageHeader title="Profile" />
        <Card>
          <SkeletonText lines={8} className="p-6" />
        </Card>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <PageHeader title="Profile" />
        <Alert tone="error" title="Cannot show your profile">
          {error || "Profile not found."}
        </Alert>
      </>
    );
  }

  const company = profile.company || {};
  const addresses = profile.addresses || [];
  const vendorTypeLabel =
    profile.vendorType === "BUSINESS"
      ? "Business"
      : profile.vendorType === "INDIVIDUAL"
        ? "Individual"
        : profile.vendorType === "SERVICE_PROVIDER"
          ? "Service provider"
          : profile.vendorType;

  return (
    <>
      <PageHeader title="Profile" subtitle="Your registered details. This view is read-only." />

      <div className="space-y-5">
        <Section title="Your details">
          <Row label="Name" value={profile.name} />
          <Row label="Contact person" value={profile.contactPerson} />
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phoneNumber} />
          <Row label="Alternate phone" value={profile.alternatePhone} />
          <Row label="Your company" value={profile.companyName} />
          <Row label="Vendor type" value={vendorTypeLabel} />
          <Row label="Category" value={profile.category} />
          <Row label="GST / Tax number" value={profile.taxNumber} />
          <Row label="PAN" value={profile.panNumber} />
          <Row label="Currency" value={profile.currency} />
          <Row label="Vendor since" value={formatDate(profile.createdAt)} />
        </Section>

        <Section title="Buyer company" description="The company you supply.">
          <Row label="Name" value={company.name} />
          <Row label="Address" value={company.address} />
          <Row label="City" value={company.city} />
          <Row label="State" value={company.state} />
          <Row label="Country" value={company.country} />
          <Row label="GSTIN" value={company.gstNumber} />
          <Row label="Currency" value={company.currency} />
        </Section>

        <Section title="Addresses">
          {addresses.length ? addresses.map((address) => <AddressBlock key={address.id} address={address} />) : <Row label="Addresses" value={null} />}
        </Section>
      </div>
    </>
  );
}
