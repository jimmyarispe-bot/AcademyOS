"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server-auth";
import type { GradeValue } from "@/lib/constants/grades";
import type { ProgramValue } from "@/lib/constants/programs";
import { parseFundingSourcesFromForm } from "@/lib/funding/helpers";
import { syncStudentFundingSources } from "@/lib/funding/sync";

export async function createFamily(formData: FormData) {
  const supabase = await createAuthClient();

  const { data, error } = await supabase
    .from("families")
    .insert({
      school_id: formData.get("school_id") as string,
      family_name: formData.get("family_name") as string,
      primary_address: (formData.get("primary_address") as string) || null,
      city: (formData.get("city") as string) || null,
      state: (formData.get("state") as string) || null,
      zip_code: (formData.get("zip_code") as string) || null,
      billing_email: (formData.get("billing_email") as string) || null,
      billing_phone: (formData.get("billing_phone") as string) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/students");
  return { id: data.id };
}

export async function createStudent(formData: FormData) {
  const supabase = await createAuthClient();
  const fundingSources = parseFundingSourcesFromForm(formData);

  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: formData.get("school_id") as string,
      family_id: (formData.get("family_id") as string) || null,
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      preferred_name: (formData.get("preferred_name") as string) || null,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      grade_level: (formData.get("grade_level") as GradeValue) || null,
      gender: (formData.get("gender") as string) || null,
      program: (formData.get("program") as ProgramValue) || null,
      enrollment_status: (formData.get("enrollment_status") as string) || "pending",
      status: "active",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  try {
    await syncStudentFundingSources(supabase, data.id, fundingSources);
  } catch (syncError) {
    await supabase.from("students").delete().eq("id", data.id);
    return {
      error: syncError instanceof Error ? syncError.message : "Failed to save funding sources",
    };
  }

  revalidatePath("/dashboard/students");
  return { id: data.id };
}

export async function createGuardian(formData: FormData) {
  const supabase = await createAuthClient();

  const { error } = await supabase.from("guardians").insert({
    family_id: formData.get("family_id") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    relationship_to_student: (formData.get("relationship_to_student") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    is_primary: formData.get("is_primary") === "on",
    receives_billing: formData.get("receives_billing") === "on",
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function createEnrollment(formData: FormData) {
  const supabase = await createAuthClient();

  const { error } = await supabase.from("sis_enrollments").insert({
    student_id: formData.get("student_id") as string,
    school_year_id: formData.get("school_year_id") as string,
    program: formData.get("program") as ProgramValue,
    enrollment_status: (formData.get("enrollment_status") as string) || "pending",
    enrolled_at: (formData.get("enrolled_at") as string) || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/students");
  return { success: true };
}
