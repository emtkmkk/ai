export type Note = {
	id: string;
	text: string | null;
	reply: any | null;
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
