/** Canonical KCSE subjects */
export declare const SUBJECTS: readonly [{
    readonly slug: "eng";
    readonly label: "English";
}, {
    readonly slug: "kis";
    readonly label: "Kiswahili";
}, {
    readonly slug: "mat";
    readonly label: "Mathematics";
}, {
    readonly slug: "bio";
    readonly label: "Biology";
}, {
    readonly slug: "chem";
    readonly label: "Chemistry";
}, {
    readonly slug: "phy";
    readonly label: "Physics";
}, {
    readonly slug: "his";
    readonly label: "History & Government";
}, {
    readonly slug: "geo";
    readonly label: "Geography";
}, {
    readonly slug: "cre";
    readonly label: "CRE";
}, {
    readonly slug: "bst";
    readonly label: "Business Studies";
}];
export type SubjectSlug = typeof SUBJECTS[number]["slug"];
export type SubjectLabel = typeof SUBJECTS[number]["label"];
export type SubjectName = SubjectLabel | SubjectSlug;
