export type User = {
	id: string;
	name: string;
	username: string;
	host?: string | null;
        isFollowing?: boolean;
        isFollowed?: boolean;
        isRenoteMuted?: boolean;
        isBlocking?: boolean;
        isBot: boolean;
        notesCount?: number;
	alsoKnownAs?: any;
};
