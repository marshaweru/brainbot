export default function PDFExport({ onExport }: { onExport?: () => void }) {
  return (
    <button
      className="mt-3 rounded-xl px-4 py-2 font-bold bg-blue-600 text-white hover:bg-brand-500 shadow"
      onClick={onExport}
      type="button"
    >
      Export as PDF
    </button>
  );
}
