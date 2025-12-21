import Friend from '@/friend';
import type 藍 from '@/ai';
import type { User } from '@/misskey/user';
import includes from '@/utils/includes';
import or from '@/utils/or';

export default class WebRpgMessage {
        public readonly id: string;
        public readonly user: User;
        public readonly quoteId: string | null = null;
        public readonly replyId: string | null = null;
        public readonly replyNote: any = null;
        public readonly visibility = 'specified';
        public readonly localOnly = false;
        public readonly friend: Friend;

        private readonly replies: string[] = [];

        public get userId(): string {
                return this.user.id;
        }

        public get text(): string {
                return this.rawText;
        }

        public get extractedText(): string {
                return this.rawText.trim();
        }

        private readonly rawText: string;
        private readonly ai: 藍;

        constructor(ai: 藍, user: User, text: string) {
                this.ai = ai;
                this.user = user;
                this.rawText = text;
                this.id = `web-${Date.now()}`;
                this.friend = new Friend(this.ai, { user: this.user });
        }

        public includes(words: string[]): boolean {
                return includes(this.extractedText, words);
        }

        public or(words: (string | RegExp)[]): boolean {
                return or(this.extractedText, words);
        }

        public async reply(text: string | null): Promise<void> {
                if (text == null) return;
                this.replies.push(text);
        }

        public getReplies(): string[] {
                return this.replies;
        }
}
