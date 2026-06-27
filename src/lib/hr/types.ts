export interface EmployeeRecord {
  id: string;
  school_id: string;
  employee_number: string | null;
  employee_type: string;
  employment_status: string;
  hire_date: string | null;
  schools?: { name: string } | null;
  employee_profiles?: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    job_title: string | null;
    contact_email: string | null;
  } | null;
}

export interface Position {
  id: string;
  school_id: string;
  title: string;
  department: string | null;
  employment_type: string;
  status: string;
  schools?: { name: string } | null;
}

export interface Certification {
  id: string;
  employee_id: string;
  certification_name: string;
  issuing_body: string | null;
  expiration_date: string | null;
  status: string;
}

export interface PayrollRecord {
  id: string;
  school_id: string;
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  pay_status: string;
  employees?: {
    employee_profiles?: { display_name: string | null } | null;
  } | null;
}

export interface HrStats {
  activeEmployees: number;
  totalEmployees: number;
  expiringCerts: number;
  pendingPayroll: number;
}
