export type User = {
	id: string;
	name: string;
	username: string;
	host?: string | null;
	isFollowing?: boolean;
	isRenoteMuted?: boolean;
	isBot: boolean;
	notesCount?: number;
	alsoKnownAs?: any;
};
