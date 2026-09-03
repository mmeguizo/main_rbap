export type AuthenticatedUser = {
  id: string;
  accountId: string;
  email: string;
  name: string;
  role: string;
  workspace: 'RBAP' | 'QM';
  status: string;
  hasPassword: boolean;
  office: {
    id: string;
    name: string;
  } | null;
  account: {
    id: string;
    workspace: 'RBAP' | 'QM';
    role: string;
    status: string;
    office: {
      id: string;
      name: string;
    } | null;
  };
};
