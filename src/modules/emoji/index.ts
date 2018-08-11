import 藍 from '../../ai';
import IModule from '../../module';
import MessageLike from '../../message-like';
import serifs from '../../serifs';

const hands = [
	'👏',
	'👍',
	'👎',
	'👊',
	'✊',
	['🤛', '🤜'],
	['🤜', '🤛'],
	'🤞',
	'✌',
	'🤟',
	'🤘',
	'👌',
	'👈',
	'👉',
	['👈', '👉'],
	['👉', '👈'],
	'👆',
	'👇',
	'☝',
	['✋', '🤚'],
	'🖐',
	'🖖',
	'👋',
	'🤙',
	'💪',
	'🖕'
]

const faces = [
	'😀',
	'😃',
	'😄',
	'😁',
	'😆',
	'😅',
	'😂',
	'🤣',
	'☺️',
	'😊',
	'😇',
	'🙂',
	'🙃',
	'😉',
	'😌',
	'😍',
	'😘',
	'😗',
	'😙',
	'😚',
	'😋',
	'😛',
	'😝',
	'😜',
	'🤪',
	'🤨',
	'🧐',
	'🤓',
	'😎',
	'🤩',
	'😏',
	'😒',
	'😞',
	'😔',
	'😟',
	'😕',
	'🙁',
	'☹️',
	'😣',
	'😖',
	'😫',
	'😩',
	'😢',
	'😭',
	'😤',
	'😠',
	'😡',
	'🤬',
	'🤯',
	'😳',
	'😱',
	'😨',
	'😰',
	'😥',
	'😓',
	'🤗',
	'🤔',
	'🤭',
	'🤫',
	'🤥',
	'😶',
	'😐',
	'😑',
	'😬',
	'🙄',
	'😯',
	'😦',
	'😧',
	'😮',
	'😲',
	'😴',
	'🤤',
	'😪',
	'😵',
	'🤐',
	'🤢',
	'🤮',
	'🤧',
	'😷',
	'🤒',
	'🤕',
	'🤑',
	'🤠'
]

export default class EmojiModule implements IModule {
	public install = (ai: 藍) => { }

	public onMention = (msg: MessageLike) => {
		if (msg.text && msg.text.includes('絵文字')) {
			const hand = hands[Math.floor(Math.random() * hands.length)];
			const face = faces[Math.floor(Math.random() * faces.length)];
			const emoji = Array.isArray(hand) ? hand[0] + face + hand[1] : hand + face + hand;
			msg.reply(serifs.EMOJI_SUGGEST.replace('$', emoji));
			return true;
		} else {
			return false;
		}
	}
}
