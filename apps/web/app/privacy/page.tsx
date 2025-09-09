export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-brand-100 dark:from-gray-900 dark:to-blue-950">
      <div className="glass p-8 max-w-xl w-full flex flex-col gap-3 shadow-glass">
        <h2 className="text-2xl font-bold text-blue-700 mb-1">Privacy Policy</h2>
        <div className="text-gray-700 dark:text-gray-200 text-sm">
          <p>
            We value your privacy. BrainBot only collects information needed to deliver your revision experience. 
            Your data is never sold or shared with third parties. All uploads and messages are encrypted in transit.
          </p>
          <p>
            You may request account deletion or data export at any time by emailing <a className="underline text-blue-700" href="mailto:chariee@proton.me">chariee@proton.me</a>.
          </p>
          <p>
            Payments are processed securely via M-PESA. We do not store payment card data.
          </p>
          <p>
            For any privacy questions, please contact us at <a className="underline text-blue-700" href="mailto:chariee@proton.me">chariee@proton.me</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
