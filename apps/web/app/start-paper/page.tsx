export default function StartPaperPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-brand-100 dark:from-gray-900 dark:to-blue-950">
      <div className="glass p-8 max-w-xl w-full flex flex-col gap-3 shadow-glass">
        <h2 className="text-2xl font-bold text-blue-700 mb-2">Start Full KCSE Paper</h2>
        <div className="text-gray-700 dark:text-gray-200 text-md mb-2">
          Choose your subject and start a real KCSE Paper 1, 2, or 3. 
          You'll have 3 hours (or more with higher tiers) to answer, upload your work, and get examiner feedback.
        </div>
        {/* TODO: Add subject selector, paper type selector, start button */}
        <div className="mt-3 text-center text-sm text-gray-500">
          (This is a preview — exam upload/marking logic to be added next!)
        </div>
      </div>
    </div>
  );
}
