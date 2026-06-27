import { redirect } from "next/navigation";

export default function CertificationReadinessRedirect() {
  redirect("/dashboard/certification/launch");
}
