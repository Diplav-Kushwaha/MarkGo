import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-primary-700">404</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-body">
        The page you are looking for does not exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control bg-[#111A3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1B2550]"
      >
        Back to Home
      </Link>
    </section>
  );
}
