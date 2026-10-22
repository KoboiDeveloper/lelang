export type RegisteredUserRow = {
  id: string;
  employee_nik: string;
  full_name: string;
  public_alias: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  auth_user_id: string | null;
  company_id: string;
  username: string | null;
  bid_count: number;
  company_code: string | null;
  company_name: string | null;
};
