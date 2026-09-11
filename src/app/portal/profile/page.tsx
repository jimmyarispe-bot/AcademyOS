import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { ParentContactForm } from "@/components/portal/experience/ParentContactForm";
import { ParentProfileForm } from "@/components/portal/experience/ParentProfileForm";

export default async function ParentProfilePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/portal/profile");

  const supabase = await createAuthClient();

  /**
   * This select used to name `relationship`. There is no such column — it is
   * `relationship_to_student`. PostgREST rejects the whole select on an unknown
   * column, supabase-js resolves with `{ data: null, error }`, and the previous
   * version of this page destructured only `data`. So `guardian` was always
   * null, every parent saw their name rendered as their email address and their
   * phone as an em dash, and nothing was logged anywhere.
   *
   * The error is read now. A page that cannot load a family's own record should
   * say so, not quietly render a plausible-looking blank.
   */
  const { data: guardian, error } = await supabase
    .from("guardians")
    .select(
      "id, first_name, last_name, email, phone, family_id, relationship_to_student, communication_preferences"
    )
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (error) {
    console.error("[portal/profile] could not load guardian", error.message);
  }

  const preferences =
    (guardian?.communication_preferences as Record<string, unknown> | null) ?? {};
  const needsConfirmation = preferences.needs_confirmation === true;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-slate-600">
          Your contact details, and how you would like to hear from us.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          We could not load your details just now. Please try again, or contact
          the school if this keeps happening.
        </p>
      )}

      {/* No guardian row means this account has never been linked to a family.
          Saying so is better than rendering an empty form the parent would fill
          in and lose — the save action has nothing to write to either. */}
      {!error && !guardian && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your account is not linked to a family record yet, so there is nothing
          to show here. Please contact the school and we will connect it.
        </p>
      )}

      {guardian && (
        <ParentContactForm
          defaults={{
            first_name: guardian.first_name ?? "",
            last_name: guardian.last_name ?? "",
            email: guardian.email ?? "",
            phone: guardian.phone ?? "",
          }}
          needsConfirmation={needsConfirmation}
        />
      )}

      <ParentProfileForm
        userId={sessionUser.id}
        defaults={{
          language: "en",
          notification_email: true,
          notification_sms: false,
        }}
      />
    </div>
  );
}
