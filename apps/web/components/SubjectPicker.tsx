const SUBJECTS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Biology",
  "Chemistry",
  "Physics",
  "Geography",
  "History & Government",
  "CRE",
  "Business Studies"
];

export default function SubjectPicker({
  value,
  onChange
}: {
  value?: string;
  onChange?: (subject: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 mb-2">
      <span className="font-bold text-blue-700">Pick a subject:</span>
      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange?.(s)}
            className={`rounded-lg px-4 py-2 font-semibold border ${
              value === s
                ? "bg-blue-600 text-white border-blue-800"
                : "bg-white text-blue-700 border-blue-200"
            } hover:bg-brand-500 hover:text-white transition`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
