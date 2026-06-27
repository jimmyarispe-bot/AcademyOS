"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ScholarshipAdminPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("scholarship_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setApps(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("scholarship_applications")
      .update({
        status,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadData();
  };

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: "2rem",
          marginBottom: "2rem",
        }}
      >
        Scholarship Admin Dashboard
      </h1>

      {loading && <p>Loading...</p>}

      {!loading && apps.length === 0 && (
        <p>No scholarship applications found.</p>
      )}

      {!loading &&
        apps.map((app) => (
          <div
            key={app.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "20px",
              marginBottom: "20px",
              backgroundColor: "#fff",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "15px",
              }}
            >
              {app.student_name}
            </h2>

            <p>
              <strong>Parent:</strong> {app.parent_email}
            </p>

            <p>
              <strong>Income:</strong> $
              {Number(app.household_income || 0).toLocaleString()}
            </p>

            <p>
              <strong>Family Size:</strong> {app.family_size}
            </p>

            <p>
              <strong>Siblings:</strong> {app.sibling_count}
            </p>

            <p>
              <strong>Special Circumstance Score:</strong>{" "}
              {app.special_circumstance_score}
            </p>

            <p
              style={{
                fontSize: "1.1rem",
                fontWeight: "bold",
              }}
            >
              Recommended Award: $
              {Number(app.approved_amount || 0).toLocaleString()}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <span
                style={{
                  fontWeight: "bold",
                  color:
                    app.status === "approved"
                      ? "green"
                      : app.status === "rejected"
                      ? "red"
                      : "#444",
                }}
              >
                {app.status}
              </span>
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "15px",
              }}
            >
              <button
                onClick={() => updateStatus(app.id, "approved")}
                style={{
                  backgroundColor: "green",
                  color: "white",
                  border: "none",
                  padding: "10px 15px",
                  cursor: "pointer",
                  borderRadius: "5px",
                }}
              >
                Approve
              </button>

              <button
                onClick={() => updateStatus(app.id, "rejected")}
                style={{
                  backgroundColor: "red",
                  color: "white",
                  border: "none",
                  padding: "10px 15px",
                  cursor: "pointer",
                  borderRadius: "5px",
                }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
    </main>
  );
}