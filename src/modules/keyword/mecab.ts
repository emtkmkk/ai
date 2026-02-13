/**
 * @packageDocumentation
 *
 * MeCab ラッパー
 *
 * MeCab（形態素解析エンジン）をサブプロセスとして実行し、
 * テキストを形態素に分解して結果を返す。
 *
 * @remarks
 * NOTE: MeCab のインストールパスと辞書パスは config.json で指定する。
 * NOTE: カスタム辞書（`-u` オプション）にも対応している。
 *
 * @public
 */
import { spawn } from 'child_process';
import * as util from 'util';
import * as stream from 'stream';
import * as memoryStreams from 'memory-streams';
import { EOL } from 'os';

const pipeline = util.promisify(stream.pipeline);

/**
 * MeCab による形態素解析を実行する
 *
 * @remarks
 * テキスト内の改行・空白・タブはスペースに置換してから解析する。
 * 結果は各形態素が `[表層形, 品詞, 品詞細分類1, 品詞細分類2, ..., 読み]` の配列となる。
 *
 * @param text - 解析対象のテキスト
 * @param mecab - MeCab 実行ファイルのパス（デフォルト: 'mecab'）
 * @param dic - MeCab 辞書ディレクトリのパス
 * @param custom - カスタムユーザー辞書のパス
 * @returns 形態素解析結果の二次元配列
 * @public
 */
export async function mecab(text: string, mecab = 'mecab', dic?: string, custom?: string): Promise<string[][]> {
	const args: string[] = [];
	if (dic) args.push('-d', dic);
	if (custom) args.push('-u', custom);

	const lines = await cmd(mecab, args, `${text.replace(/[\n\s\t]/g, ' ')}\n`);

	const results: string[][] = [];

	for (const line of lines) {
		if (line === 'EOS') break;
		// MeCab の出力形式: 表層形\t品詞,品詞細分類1,...,読み
		const [word, value = ''] = line.split('\t');
		const array = value.split(',');
		array.unshift(word);
		results.push(array);
	}

	return results;
}

/**
 * 外部コマンドを実行し、標準出力を行分割で返す
 *
 * @param command - 実行するコマンド
 * @param args - コマンドライン引数
 * @param stdin - 標準入力に渡す文字列
 * @returns 標準出力を行分割した配列
 * @internal
 */
export async function cmd(command: string, args: string[], stdin: string): Promise<string[]> {
	const mecab = spawn(command, args);

	const writable = new memoryStreams.WritableStream();

	mecab.stdin.write(stdin);
	mecab.stdin.end();

	await pipeline(mecab.stdout, writable);

	return writable.toString().split(EOL);
}
