import Router = require('@koa/router');
import Koa = require('koa');
import jsonBody = require('koa-json-body');
import request = require('request-promise-native');
import { v4 as uuidv4 } from 'uuid';

import config from '@/config';
import type 藍 from '@/ai';
import type { User } from '@/misskey/user';
import type { FriendDoc } from '@/friend';
import type { Raid } from './raid';
import type RpgModule from './index';
import WebRpgMessage from './web-message';

type SessionData = {
        user: User;
        token: string;
        expiresAt: number;
};

type RpgStatus = FriendDoc['perModulesData']['rpg'];

export default class RpgWebServer {
        private readonly app: Koa;
        private readonly router: Router;
        private readonly sessions = new Map<string, SessionData>();
        private readonly pendingLogins = new Set<string>();
        private readonly sessionCookie = 'rpg_web_session';

        constructor(private readonly ai: 藍, private readonly rpg: RpgModule) {
                this.app = new Koa();
                this.router = new Router();

                this.app.use(jsonBody());
                this.router.get('/', this.renderPage);
                this.router.get('/login', this.startLogin);
                this.router.get('/miauth/callback', this.finishLogin);
                this.router.post('/rpg/command', this.handleCommand);
                this.app.use(this.router.routes());
                this.app.use(this.router.allowedMethods());
        }

        public listen(): void {
                const port = config.rpgWebPort ?? 3030;
                this.app.listen(port, () => {
                        this.rpg.log(`RPG Webインターフェースをポート${port}で起動しました`);
                });
        }

        private renderPage = (ctx: Router.RouterContext) => {
                const session = this.getSession(ctx);

                if (!session) {
                        this.renderLoginPage(ctx);
                        return;
                }

                const friend = this.rpg.findFriendDoc(session.user.id);
                const rpgStatus: RpgStatus | undefined = friend?.perModulesData?.rpg;

                if (!rpgStatus) {
                        this.renderNoDataPage(ctx, session.user);
                        return;
                }

                const activeRaid = this.rpg.getActiveRaid();
                this.renderMainPage(ctx, session.user, rpgStatus, activeRaid);
        };

        private startLogin = (ctx: Router.RouterContext) => {
                const miAuthSession = uuidv4();
                this.pendingLogins.add(miAuthSession);

                const callback = `${ctx.origin}/miauth/callback`;
                const permission = encodeURIComponent('read:account');
                const loginUrl = `${config.host}/miauth/${miAuthSession}?name=${encodeURIComponent('moko-rpg-web')}&callback=${encodeURIComponent(callback)}&permission=${permission}`;

                ctx.status = 302;
                ctx.redirect(loginUrl);
        };

        private finishLogin = async (ctx: Router.RouterContext): Promise<void> => {
                const miAuthSession = String(ctx.query.session ?? '');

                if (!miAuthSession || !this.pendingLogins.has(miAuthSession)) {
                        ctx.status = 400;
                        ctx.body = '不正なログイン要求です。';
                        return;
                }

                this.pendingLogins.delete(miAuthSession);

                try {
                        const result = await request.post({
                                url: `${config.host}/api/miauth/${miAuthSession}/check`,
                                json: true,
                        });

                        if (!result?.ok || !result.token || !result.user) {
                                ctx.status = 401;
                                ctx.body = 'Misskeyの認証に失敗しました。時間をおいて再度お試しください。';
                                return;
                        }

                        const sessionId = uuidv4();
                        const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
                        this.sessions.set(sessionId, { user: result.user as User, token: String(result.token), expiresAt });
                        ctx.cookies.set(this.sessionCookie, sessionId, {
                                httpOnly: true,
                                sameSite: 'lax',
                                expires: new Date(expiresAt),
                        });

                        ctx.redirect('/');
                } catch (error) {
                        this.rpg.log(`MiAuthチェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
                        ctx.status = 500;
                        ctx.body = 'ログイン処理中にエラーが発生しました。';
                }
        };

        private renderLoginPage(ctx: Router.RouterContext) {
                ctx.type = 'text/html; charset=utf-8';
                ctx.body = `<!doctype html>
<html lang="ja">
<head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>もこチキRPG Web ログイン</title>
        <style>
                body { font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; margin: 2rem; line-height: 1.6; }
                main { max-width: 780px; margin: 0 auto; }
                .panel { background: #f9fbff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
                h1 { margin-top: 0; }
                .actions { margin-top: 1.5rem; }
                .button { display: inline-block; padding: 0.9rem 1.6rem; background: #4a90e2; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; }
                .button:hover { background: #3a78c4; }
        </style>
</head>
<body>
        <main>
                <div class="panel">
                        <h1>Misskeyでログイン</h1>
                        <p>もこチキRPGのWeb版を利用するには、Misskeyアカウントでのログインが必要です。</p>
                        <div class="actions">
                                <a class="button" href="/login">Misskeyでログイン</a>
                        </div>
                </div>
        </main>
</body>
</html>`;
        }

        private renderNoDataPage(ctx: Router.RouterContext, user: User) {
                ctx.type = 'text/html; charset=utf-8';
                ctx.body = `<!doctype html>
<html lang="ja">
<head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>もこチキRPG Web</title>
        <style>
                body { font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; margin: 2rem; line-height: 1.6; }
                main { max-width: 820px; margin: 0 auto; }
                .panel { background: #fffaf5; border: 1px solid #f5d6b4; border-radius: 12px; padding: 1.5rem; }
                .actions { margin-top: 1rem; }
                .button { display: inline-block; padding: 0.9rem 1.6rem; background: #4a90e2; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; }
                .button.secondary { background: #666; }
        </style>
</head>
<body>
        <main>
                <div class="panel">
                        <h1>プレイデータが見つかりません</h1>
                        <p>${this.escapeHtml(String(user.name ?? user.username ?? ''))} でログインしていますが、RPGのプレイデータが見つかりませんでした。</p>
                        <p>Misskey上で「rpg」と話しかけて遊び始めると、ここにデータが表示されるようになります。</p>
                        <div class="actions">
                                <a class="button" href="/">再読み込み</a>
                        </div>
                </div>
        </main>
</body>
</html>`;
        }

        private renderMainPage(ctx: Router.RouterContext, user: User, rpgStatus: RpgStatus, raid: Raid | undefined) {
                const commands = [
                        { label: '冒険する', command: 'rpg' },
                        { label: 'ヘルプを読む', command: 'rpg help' },
                        { label: '持ち物を見る', command: 'rpg items' },
                        { label: 'スキル確認', command: 'rpg skill' },
                ];

                const raidInfo = raid
                        ? `<div class="raid">
                                        <div class="raid-title">${this.escapeHtml(raid.enemy.name)}</div>
                                        <div class="raid-meta">参加者 ${raid.attackers.length} / 開始 ${new Date(raid.startedAt).toLocaleString()}</div>
                                </div>`
                        : '<p class="muted">現在開催中のレイドはありません。</p>';

                ctx.type = 'text/html; charset=utf-8';
                ctx.body = `<!doctype html>
<html lang="ja">
<head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>もこチキRPG Web</title>
        <style>
                body { font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; margin: 1.5rem; background: #f4f7fb; }
                main { max-width: 1024px; margin: 0 auto; display: grid; gap: 1.5rem; }
                h1 { margin: 0 0 0.5rem; }
                .welcome { color: #4a4a4a; margin-bottom: 1rem; }
                .panel { background: #fff; border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
                .panel h2 { margin-top: 0; }
                .commands { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
                .command-button { padding: 1rem; border: 1px solid #e1e7f0; border-radius: 10px; background: #f9fbff; cursor: pointer; font-size: 1rem; font-weight: 700; }
                .command-button:hover { background: #e8f1ff; }
                .raid { padding: 1rem; border-radius: 10px; border: 1px solid #e6e0ff; background: #f6f3ff; }
                .raid-title { font-weight: 700; font-size: 1.1rem; }
                .raid-meta { color: #555; margin-top: 0.35rem; font-size: 0.95rem; }
                .muted { color: #777; }
                .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; }
                .status-card { padding: 0.9rem; border: 1px solid #e1e7f0; border-radius: 10px; background: #fdfefe; }
                .status-label { color: #666; font-size: 0.9rem; }
                .status-value { font-size: 1.2rem; font-weight: 700; }
                form { margin-top: 1rem; }
                textarea { width: 100%; min-height: 80px; border-radius: 10px; border: 1px solid #d4dbe6; padding: 0.75rem; font-size: 1rem; }
                .submit { margin-top: 0.75rem; padding: 0.85rem 1.2rem; background: #4a90e2; color: #fff; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; }
                .submit:hover { background: #3a78c4; }
                .result { background: #fff; border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
                .result h2 { margin-top: 0; }
                .divider { margin: 1rem 0; border-top: 1px solid #e1e7f0; }
                .back { margin-top: 1rem; padding: 0.85rem 1.2rem; background: #666; color: #fff; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; }
        </style>
</head>
<body>
        <main>
                <section class="panel">
                        <h1>もこチキRPG</h1>
                        <p class="welcome">${this.escapeHtml(String(user.name ?? user.username ?? ''))} さん、ようこそ！</p>
                        <div class="commands" id="command-buttons">
                                ${commands.map((cmd) => `<button class="command-button" data-command="${this.escapeHtml(cmd.command)}">${this.escapeHtml(cmd.label)}</button>`).join('')}
                        </div>
                        <form id="custom-command">
                                <label for="text">自由入力</label>
                                <textarea id="text" name="text" placeholder="rpg ..."></textarea>
                                <button class="submit" type="submit">送信</button>
                        </form>
                </section>

                <section class="panel">
                        <h2>開催中のレイド（あれば）</h2>
                        ${raidInfo}
                </section>

                <section class="panel">
                        <h2>ステータス（RPGに関連する）</h2>
                        <div class="status-grid">
                                <div class="status-card"><div class="status-label">レベル</div><div class="status-value">${rpgStatus.lv ?? 1}</div></div>
                                <div class="status-card"><div class="status-label">攻撃</div><div class="status-value">${rpgStatus.atk ?? 0}</div></div>
                                <div class="status-card"><div class="status-label">防御</div><div class="status-value">${rpgStatus.def ?? 0}</div></div>
                                <div class="status-card"><div class="status-label">コイン</div><div class="status-value">${rpgStatus.coin ?? 0}</div></div>
                                ${Array.isArray(rpgStatus.skills) ? rpgStatus.skills.slice(0, 4).map((s: any) => `<div class="status-card"><div class="status-label">スキル</div><div class="status-value">${this.escapeHtml(String(s?.name ?? '???'))}</div></div>`).join('') : ''}
                        </div>
                </section>
        </main>

        <template id="result-template">
                <div class="result">
                        <h2 id="result-title"></h2>
                        <div id="result-body"></div>
                        <div class="divider"></div>
                        <button class="back" id="back-button">戻る</button>
                </div>
        </template>

        <script>
                const form = document.getElementById('custom-command');
                const buttons = document.querySelectorAll('[data-command]');
                const main = document.querySelector('main');
                const template = document.getElementById('result-template');

                async function sendCommand(text) {
                        const res = await fetch('/rpg/command', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text }),
                        });
                        if (!res.ok) {
                                const errText = await res.text();
                                throw new Error(errText || 'コマンドの送信に失敗しました');
                        }
                        return res.json();
                }

                function showResult(command, responses) {
                        const clone = template.content.cloneNode(true);
                        clone.getElementById('result-title').textContent = `「${command}」の結果`;
                        const body = clone.getElementById('result-body');
                        if (responses && responses.length) {
                                body.innerHTML = responses.map((r) => `<p>${r.replace(/\n/g, '<br>')}</p>`).join('<hr class="divider" />');
                        } else {
                                body.innerHTML = '<p class="muted">応答がありませんでした。</p>';
                        }
                        clone.getElementById('back-button').addEventListener('click', () => {
                                window.location.href = '/';
                        });
                        main.innerHTML = '';
                        main.appendChild(clone);
                }

                buttons.forEach((btn) => {
                        btn.addEventListener('click', async () => {
                                const command = btn.getAttribute('data-command');
                                if (!command) return;
                                try {
                                        const result = await sendCommand(command);
                                        showResult(command, result.responses);
                                } catch (err) {
                                        alert(err.message || err);
                                }
                        });
                });

                form.addEventListener('submit', async (event) => {
                        event.preventDefault();
                        const text = (document.getElementById('text')).value.trim();
                        if (!text) return;
                        try {
                                const result = await sendCommand(text);
                                showResult(text, result.responses);
                        } catch (err) {
                                alert(err.message || err);
                        }
                });
        </script>
</body>
</html>`;
        }

        private handleCommand = async (ctx: Router.RouterContext): Promise<void> => {
                const session = this.getSession(ctx);
                if (!session) {
                        ctx.status = 401;
                        ctx.body = 'ログインが必要です。';
                        return;
                }

                const friend = this.rpg.findFriendDoc(session.user.id);
                if (!friend?.perModulesData?.rpg) {
                        ctx.status = 403;
                        ctx.body = 'RPGのプレイデータが必要です。';
                        return;
                }

                const body = (ctx.request as any).body || {};
                const { text } = body;

                if (!text || typeof text !== 'string') {
                        ctx.status = 400;
                        ctx.body = { error: 'text は必須です。' };
                        return;
                }

                const message = new WebRpgMessage(this.ai, session.user, String(text));
                const responses = await this.rpg.handleWebCommand(message);

                ctx.body = { responses };
        };

        private getSession(ctx: Router.RouterContext): SessionData | undefined {
                const id = ctx.cookies.get(this.sessionCookie);
                if (!id) return undefined;

                const session = this.sessions.get(id);
                if (!session) return undefined;

                if (session.expiresAt < Date.now()) {
                        this.sessions.delete(id);
                        return undefined;
                }

                return session;
        }

        private escapeHtml(text: string): string {
                return text.replace(/[&<>'"]/g, (char) => {
                        switch (char) {
                                case '&':
                                        return '&amp;';
                                case '<':
                                        return '&lt;';
                                case '>':
                                        return '&gt;';
                                case "'":
                                        return '&#39;';
                                case '"':
                                        return '&quot;';
                                default:
                                        return char;
                        }
                });
        }
}
