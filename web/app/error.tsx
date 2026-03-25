"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0a0f18] text-[#c5c8ce] p-6">
      <h1 className="text-lg font-semibold text-[#f5f5f5]">Command Central hit an error</h1>
      <p className="text-sm text-[#8b9199] max-w-md text-center">
        {error.message || "Something went wrong while rendering this page."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-[#2b5278] px-4 py-2 text-sm text-[#f5f5f5] hover:bg-[#3a6a96]"
      >
        Try again
      </button>
    </div>
  );
}
