import autobind from 'autobind-decorator';
import Module from '@/module';
import Message from '@/message';
import serifs from '@/serifs';
import seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary';

export const blessing = [
  '阨吉',
  '不吉',
  '吉凶相央',
  '吉凶相半',
  '吉凶未分末大吉',
  '吉凶不分末吉',
  '吉凶相交未吉',
  '小凶後吉',
  '凶後大吉',
  '凶後吉',
  '始凶末吉',
  '後吉',
  '天地渾沌兆',
  '平',
  '吉凶末分',
  '向大吉',
  '向吉',
  '福福福',
  '幸',
  '卯吉',
  '申吉',
  '大大吉',
  '大大中',
  '大吉',
  '中吉',
  '中中吉',
  '吉',
  '吉吉吉',
  '半吉',
  '小吉',
  '小小吉',
  '末吉',
  '末末吉',
  '末末末',
  '末小吉',
  '凶',
  '小凶',
  '半凶',
  '末凶',
  '大凶',
  '大大凶',
];

interface TarotCard {
  name: string;
  upright: {
    keywords: string[];
    meaning: string;
    advice: string;
  };
  reversed: {
    keywords: string[];
    meaning: string;
    advice: string;
  };
}

const tarotDeck: TarotCard[] = [
  {
    name: '愚者',
    upright: {
      keywords: ['新しい始まり', '冒険', '無邪気さ'],
      meaning:
        '新しい旅の始まりを示唆しているのじゃ。未知の可能性に満ちた冒険が待っているのじゃ。',
      advice:
        '恐れずに一歩を踏み出すとよいようじゃ！新しい経験から多くを学べるかもしれないのじゃ！',
    },
    reversed: {
      keywords: ['無謀', '軽率', 'リスク'],
      meaning: '行動の前に十分な準備や考慮が必要かもしれないのじゃ。',
      advice:
        '慎重に計画を立て、リスクを評価してから行動に移すとよいようじゃ！',
    },
  },
  {
    name: '魔術師',
    upright: {
      keywords: ['創造性', '熟練', '自信'],
      meaning:
        'そなたの中に眠る才能や能力が目覚める時期なのじゃ。自信を持って自分の技術を発揮するとよいようじゃ！',
      advice:
        '自分の能力を信じて、創造的なアイデアを実現させるチャンスなのじゃ。',
    },
    reversed: {
      keywords: ['未熟', '自己欺瞞', '才能の無駄遣い'],
      meaning:
        '自分の能力を過大評価したり、逆に過小評価したりしている可能性があるのじゃ。',
      advice:
        '自己評価を見直して、真の能力を冷静に分析するとよいようじゃ！必要なスキルを磨くことも大切なのじゃ。',
    },
  },
  {
    name: '女教皇',
    upright: {
      keywords: ['直感', '内なる知恵', '精神性'],
      meaning:
        '内なる声に耳を傾け、直感を信じるべき時期なのじゃ。深い洞察力が得られるかもしれないのじゃ！',
      advice:
        '瞑想や内省の時間を持って、自分の内なる知恵にアクセスするとよいようじゃ！',
    },
    reversed: {
      keywords: ['秘密', '抑圧された感情', '誤った直感'],
      meaning:
        '重要な情報が隠されているか、自分の感情を無視している可能性があるのじゃ。',
      advice:
        '自分の感情に正直になり、隠された真実を探る努力をするとよいようじゃ！',
    },
  },
  {
    name: '女帝',
    upright: {
      keywords: ['豊かさ', '創造性', '母性'],
      meaning:
        '豊かさと創造性に恵まれた時期なのじゃ。自然との調和や、育むことの喜びを感じられるかもしれないのじゃ！',
      advice:
        '自分の創造力を発揮して、周りの人々や環境を大切に育んでいくとよいようじゃ。',
    },
    reversed: {
      keywords: ['依存', '過保護', '創造力の欠如'],
      meaning: '過度の依存や、創造性の停滞に陥っている可能性があるのじゃ。',
      advice:
        '自立心を養い、新しいアイデアや方法を積極的に取り入れる努力をするとよいようじゃ！',
    },
  },
  {
    name: '皇帝',
    upright: {
      keywords: ['権威', 'リーダーシップ', '秩序'],
      meaning:
        'リーダーシップを発揮して、状況をコントロールする力があるのじゃ。秩序と安定をもたらす時期なのじゃ。',
      advice:
        '自信を持って決断を下して、計画的に目標に向かって進むとよいようじゃ。',
    },
    reversed: {
      keywords: ['独裁', '柔軟性の欠如', '過度の支配'],
      meaning:
        '権力の乱用や、過度に厳格な態度によって問題が生じる可能性があるのじゃ。',
      advice:
        '柔軟性を持って、他者の意見にも耳を傾ける姿勢が必要なのじゃ。バランスの取れたリーダーシップを心がけるとよいようじゃ。',
    },
  },
  {
    name: '法王',
    upright: {
      keywords: ['伝統', '宗教', '教育'],
      meaning:
        '伝統や規範に従うことが重要な時期なのじゃ。教育や精神的な成長が促進されるのじゃ。',
      advice:
        '伝統や規範を尊重して、学びを深めることに集中するとよいようじゃ！',
    },
    reversed: {
      keywords: ['独断', '反抗', '非伝統'],
      meaning: '伝統や規範に反抗する気持ちが強くなっているかもしれないのじゃ。',
      advice:
        '独自の道を模索することも大切なのじゃが、バランスを保つことを忘れないようにするとよいようじゃ！',
    },
  },
  {
    name: '恋人',
    upright: {
      keywords: ['愛', '調和', '選択'],
      meaning:
        '愛や調和がテーマとなる時期なのじゃ。重要な選択を迫られることもあるかもしれないのじゃ！',
      advice: '心の声に従い、愛と調和を大切にした選択をするとよいようじゃ！',
    },
    reversed: {
      keywords: ['不和', '関係の問題', '決断の難しさ'],
      meaning: '関係の問題や、決断の難しさに直面している可能性があるのじゃ。',
      advice:
        '冷静に状況を見つめ、誠実なコミュニケーションを心がけるとよいようじゃ。',
    },
  },
  {
    name: '戦車',
    upright: {
      keywords: ['勝利', '意志力', '決断'],
      meaning:
        '強い意志と決断力が求められる時期なのじゃ。勝利を手にするための行動が重要なのじゃ。',
      advice: '自信を持って前進して、目標に向かって突き進むとよいようじゃ。',
    },
    reversed: {
      keywords: ['挫折', '方向性の欠如', '失敗'],
      meaning: '目標に向かう途中で挫折や障害に直面する可能性があるのじゃ。',
      advice: '方向性を見直して、柔軟に対応することが求められるのじゃ。',
    },
  },
  {
    name: '力',
    upright: {
      keywords: ['勇気', '忍耐', '内なる力'],
      meaning:
        '内なる力と勇気が試される時期なのじゃ。忍耐強く取り組むことで成功が得られるのじゃ。',
      advice: '自分の内なる力を信じ、困難に立ち向かうとよいようじゃ。',
    },
    reversed: {
      keywords: ['弱さ', '疑念', '自己不信'],
      meaning: '自己不信や疑念が強くなっているかもしれないのじゃ。',
      advice:
        '自分を信じることが大切なのじゃ。内なる力を再確認するとよいようじゃ！',
    },
  },
  {
    name: '隠者',
    upright: {
      keywords: ['内省', '孤独', '探求'],
      meaning:
        '内省と自己探求の時期なのじゃ。孤独を恐れず、内なる声に耳を傾けるとよいようじゃ。',
      advice: '一人の時間を大切にして、自己探求を深めるとよいようじゃ。',
    },
    reversed: {
      keywords: ['孤立', '引きこもり', '無目的'],
      meaning: '孤立感や無目的な状態に陥っている可能性があるのじゃ。',
      advice:
        '他者とのつながりを大切にして、目的を持って行動するとよいようじゃ！',
    },
  },
  {
    name: '運命の輪',
    upright: {
      keywords: ['運命', '変化', '転機'],
      meaning:
        '運命の大きな変化や転機が訪れる時期なのじゃ。新たなチャンスが開かれるのじゃ。',
      advice: '変化を受け入れ、運命の流れに身を任せるとよいようじゃ。',
    },
    reversed: {
      keywords: ['不運', '変化の拒否', '停滞'],
      meaning: '変化を拒否することで、不運や停滞に陥る可能性があるのじゃ。',
      advice: '変化を恐れず、柔軟に対応することが重要なのじゃ。',
    },
  },
  {
    name: '正義',
    upright: {
      keywords: ['公平', '真実', '責任'],
      meaning:
        '公平さと真実が求められる時期なのじゃ。責任を持って行動するとよいようじゃ！',
      advice: '公正な判断を心がけ、真実を追求するとよいようじゃ！',
    },
    reversed: {
      keywords: ['不公平', '偏見', '不正'],
      meaning: '不公平や偏見、不正に直面する可能性があるのじゃ。',
      advice: '公正さを取り戻すために、正しい行動を心がけるとよいようじゃ。',
    },
  },
  {
    name: '吊るされた男',
    upright: {
      keywords: ['犠牲', '視点の転換', '受容'],
      meaning:
        '視点を転換して、状況を受け入れることが求められる時期なのじゃ。犠牲が必要な場合もあるのじゃ。',
      advice: '柔軟な視点を持って、状況を受け入れる準備をするとよいようじゃ！',
    },
    reversed: {
      keywords: ['自己犠牲', '無駄な努力', '停滞'],
      meaning: '自己犠牲や無駄な努力に陥っている可能性があるのじゃ。',
      advice:
        '無駄な努力を避け、効率的に行動する方法を見つけるとよいようじゃ。',
    },
  },
  {
    name: '死神',
    upright: {
      keywords: ['終わり', '変容', '新たな始まり'],
      meaning:
        '何かの終わりと新たな始まりを示唆しているのじゃ。変容の時期なのじゃ。',
      advice:
        '古いものを手放して、新しいものを受け入れる準備をするとよいようじゃ！',
    },
    reversed: {
      keywords: ['抵抗', '停滞', '変化の拒否'],
      meaning: '変化に抵抗することで、停滞に陥る可能性があるのじゃ。',
      advice: '変化を恐れず、柔軟に対応することが重要なのじゃ。',
    },
  },
  {
    name: '節制',
    upright: {
      keywords: ['調和', '節度', 'バランス'],
      meaning:
        '調和とバランスが求められる時期なのじゃ。節度を持った行動が重要なのじゃ。',
      advice: 'バランスを保ち、調和を大切にするとよいようじゃ！',
    },
    reversed: {
      keywords: ['不均衡', '過剰', '無節制'],
      meaning: '不均衡や過剰、無節制に陥っている可能性があるのじゃ。',
      advice: '節度を持って、バランスを取り戻す努力をするとよいようじゃ！',
    },
  },
  {
    name: '悪魔',
    upright: {
      keywords: ['誘惑', '束縛', '物質主義'],
      meaning: '誘惑や束縛、物質主義に囚われる危険性があるのじゃ。',
      advice:
        '自分の欲望を見つめ直して、自由を取り戻す努力をするとよいようじゃ！',
    },
    reversed: {
      keywords: ['解放', '独立', '回復'],
      meaning: '束縛からの解放や、独立、回復を示唆しているのじゃ。',
      advice:
        '自分を束縛しているものから解放され、新たな自由を手に入れるとよいようじゃ。',
    },
  },
  {
    name: '塔',
    upright: {
      keywords: ['崩壊', '突然の変化', '啓示'],
      meaning:
        '突然の変化や崩壊が訪れる時期なのじゃ。新たな啓示が得られるかもしれないのじゃ！',
      advice: '変化を受け入れ、新しい視点を持つとよいようじゃ。',
    },
    reversed: {
      keywords: ['災難の回避', '恐れ', '抵抗'],
      meaning:
        '災難を回避しようとすることで、恐れや抵抗が生じる可能性があるのじゃ。',
      advice: '恐れずに変化を受け入れ、前向きに対応するとよいようじゃ！',
    },
  },
  {
    name: '星',
    upright: {
      keywords: ['希望', '癒し', 'インスピレーション'],
      meaning:
        '希望と癒しがテーマとなる時期なのじゃ。新たなインスピレーションが得られるかもしれないのじゃ！',
      advice: '希望を持って、癒しの時間を大切にするとよいようじゃ！',
    },
    reversed: {
      keywords: ['絶望', '失望', '無気力'],
      meaning: '絶望や失望、無気力に陥る可能性があるのじゃ。',
      advice:
        '希望を取り戻して、前向きな気持ちを持つ努力をするとよいようじゃ！',
    },
  },
  {
    name: '月',
    upright: {
      keywords: ['幻影', '直感', '潜在意識'],
      meaning:
        '幻影や直感、潜在意識がテーマとなる時期なのじゃ。内なる声に耳を傾けるとよいようじゃ。',
      advice: '直感を信じ、潜在意識にアクセスする時間を持つとよいようじゃ。',
    },
    reversed: {
      keywords: ['混乱', '恐れ', '欺瞞'],
      meaning: '混乱や恐れ、欺瞞に直面する可能性があるのじゃ。',
      advice: '冷静に状況を見つめ、真実を見極める努力をするとよいようじゃ！',
    },
  },
  {
    name: '太陽',
    upright: {
      keywords: ['成功', '喜び', '活力'],
      meaning:
        '成功と喜び、活力がテーマとなる時期なのじゃ。ポジティブなエネルギーが満ちているのじゃ。',
      advice:
        '成功を喜び、ポジティブなエネルギーを周りに広げるとよいようじゃ。',
    },
    reversed: {
      keywords: ['失敗', '落胆', 'エゴ'],
      meaning: '失敗や落胆、エゴに直面する可能性があるのじゃ。',
      advice:
        '謙虚な姿勢を持って、失敗から学ぶことを大切にするとよいようじゃ！',
    },
  },
  {
    name: '審判',
    upright: {
      keywords: ['再生', '決断', '目覚め'],
      meaning:
        '再生と決断、目覚めがテーマとなる時期なのじゃ。新たな始まりが訪れるのじゃ。',
      advice: '過去を振り返り、再生のチャンスを受け入れるとよいようじゃ。',
    },
    reversed: {
      keywords: ['自己批判', '拒絶', '後悔'],
      meaning: '自己批判や拒絶、後悔に陥る可能性があるのじゃ。',
      advice: '自己批判をやめ、前向きな決断を下す努力をするとよいようじゃ！',
    },
  },
  {
    name: '世界',
    upright: {
      keywords: ['完成', '達成', '統合'],
      meaning:
        '完成と達成、統合がテーマとなる時期なのじゃ。目標が達成され、新たなステージが始まるのじゃ。',
      advice: '達成感を味わい、新たな目標に向かって進むとよいようじゃ。',
    },
    reversed: {
      keywords: ['未完成', '閉塞感', '遅延'],
      meaning: '未完成や閉塞感、遅延に直面する可能性があるのじゃ。',
      advice: '焦らずに、計画を見直して、前進する努力を続けるとよいようじゃ。',
    },
  },
  {
    name: 'ソードのエース',
    upright: {
      keywords: ['勝利', '新しいアイデア', '明晰さ'],
      meaning:
        '新しい始まりやアイデアの誕生を示唆しているのじゃ。明晰な思考が成功をもたらすのじゃ。',
      advice:
        '新しいアイデアを積極的に追求し、明確な目標を持って行動するとよいぞ。',
    },
    reversed: {
      keywords: ['混乱', '誤解', '失敗'],
      meaning:
        '混乱や誤解が生じる可能性があるのじゃ。計画がうまく進まないかもしれないのじゃ。',
      advice:
        '冷静に状況を見直し、誤解を解くためのコミュニケーションを心がけるとよいぞ。',
    },
  },
  {
    name: 'ソードの2',
    upright: {
      keywords: ['決断', 'バランス', '平和'],
      meaning:
        '重要な決断を下す必要があることを示しているのじゃ。バランスを保つことが鍵なのじゃ。',
      advice: '冷静に状況を見極め、感情に流されずに決断を下すとよいぞ。',
    },
    reversed: {
      keywords: ['優柔不断', '対立', '混乱'],
      meaning:
        '決断を先延ばしにすることで、対立や混乱が生じる可能性があるのじゃ。',
      advice: '早急に決断を下し、問題を解決するための行動を起こすとよいぞ。',
    },
  },
  {
    name: 'ソードの3',
    upright: {
      keywords: ['悲しみ', '心痛', '別れ'],
      meaning:
        '心の痛みや悲しみを示しているのじゃ。別れや失望があるかもしれないのじゃ。',
      advice: '感情を受け入れ、時間をかけて癒されることを許すとよいぞ。',
    },
    reversed: {
      keywords: ['回復', '許し', '希望'],
      meaning:
        '心の痛みからの回復を示しているのじゃ。許しと希望が見えてくるのじゃ。',
      advice: '過去を手放し、前向きに未来を見据えるとよいぞ。',
    },
  },
  {
    name: 'ソードの4',
    upright: {
      keywords: ['休息', '回復', '瞑想'],
      meaning: '休息と回復の時期を示しているのじゃ。内省と瞑想が必要なのじゃ。',
      advice: 'しっかりと休息を取り、心と体をリフレッシュさせるとよいぞ。',
    },
    reversed: {
      keywords: ['不安', 'ストレス', '休息不足'],
      meaning:
        '休息不足やストレスが溜まっていることを示しているのじゃ。不安が増しているかもしれないのじゃ。',
      advice: '積極的に休息を取り、ストレスを軽減する方法を見つけるとよいぞ。',
    },
  },
  {
    name: 'ソードの5',
    upright: {
      keywords: ['対立', '敗北', '策略'],
      meaning:
        '対立や敗北を示しているのじゃ。策略や裏切りがあるかもしれないのじゃ。',
      advice: '対立を避け、公正な方法で問題を解決するよう努めるとよいぞ。',
    },
    reversed: {
      keywords: ['和解', '後悔', '赦し'],
      meaning:
        '和解や後悔を示しているのじゃ。過去の過ちを赦し、新たなスタートを切る時なのじゃ。',
      advice: '過去を手放し、和解を目指すとよいぞ。',
    },
  },
  {
    name: 'ソードの6',
    upright: {
      keywords: ['移動', '変化', '癒し'],
      meaning:
        '移動や変化の時期を示しているのじゃ。癒しと新しい始まりが待っているのじゃ。',
      advice: '変化を受け入れ、新しい環境に適応する努力をするとよいぞ。',
    },
    reversed: {
      keywords: ['停滞', '困難', '逃避'],
      meaning:
        '変化が停滞し、困難な状況が続くことを示しているのじゃ。逃避したくなるかもしれないのじゃ。',
      advice: '困難に立ち向かい、前進するための計画を立てるとよいぞ。',
    },
  },
  {
    name: 'ソードの7',
    upright: {
      keywords: ['策略', '裏切り', '秘密'],
      meaning:
        '策略や裏切り、秘密を示しているのじゃ。慎重な行動が求められるのじゃ。',
      advice: '秘密を守り、信頼できる人とだけ情報を共有するとよいぞ。',
    },
    reversed: {
      keywords: ['暴露', '後悔', '誠実'],
      meaning:
        '秘密が暴露される可能性があるのじゃ。後悔や誠実さが求められるのじゃ。',
      advice: '誠実に行動し、過去の過ちを正す努力をするとよいぞ。',
    },
  },
  {
    name: 'ソードの8',
    upright: {
      keywords: ['束縛', '制約', '恐怖'],
      meaning:
        '束縛や制約を示しているのじゃ。恐怖や不安が行動を制限しているかもしれないのじゃ。',
      advice: '恐怖を乗り越え、自由を取り戻すための行動を起こすとよいぞ。',
    },
    reversed: {
      keywords: ['解放', '自由', '新しい視点'],
      meaning: '束縛からの解放を示しているのじゃ。新しい視点が得られるのじゃ。',
      advice: '自由を享受し、新しい視点で物事を見つめるとよいぞ。',
    },
  },
  {
    name: 'ソードの9',
    upright: {
      keywords: ['不安', '悪夢', '後悔'],
      meaning:
        '不安や悪夢、後悔を示しているのじゃ。精神的な苦痛があるかもしれないのじゃ。',
      advice: '不安を解消するために、信頼できる人に相談するとよいぞ。',
    },
    reversed: {
      keywords: ['回復', '希望', '安堵'],
      meaning: '精神的な回復と希望を示しているのじゃ。安堵感が得られるのじゃ。',
      advice: '希望を持って、前向きな考え方を心がけるとよいぞ。',
    },
  },
  {
    name: 'ソードの10',
    upright: {
      keywords: ['終わり', '破滅', '再生'],
      meaning:
        '終わりや破滅を示しているのじゃが、新しい再生の始まりでもあるのじゃ。',
      advice: '過去を手放し、新しいスタートを切るための準備をするとよいぞ。',
    },
    reversed: {
      keywords: ['回復', '再生', '希望'],
      meaning:
        '破滅からの回復と再生を示しているのじゃ。希望が見えてくるのじゃ。',
      advice: '過去の傷を癒し、新しい未来に向けて前進するとよいぞ。',
    },
  },
  {
    name: 'ソードのペイジ',
    upright: {
      keywords: ['警戒', '知識', '洞察'],
      meaning:
        '警戒心と知識、洞察力を示しているのじゃ。新しい情報を得る時期なのじゃ。',
      advice: '警戒心を持ちつつ、新しい知識を積極的に吸収するとよいぞ。',
    },
    reversed: {
      keywords: ['不信', '誤解', '準備不足'],
      meaning:
        '不信や誤解、準備不足を示しているのじゃ。計画がうまく進まないかもしれないのじゃ。',
      advice: '計画を見直し、準備を整えてから行動するとよいぞ。',
    },
  },
  {
    name: 'ソードのナイト',
    upright: {
      keywords: ['行動', '決断', '勇気'],
      meaning:
        '迅速な行動と決断、勇気を示しているのじゃ。積極的に行動する時期なのじゃ。',
      advice: '勇気を持って行動し、迅速に決断を下すとよいぞ。',
    },
    reversed: {
      keywords: ['衝動', '混乱', '無謀'],
      meaning:
        '衝動的な行動や混乱、無謀さを示しているのじゃ。慎重さが求められるのじゃ。',
      advice: '冷静に状況を見極め、慎重に行動するとよいぞ。',
    },
  },
  {
    name: 'ソードのクイーン',
    upright: {
      keywords: ['知恵', '独立', '公平'],
      meaning:
        '知恵と独立、公平さを示しているのじゃ。冷静な判断が求められるのじゃ。',
      advice: '冷静に状況を分析し、公平な判断を下すとよいぞ。',
    },
    reversed: {
      keywords: ['冷酷', '孤立', '偏見'],
      meaning:
        '冷酷さや孤立、偏見を示しているのじゃ。感情が冷え切っているかもしれないのじゃ。',
      advice: '感情を大切にし、人との関係を築く努力をするとよいぞ。',
    },
  },
  {
    name: 'ソードのキング',
    upright: {
      keywords: ['権威', '知識', '判断力'],
      meaning:
        '権威と知識、判断力を示しているのじゃ。リーダーシップが求められるのじゃ。',
      advice: '知識を活かし、リーダーシップを発揮して問題を解決するとよいぞ。',
    },
    reversed: {
      keywords: ['独裁', '冷酷', '誤った判断'],
      meaning:
        '独裁的な行動や冷酷さ、誤った判断を示しているのじゃ。権力の乱用に注意が必要なのじゃ。',
      advice: '権力を乱用せず、公正な判断を心がけるとよいぞ。',
    },
  },
  {
    name: 'カップのエース',
    upright: {
      keywords: ['愛', '新しい感情', '創造性'],
      meaning:
        '新しい感情や愛の始まりを示しているのじゃ。創造性が高まる時期なのじゃ。',
      advice: '心を開き、新しい感情や愛を受け入れるとよいぞ。',
    },
    reversed: {
      keywords: ['失望', '感情の抑制', '停滞'],
      meaning:
        '感情の抑制や失望を示しているのじゃ。感情が停滞しているかもしれないのじゃ。',
      advice: '感情を解放し、心のバランスを取り戻すとよいぞ。',
    },
  },
  {
    name: 'カップの2',
    upright: {
      keywords: ['パートナーシップ', '調和', '愛'],
      meaning: '調和の取れたパートナーシップや愛の関係を示しているのじゃ。',
      advice: '信頼と理解を大切にし、関係を深めるとよいぞ。',
    },
    reversed: {
      keywords: ['不和', '誤解', '分離'],
      meaning:
        '不和や誤解、分離を示しているのじゃ。関係が揺らいでいるかもしれないのじゃ。',
      advice: '誠実なコミュニケーションを心がけ、誤解を解くとよいぞ。',
    },
  },
  {
    name: 'カップの3',
    upright: {
      keywords: ['友情', '祝福', 'コミュニティ'],
      meaning: '友情や祝福、コミュニティの強さを示しているのじゃ。',
      advice: '友人やコミュニティとの絆を深め、共に祝福すとよいぞ。',
    },
    reversed: {
      keywords: ['孤立', '誤解', '過剰'],
      meaning:
        '孤立や誤解、過剰な行動を示しているのじゃ。バランスを失っているかもしれないのじゃ。',
      advice: 'バランスを取り戻し、他者との関係を見直すとよいぞ。',
    },
  },
  {
    name: 'カップの4',
    upright: {
      keywords: ['退屈', '無関心', '内省'],
      meaning: '退屈や無関心、内省の時期を示しているのじゃ。',
      advice: '内省し、自分の感情や欲望を見つめ直すとよいぞ。',
    },
    reversed: {
      keywords: ['新しい機会', '興奮', '変化'],
      meaning:
        '新しい機会や興奮、変化を示しているのじゃ。新たな視点が得られるでしょう。',
      advice: '新しい機会を受け入れ、積極的に行動するとよいぞ。',
    },
  },
  {
    name: 'カップの5',
    upright: {
      keywords: ['失望', '悲しみ', '後悔'],
      meaning:
        '失望や悲しみ、後悔を示しているのじゃ。過去の出来事に囚われているかもしれないのじゃ。',
      advice: '過去を手放し、前向きな未来を見据えるとよいぞ。',
    },
    reversed: {
      keywords: ['回復', '希望', '新しい始まり'],
      meaning: '回復と希望、新しい始まりを示しているのじゃ。',
      advice: '希望を持ち、新しい始まりに向けて前進するとよいぞ。',
    },
  },
  {
    name: 'カップの6',
    upright: {
      keywords: ['過去', '懐かしさ', '思い出'],
      meaning:
        '過去や懐かしさ、思い出を示しているのじゃ。過去の出来事が再び浮上するかもしれないのじゃ。',
      advice: '過去を振り返り、学びを得て前進するとよいぞ。',
    },
    reversed: {
      keywords: ['執着', '過去のトラウマ', '停滞'],
      meaning: '過去への執着やトラウマ、停滞を示しているのじゃ。',
      advice: '過去を手放し、未来に向けて進むとよいぞ。',
    },
  },
  {
    name: 'カップの7',
    upright: {
      keywords: ['幻想', '選択', '夢'],
      meaning:
        '幻想や選択、夢を示しているのじゃ。多くの選択肢がある時期なのじゃ。',
      advice: '現実を見据え、慎重に選択するとよいぞ。',
    },
    reversed: {
      keywords: ['混乱', '現実逃避', '不確実'],
      meaning: '混乱や現実逃避、不確実な状況を示しているのじゃ。',
      advice: '現実に目を向け、確実な道を選ぶとよいぞ。',
    },
  },
  {
    name: 'カップの8',
    upright: {
      keywords: ['放棄', '旅立ち', '変化'],
      meaning:
        '放棄や旅立ち、変化を示しているのじゃ。新しい道を選ぶ時期なのじゃ。',
      advice: '過去を手放し、新しい冒険に挑戦するとよいぞ。',
    },
    reversed: {
      keywords: ['停滞', '迷い', '恐れ'],
      meaning:
        '停滞や迷い、恐れを示しているのじゃ。変化を恐れているかもしれないのじゃ。',
      advice: '恐れを乗り越え、前進するための行動を起こすとよいぞ。',
    },
  },
  {
    name: 'カップの9',
    upright: {
      keywords: ['満足', '願望成就', '幸福'],
      meaning:
        '満足や願望成就、幸福を示しているのじゃ。願いが叶う時期なのじゃ。',
      advice: '自分の努力を認め、達成感を味わうとよいぞ。',
    },
    reversed: {
      keywords: ['不満', '過剰', '自己中心'],
      meaning: '不満や過剰、自己中心的な行動を示しているのじゃ。',
      advice: '感謝の気持ちを持ち、他者との調和を大切にするとよいぞ。',
    },
  },
  {
    name: 'カップの10',
    upright: {
      keywords: ['幸福', '調和', '家族'],
      meaning:
        '幸福や調和、家族の絆を示しているのじゃ。満ち足りた時期なのじゃ。',
      advice: '家族や愛する人との時間を大切にし、絆を深めるとよいぞ。',
    },
    reversed: {
      keywords: ['不和', '不満', '分裂'],
      meaning:
        '不和や不満、分裂を示しているのじゃ。家庭内の問題が浮上するかもしれないのじゃ。',
      advice: '誠実なコミュニケーションを心がけ、問題を解決すとよいぞ。',
    },
  },
  {
    name: 'カップのペイジ',
    upright: {
      keywords: ['創造性', '直感', '新しい感情'],
      meaning:
        '創造性や直感、新しい感情を示しているのじゃ。新しいアイデアが生まれる時期なのじゃ。',
      advice: '直感を信じ、新しいアイデアを追求すとよいぞ。',
    },
    reversed: {
      keywords: ['未熟', '感情の抑制', '混乱'],
      meaning: '未熟さや感情の抑制、混乱を示しているのじゃ。',
      advice: '感情を整理し、冷静に行動すとよいぞ。',
    },
  },
  {
    name: 'カップのナイト',
    upright: {
      keywords: ['ロマンス', '提案', '感情'],
      meaning:
        'ロマンスや提案、感情の高まりを示しているのじゃ。愛の告白や提案があるかもしれないのじゃ。',
      advice: '感情を大切にし、愛を表現すとよいぞ。',
    },
    reversed: {
      keywords: ['感情の乱れ', '不安定', '幻滅'],
      meaning: '感情の乱れや不安定、幻滅を示しているのじゃ。',
      advice: '冷静さを保ち、感情のバランスを取り戻すとよいぞ。',
    },
  },
  {
    name: 'カップのクイーン',
    upright: {
      keywords: ['共感', '直感', '感情'],
      meaning:
        '共感や直感、感情の豊かさを示しているのじゃ。感情的な理解が求められるのじゃ。',
      advice: '直感を信じ、他者に共感すとよいぞ。',
    },
    reversed: {
      keywords: ['感情の抑制', '依存', '過敏'],
      meaning: '感情の抑制や依存、過敏さを示しているのじゃ。',
      advice: '感情を整理し、冷静に対処すとよいぞ。',
    },
  },
  {
    name: 'カップのキング',
    upright: {
      keywords: ['感情の安定', '知恵', '共感'],
      meaning:
        '感情の安定や知恵、共感を示しているのじゃ。リーダーシップが求められるのじゃ。',
      advice: '感情をコントロールし、知恵を持って行動すとよいぞ。',
    },
    reversed: {
      keywords: ['感情の乱れ', '冷酷', '誤った判断'],
      meaning: '感情の乱れや冷酷さ、誤った判断を示しているのじゃ。',
      advice: '感情を整理し、公正な判断を心がけるとよいぞ。',
    },
  },
  {
    name: 'ペンタクルのエース',
    upright: {
      keywords: ['繁栄', '新しい始まり', '物質的成功'],
      meaning:
        '物質的な成功や繁栄、新しい始まりを示しているのじゃ。新しい機会が訪れるでしょう。',
      advice: '新しい機会を積極的に受け入れ、努力を続けるとよいのじゃ。',
    },
    reversed: {
      keywords: ['損失', '機会の喪失', '不安定'],
      meaning: '損失や機会の喪失、不安定な状況を示しているのじゃ。',
      advice: '慎重に行動し、リスクを評価するとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの2',
    upright: {
      keywords: ['バランス', '柔軟性', '調整'],
      meaning: 'バランスと柔軟性、調整が求められる時期を示しているのじゃ。',
      advice: '柔軟な姿勢で状況に対応し、バランスを保つとよいのじゃ。',
    },
    reversed: {
      keywords: ['不均衡', '混乱', '優柔不断'],
      meaning: '不均衡や混乱、優柔不断な状況を示しているのじゃ。',
      advice: '優先順位を見直し、バランスを取り戻す努力をするとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの3',
    upright: {
      keywords: ['協力', 'チームワーク', 'スキル'],
      meaning: '協力やチームワーク、スキルの向上を示しているのじゃ。',
      advice: 'チームで協力し、スキルを磨くとよいのじゃ。',
    },
    reversed: {
      keywords: ['協力不足', '誤解', '未熟'],
      meaning: '協力不足や誤解、未熟な状況を示しているのじゃ。',
      advice:
        'コミュニケーションを改善し、スキルを向上させる努力をするとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの4',
    upright: {
      keywords: ['安定', '節約', '保護'],
      meaning:
        '安定や節約、保護を示しているのじゃ。物質的な安全を確保する時期なのじゃ。',
      advice: '資産を守り、無駄遣いを避けるとよいのじゃ。',
    },
    reversed: {
      keywords: ['執着', 'ケチ', '不安'],
      meaning:
        '執着やケチ、不安を示しているのじゃ。物質的な面での不安があるかもしれないのじゃ。',
      advice: '柔軟な考え方を持ち、執着を手放するとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの5',
    upright: {
      keywords: ['困難', '損失', '貧困'],
      meaning:
        '困難や損失、貧困を示しているのじゃ。厳しい状況に直面するかもしれないのじゃ。',
      advice: '助けを求め、支援を受け入れるとよいのじゃ。',
    },
    reversed: {
      keywords: ['回復', '希望', '支援'],
      meaning: '困難からの回復や希望、支援を示しているのじゃ。',
      advice: '希望を持ち、支援を受け入れて前進するとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの6',
    upright: {
      keywords: ['寛大', '援助', 'バランス'],
      meaning:
        '寛大さや援助、バランスを示しているのじゃ。与えることの重要性が強調されているのじゃ。',
      advice: '他者に寛大に接し、助けを必要とする人を支援するとよいのじゃ。',
    },
    reversed: {
      keywords: ['不公平', '搾取', '依存'],
      meaning:
        '不公平や搾取、依存を示しているのじゃ。バランスが崩れているかもしれないのじゃ。',
      advice: '公平さを心がけ、依存を避けるとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの7',
    upright: {
      keywords: ['忍耐', '評価', '成長'],
      meaning:
        '忍耐や評価、成長を示しているのじゃ。努力の成果を評価する時期なのじゃ。',
      advice: '忍耐強く努力を続け、成果を評価するとよいのじゃ。',
    },
    reversed: {
      keywords: ['焦り', '無駄', '失望'],
      meaning:
        '焦りや無駄、失望を示しているのじゃ。努力が報われないと感じるかもしれないのじゃ。',
      advice: '焦らずに努力を続け、長期的な視点を持つとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの8',
    upright: {
      keywords: ['勤勉', 'スキル', '努力'],
      meaning:
        '勤勉さやスキル、努力を示しているのじゃ。スキルを磨く時期なのじゃ。',
      advice: '努力を惜しまず、スキルを向上させるとよいのじゃ。',
    },
    reversed: {
      keywords: ['怠惰', '未熟', '不満'],
      meaning:
        '怠惰や未熟、不満を示しているのじゃ。努力が不足しているかもしれないのじゃ。',
      advice: '努力を惜しまず、スキルを向上させる努力をするとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの9',
    upright: {
      keywords: ['独立', '成功', '満足'],
      meaning:
        '独立や成功、満足を示しているのじゃ。努力が実を結ぶ時期なのじゃ。',
      advice: '自分の努力を認め、達成感を味わうよいのじゃ。',
    },
    reversed: {
      keywords: ['依存', '不満', '失敗'],
      meaning:
        '依存や不満、失敗を示しているのじゃ。自立が求められる時期なのじゃ。',
      advice: '自立を目指し、努力を続けるとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルの10',
    upright: {
      keywords: ['繁栄', '家族', '伝統'],
      meaning:
        '繁栄や家族、伝統を示しているのじゃ。物質的な成功と家族の絆が強調されているのじゃ。',
      advice: '家族や伝統を大切にし、繁栄を共有するとよいのじゃ。',
    },
    reversed: {
      keywords: ['不和', '損失', '分裂'],
      meaning:
        '不和や損失、分裂を示しているのじゃ。家族内の問題が浮上するかもしれないのじゃ。',
      advice: '誠実なコミュニケーションを心がけ、問題を解決するとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルのペイジ',
    upright: {
      keywords: ['学び', '計画', '潜在能力'],
      meaning:
        '学びや計画、潜在能力を示しているのじゃ。新しいスキルを学ぶ時期なのじゃ。',
      advice: '学びを深め、計画を立てて行動するとよいのじゃ。',
    },
    reversed: {
      keywords: ['無計画', '怠惰', '未熟'],
      meaning:
        '無計画や怠惰、未熟を示しているのじゃ。計画が不足しているかもしれないのじゃ。',
      advice: '計画を立て、努力を惜しまずに行動するとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルのナイト',
    upright: {
      keywords: ['勤勉', '信頼', '実行力'],
      meaning:
        '勤勉さや信頼、実行力を示しているのじゃ。着実に目標に向かって進む時期なのじゃ。',
      advice: '信頼を大切にし、着実に行動するとよいのじゃ。',
    },
    reversed: {
      keywords: ['怠惰', '不信', '停滞'],
      meaning:
        '怠惰や不信、停滞を示しているのじゃ。行動が停滞しているかもしれないのじゃ。',
      advice: '怠けずに行動し、信頼を築くとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルのクイーン',
    upright: {
      keywords: ['実務能力', '豊かさ', '独立'],
      meaning:
        '実務能力や豊かさ、独立を示しているのじゃ。物質的な成功が強調されているのじゃ。',
      advice: '実務能力を発揮し、豊かさを享受するとよいのじゃ。',
    },
    reversed: {
      keywords: ['不安', '依存', '浪費'],
      meaning:
        '不安や依存、浪費を示しているのじゃ。物質的な面での不安があるかもしれないのじゃ。',
      advice: '浪費を避け、実務能力を発揮するとよいのじゃ。',
    },
  },
  {
    name: 'ペンタクルのキング',
    upright: {
      keywords: ['成功', '権威', '安定'],
      meaning:
        '成功や権威、安定を示しているのじゃ。リーダーシップが求められるのじゃ。',
      advice: '成功を享受し、リーダーシップを発揮するとよいのじゃ。',
    },
    reversed: {
      keywords: ['独裁', '冷酷', '誤った判断'],
      meaning:
        '独裁的な行動や冷酷さ、誤った判断を示しているのじゃ。権力の乱用に注意が必要なのじゃ。',
      advice: '権力を乱用せず、公正な判断を心がけるとよいのじゃ。',
    },
  },
  {
    name: 'ワンドのエース',
    upright: {
      keywords: ['新しい始まり', '情熱', '創造性'],
      meaning:
        '新しい始まりや情熱、創造性を示しているのじゃ。新しいプロジェクトが成功する兆しなのじゃ。',
      advice: '情熱を持って新しい挑戦に取り組むとよいのじゃ。',
    },
    reversed: {
      keywords: ['遅延', '挫折', '無気力'],
      meaning:
        '遅延や挫折、無気力を示しているのじゃ。計画が思うように進まないかもしれないのじゃ。',
      advice: '計画を見直し、再度情熱を取り戻す努力をするとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの2',
    upright: {
      keywords: ['計画', '決断', '未来'],
      meaning:
        '計画や決断、未来を見据える時期を示しているのじゃ。新しい方向性を見つける時なのじゃ。',
      advice: '未来を見据えて計画を立て、決断を下するとよいのじゃ。',
    },
    reversed: {
      keywords: ['不安', '優柔不断', '停滞'],
      meaning:
        '不安や優柔不断、停滞を示しているのじゃ。決断に迷いが生じているかもしれないのじゃ。',
      advice: '冷静に状況を見極め、決断を下す勇気を持つとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの3',
    upright: {
      keywords: ['冒険', '拡大', '成長'],
      meaning:
        '冒険や拡大、成長を示しているのじゃ。新しいチャンスが広がる時期なのじゃ。',
      advice: '積極的に行動し、新しいチャンスを掴むとよいのじゃ。',
    },
    reversed: {
      keywords: ['停滞', '失望', '計画の見直し'],
      meaning:
        '停滞や失望、計画の見直しを示しているのじゃ。計画が思うように進まないかもしれないのじゃ。',
      advice: '計画を見直し、再度挑戦する準備をするとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの4',
    upright: {
      keywords: ['祝福', '安定', '達成'],
      meaning:
        '祝福や安定、達成を示しているのじゃ。努力が実を結ぶ時期なのじゃ。',
      advice: '達成感を味わい、成果を祝福するとよいのじゃ。',
    },
    reversed: {
      keywords: ['不安定', '遅延', '未達成'],
      meaning:
        '不安定や遅延、未達成を示しているのじゃ。計画が思うように進まないかもしれないのじゃ。',
      advice: '冷静に状況を見極め、計画を再評価するとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの5',
    upright: {
      keywords: ['競争', '対立', '挑戦'],
      meaning:
        '競争や対立、挑戦を示しているのじゃ。競争が激化する時期なのじゃ。',
      advice: '競争を恐れず、挑戦を続けるとよいのじゃ。',
    },
    reversed: {
      keywords: ['協力', '解決', '和解'],
      meaning:
        '協力や解決、和解を示しているのじゃ。対立が解消される兆しなのじゃ。',
      advice: '協力を求め、問題を解決するとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの6',
    upright: {
      keywords: ['勝利', '成功', '認知'],
      meaning:
        '勝利や成功、認知を示しているのじゃ。努力が評価される時期なのじゃ。',
      advice: '成功を享受し、次の目標に向けて準備するとよいのじゃ。',
    },
    reversed: {
      keywords: ['失敗', '無視', '挫折'],
      meaning:
        '失敗や無視、挫折を示しているのじゃ。努力が報われないかもしれないのじゃ。',
      advice: '失敗を恐れず、再度挑戦するとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの7',
    upright: {
      keywords: ['防御', '挑戦', '勇気'],
      meaning:
        '防御や挑戦、勇気を示しているのじゃ。困難に立ち向かう時期なのじゃ。',
      advice: '勇気を持って困難に立ち向かうよいのじゃ。',
    },
    reversed: {
      keywords: ['降伏', '脆弱', '逃避'],
      meaning:
        '降伏や脆弱、逃避を示しているのじゃ。困難に立ち向かう勇気が欠けているかもしれないのじゃ。',
      advice: '勇気を持ち、逃げずに立ち向かうよいのじゃ。',
    },
  },
  {
    name: 'ワンドの8',
    upright: {
      keywords: ['迅速', '進展', 'コミュニケーション'],
      meaning:
        '迅速な進展やコミュニケーションを示しているのじゃ。物事が急速に進む時期なのじゃ。',
      advice: '迅速に行動し、コミュニケーションを大切にするとよいのじゃ。',
    },
    reversed: {
      keywords: ['遅延', '混乱', '停滞'],
      meaning:
        '遅延や混乱、停滞を示しているのじゃ。計画が思うように進まないかもしれないのじゃ。',
      advice: '冷静に状況を見極め、計画を再評価するとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの9',
    upright: {
      keywords: ['防御', '忍耐', '準備'],
      meaning: '防御や忍耐、準備を示しているのじゃ。困難に備える時期なのじゃ。',
      advice: '忍耐強く準備を続け、困難に備えましょう。',
    },
    reversed: {
      keywords: ['疲労', '不信', '放棄'],
      meaning:
        '疲労や不信、放棄を示しているのじゃ。困難に立ち向かう気力が欠けているかもしれないのじゃ。',
      advice: '休息を取り、再度挑戦する準備をするとよいのじゃ。',
    },
  },
  {
    name: 'ワンドの10',
    upright: {
      keywords: ['重荷', '責任', '達成'],
      meaning:
        '重荷や責任、達成を示しているのじゃ。大きな責任を背負う時期なのじゃ。',
      advice: '責任を引き受け、達成感を味わうよいのじゃ。',
    },
    reversed: {
      keywords: ['過労', '負担', '解放'],
      meaning:
        '過労や負担、解放を示しているのじゃ。重荷が過剰になっているかもしれないのじゃ。',
      advice: '負担を軽減し、休息を取るとよいのじゃ。',
    },
  },
  {
    name: 'ワンドのペイジ',
    upright: {
      keywords: ['冒険', '創造性', '情熱'],
      meaning:
        '冒険や創造性、情熱を示しているのじゃ。新しい挑戦が待っているのじゃ。',
      advice: '情熱を持って新しい挑戦に取り組むとよいのじゃ。',
    },
    reversed: {
      keywords: ['未熟', '無計画', '混乱'],
      meaning:
        '未熟さや無計画、混乱を示しているのじゃ。計画が不足しているかもしれないのじゃ。',
      advice: '計画を立て、冷静に行動するとよいのじゃ。',
    },
  },
  {
    name: 'ワンドのナイト',
    upright: {
      keywords: ['行動', '冒険', '情熱'],
      meaning:
        '行動や冒険、情熱を示しているのじゃ。積極的に行動する時期なのじゃ。',
      advice: '情熱を持って行動し、新しい冒険に挑戦するとよいのじゃ。',
    },
    reversed: {
      keywords: ['衝動', '無謀', '停滞'],
      meaning:
        '衝動的な行動や無謀、停滞を示しているのじゃ。計画が不足しているかもしれないのじゃ。',
      advice: '冷静に状況を見極め、慎重に行動するとよいのじゃ。',
    },
  },
  {
    name: 'ワンドのクイーン',
    upright: {
      keywords: ['情熱', '独立', '自信'],
      meaning:
        '情熱や独立、自信を示しているのじゃ。自信を持って行動する時期なのじゃ。',
      advice: '自信を持って行動し、情熱を持って目標を追求するとよいのじゃ。',
    },
    reversed: {
      keywords: ['不安', '依存', '自己中心'],
      meaning:
        '不安や依存、自己中心的な行動を示しているのじゃ。自信が欠けているかもしれないのじゃ。',
      advice: '自信を取り戻し、他者との調和を大切にするとよいのじゃ。',
    },
  },
  {
    name: 'ワンドのキング',
    upright: {
      keywords: ['リーダーシップ', '情熱', 'ビジョン'],
      meaning:
        'リーダーシップや情熱、ビジョンを示しているのじゃ。周囲を引っ張る力が求められるのじゃ。',
      advice:
        'リーダーシップを発揮し、情熱を持って目標を達成するとよいのじゃ。',
    },
    reversed: {
      keywords: ['独裁', '冷酷', '誤った判断'],
      meaning:
        '独裁的な行動や冷酷さ、誤った判断を示しているのじゃ。権力の乱用に注意が必要なのじゃ。',
      advice: '権力を乱用せず、公正な判断を心がけるとよいのじゃ。',
    },
  },
];

export default class extends Module {
  public readonly name = 'divination';

  @autobind
  public install() {
    return {
      mentionHook: this.mentionHook,
    };
  }

  @autobind
  private async mentionHook(msg: Message) {
    if (msg.includes(['占', 'うらな', '運勢'])) {
      msg.reply(serifs.choice.prompt, {
        cw: '占いの選択',
      });
      this.subscribeReply(
        'divinationChoice:' + msg.userId,
        'handleChoiceReply',
      );
      return true;
    } else if (msg.includes(['おみくじ'])) {
      return this.handleFortune(msg);
    } else if (msg.includes(['タロット', 'ワンオラクル'])) {
      return this.handleTarot(msg);
    } else if (msg.includes(['スリーオラクル', 'スリーカード'])) {
      return this.handleThreeOracle(msg);
    } else {
      return false;
    }
  }

  @autobind
  private async handleChoiceReply(msg: Message) {
    if (msg.text.includes('おみくじ')) {
      return this.handleFortune(msg);
    } else if (msg.text.includes('ワンオラクル')) {
      return this.handleTarot(msg);
    } else if (msg.text.includes('タロット')) {
      return this.handleTarot(msg);
    } else if (msg.text.includes('スリーオラクル')) {
      return this.handleThreeOracle(msg);
    } else {
      msg.reply(serifs.choice.prompt, {
        cw: '占いの選択',
      });
      return true;
    }
  }

  private async handleFortune(msg: Message) {
    const date = new Date();
    const seed = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}@${msg.userId}`;
    const rng = seedrandom(seed);
    const omikuji = blessing[Math.floor(rng() * blessing.length)];
    const item = genItem(rng);
    msg.reply(`**${omikuji}🎉**\nラッキーアイテム: ${item}`, {
      cw: serifs.fortune.cw(msg.friend.name),
    });
    return true;
  }

  private async handleTarot(msg: Message) {
    const rng = seedrandom(new Date().toISOString());
    const card = this.drawTarotCard(rng);
    const isUpright = rng() < 0.5;

    const position = isUpright ? '正位置' : '逆位置';
    const cardInfo = isUpright ? card.upright : card.reversed;

    const message = `
そなたが引いたカードは **${card.name} - ${position}** なのじゃ。

キーワード: ${cardInfo.keywords.join(', ')}

意味: ${cardInfo.meaning}

アドバイス: ${cardInfo.advice}

占いは占いの後の行動が大事なのじゃ！悪い結果でも行動次第で良いことが起きるのじゃ！
そなたに良いことが起こるようわらわは願っておるぞ！
    `.trim();

    msg.reply(message, {
      cw: serifs.tarot.cw(msg.friend.name),
    });
    return true;
  }

  private async handleThreeOracle(msg: Message) {
    const date = new Date();
    const seed = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}@${msg.userId}`;
    const rng = seedrandom(seed);
    const cards = this.drawThreeUniqueTarotCards(rng);

    const positions = ['過去', '現在', '未来'];
    const results = cards
      .map((card, index) => {
        const isUpright = rng() < 0.5;
        const position = isUpright ? '正位置' : '逆位置';
        const cardInfo = isUpright ? card.upright : card.reversed;

        return `
**${positions[index]}**
カード: **${card.name} - ${position}**
キーワード: ${cardInfo.keywords.join(', ')}
意味: ${cardInfo.meaning}
${index !== 0 ? `アドバイス: ${cardInfo.advice}` : ''}
      `.trim();
      })
      .join('\n\n');

    const message = `
そなたが引いたカードは以下の通りじゃ。
スリーオラクルは過去、現在、未来のカードの組み合わせで読み取る占いなのじゃ。
過去：質問に対する原因、今の状況に至った状況
現在：今の状況、今できること
未来：質問に対する未来がどうなるか、解決方法など
を表すとされているのじゃ。

${results}

占いは占いの後の行動が大事なのじゃ！悪い結果でも行動次第で良いことが起きるのじゃ！
そなたに良いことが起こるようわらわは願っておるぞ！
   `.trim();

    msg.reply(message, {
      cw: serifs.tarot.cw(msg.friend.name),
    });
    return true;
  }

  private drawTarotCard(rng: () => number): TarotCard {
    const cardIndex = Math.floor(rng() * tarotDeck.length);
    return tarotDeck[cardIndex];
  }

  private drawThreeUniqueTarotCards(rng: () => number): TarotCard[] {
    const drawnCards: TarotCard[] = [];
    while (drawnCards.length < 3) {
      const card = this.drawTarotCard(rng);
      if (!drawnCards.some((drawnCard) => drawnCard.name === card.name)) {
        drawnCards.push(card);
      }
    }
    return drawnCards;
  }
}
