export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page">
      <div className="w-10 h-10 border-4 border-line border-t-primary-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-sm text-muted font-medium">Loading session...</p>
    </div>
  );
}
