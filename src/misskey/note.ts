export type Note = {
  id: string;
  text: string | null;
  cw: string | null;
  reply: any | null;
  visibility: string;
  user: any | null;
  poll?: {
    choices: {
      votes: number;
      text: string;
    }[];
    expiredAfter: number;
    multiple: boolean;
  } | null;
};
