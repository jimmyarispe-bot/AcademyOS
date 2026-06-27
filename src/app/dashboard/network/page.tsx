import { redirect } from "next/navigation";

export default function NetworkIndexPage() {
  redirect("/dashboard/network/benchmarks");
}
