// apps/web/components/SubjectPicker.tsx
"use client";

import SubjectPickerMulti from "@/components/SubjectPickerMulti";

const DEFAULT_SUBJECTS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Biology",
  "Chemistry",
  "Physics",
  "Geography",
  "History & Government",
  "CRE",
  "Business Studies",
];

type Props = {
  value?: string;
  onChange?: (subject: string) => void;
  subjects?: string[];
  className?: string;
};

export default function SubjectPicker({
  value,
  onChange,
  subjects = DEFAULT_SUBJECTS,
  className,
}: Props) {
  return (
    <SubjectPickerMulti
      value={value ? [value] : []}
      onChange={(list) => onChange?.(list[0] ?? "")}
      subjects={subjects}
      className={className}
      maxSelect={1}
      showActions={false}
    />
  );
}

export { SubjectPickerMulti };
