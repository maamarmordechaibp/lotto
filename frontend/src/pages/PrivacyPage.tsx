export function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-4 text-muted-foreground">
        We respect your privacy and only collect what we need to run the lottery.
      </p>
      <div className="mt-6 space-y-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Data we collect:</strong> name, phone number, and
          optional email/address you provide when entering, plus payment references from our
          processor (never raw card numbers).
        </p>
        <p>
          <strong className="text-foreground">How we use it:</strong> to assign your ticket, send
          confirmations, process payments, and notify winners.
        </p>
        <p>
          <strong className="text-foreground">Sharing:</strong> we share data only with our
          payment processor (Sola Payments) and telephony provider (SignalWire) as needed to
          deliver the service.
        </p>
        <p>
          <strong className="text-foreground">Your rights:</strong> contact us to access or delete
          your personal information.
        </p>
      </div>
    </div>
  );
}
