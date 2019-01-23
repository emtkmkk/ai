import autobind from 'autobind-decorator';
import Module from '../../module';
import Message from '../../message';
import serifs from '../../serifs';

export default class extends Module {
	public readonly name = 'dice';

	@autobind
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@autobind
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;

		const query = msg.text.match(/([0-9]+)[dD]([0-9]+)/);

		if (query == null) return false;

		const times = parseInt(query[1], 10);
		const dice = parseInt(query[2], 10);

		if (times < 1 || times > 10) return false;
		if (dice < 2 || dice > 1000) return false;

		const results: number[] = [];

		for (let i = 0; i < times; i++) {
			results.push(Math.floor(Math.random() * dice) + 1);
		}

		msg.reply(serifs.dice.done(results.join(' ')));

		return true;
	}
}
