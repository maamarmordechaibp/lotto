export function TermsPage() {
  return (
    <div className="container max-w-3xl py-12 prose prose-sm dark:prose-invert">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-4 text-muted-foreground">
        By entering any lottery on this platform you agree to the following terms.
      </p>
      <ol className="mt-6 space-y-3 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">Random charge model.</strong> Upon entry, a random
          whole-dollar amount within the published range is selected. This amount is charged to
          your payment method and becomes your unique ticket number.
        </li>
        <li>
          <strong className="text-foreground">Eligibility.</strong> Entrants must meet all
          applicable legal requirements in their jurisdiction.
        </li>
        <li>
          <strong className="text-foreground">Payments.</strong> Payments are processed by Sola
          Payments. We do not store raw card data.
        </li>
        <li>
          <strong className="text-foreground">Refunds.</strong> Refunds are issued at the
          operator's discretion and processed back to the original payment method.
        </li>
        <li>
          <strong className="text-foreground">Drawings.</strong> Winners are selected at random
          from sold tickets and announced via SMS and email.
        </li>
      </ol>
    </div>
  );
}
