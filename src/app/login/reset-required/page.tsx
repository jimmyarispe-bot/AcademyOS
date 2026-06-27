import { Suspense } from "react";
import ResetRequiredForm from "./ResetRequiredForm";

export default function ResetRequiredPage() {
  return (
    <Suspense fallback={<main className="mx-auto mt-24 max-w-md p-8 text-center text-slate-500">Loading...</main>}>
      <ResetRequiredForm />
    </Suspense>
  );
}
