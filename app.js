// ===== Conversa de Pescador v2 =====
const app = document.getElementById('app');
const CATS = [...new Set(PERGUNTAS.map(p => p.cat))];
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

const S = {
  players: ld('cp_jogadores', []).map(n => ({ name: n, score: 0 })),
  cats: new Set(CATS), modo: 'meta', meta: 10, voltas: 1,
  som: ld('cp_som', true), deck: [], roundNo: 0, emJogo: false, desempate: false, r: null, tmp: [], off: 0
};

// ---------- utilidades ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const vib = p => navigator.vibrate && navigator.vibrate(p);
const salvar = () => localStorage.setItem('cp_jogadores', JSON.stringify(S.players.map(p => p.name)));
const outros = () => S.players.map((_, i) => i).filter(i => i !== S.r.guesser);
const nome = i => esc(S.players[i].name);
function render(h) { app.innerHTML = h; app.style.animation = 'none'; app.offsetHeight; app.style.animation = ''; scrollTo(0, 0); }
function toast(m) { const t = document.getElementById('toast'); t.innerHTML = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400); }

// ---------- sons (gerados, sem arquivos) ----------
let AC;
function tom(f, d = .12, tipo = 'sine', v = .2, atraso = 0) {
  if (!S.som) return;
  AC = AC || new (window.AudioContext || window.webkitAudioContext)();
  const t = AC.currentTime + atraso, o = AC.createOscillator(), g = AC.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d);
}
const SOM = {
  clique: () => tom(660, .06, 'triangle', .12),
  pronto: () => { tom(523, .1); tom(784, .15, 'sine', .2, .09); },
  ponto: () => { tom(880, .08, 'square', .1); tom(1320, .15, 'square', .1, .08); },
  erro: () => { tom(220, .3, 'sawtooth', .2); tom(150, .45, 'sawtooth', .2, .25); },
  sorteio: () => [0, 1, 2, 3, 4, 5].forEach(k => tom(400 + k * 90, .07, 'triangle', .12, k * .07)),
  bolha: () => { tom(300, .08); tom(600, .1, 'sine', .15, .06); },
  vitoria: () => [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tom(f, .25, 'triangle', .2, k * .15))
};
document.addEventListener('click', e => { if (e.target.closest('button')) SOM.clique(); });

// ---------- modal ----------
let mcb = null;
function modal(html, ok, cb, cancel = 'Cancelar', cls = '') {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="card">${html}<div class="col" style="margin-top:14px">
    ${ok ? `<button class="btn ${cls}" onclick="fechar(true)">${ok}</button>` : ''}
    ${cancel ? `<button class="btn ghost" onclick="fechar(false)">${cancel}</button>` : ''}</div></div>`;
  m.classList.remove('hidden'); mcb = cb;
}
function fechar(ok) { document.getElementById('modal').classList.add('hidden'); const c = mcb; mcb = null; if (ok && c) c(); }

// ---------- pontuação ----------
function dar(i, pts, motivo) {
  S.players[i].score += pts;
  S.r.ganhos[i] = (S.r.ganhos[i] || 0) + pts;
  toast(`+${pts} para ${nome(i)} ${motivo || ''}`);
}

function placarHTML(ganhos = {}) {
  const ord = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  const topo = Math.max(S.modo === 'meta' ? S.meta : 1, ...ord.map(p => p.score));
  const med = ['🥇', '🥈', '🥉'];
  return ord.map(p => {
    const pos = ord.findIndex(x => x.score === p.score);
    return `<div class="score"><div style="flex:1"><div>${p.score > 0 && med[pos] ? med[pos] : (pos + 1) + 'º'} ${esc(p.name)}
      ${ganhos[p.i] ? `<span class="ganho">+${ganhos[p.i]}</span>` : ''}</div>
      <div class="bar"><i style="width:${Math.min(100, p.score / topo * 100)}%"></i></div></div>
      <b style="font-size:1.3rem;margin-left:12px">${p.score}</b></div>`;
  }).join('');
}
const objetivo = () => S.desempate ? '⚔️ Rodada de desempate!' : S.modo === 'meta' ? `🎯 Primeiro a ${S.meta} pontos vence` : `🔁 Rodada ${Math.min(S.roundNo + 1, total())} de ${total()}`;
const total = () => S.players.length * S.voltas;

function verPlacar() { modal(`<h2>📊 Placar</h2><p class="tag">${objetivo()}</p>${placarHTML()}`, null, null, 'Fechar'); }

function barraTopo() {
  return `<div class="top">
    <button class="ic" onclick="verPlacar()">📊 Placar</button>
    <button class="ic" onclick="pular()">⏭️ Pular</button>
    <button class="ic" onclick="telaManual(true)">📖</button>
    <button class="ic" onclick="togSom()">${S.som ? '🔊' : '🔇'}</button>
    <button class="ic" onclick="encerrar()">⏹️ Fim</button></div>`;
}
function togSom() { S.som = !S.som; localStorage.setItem('cp_som', S.som); toast(S.som ? '🔊 Som ligado' : '🔇 Som desligado'); const b = [...document.querySelectorAll('.ic')].find(x => /🔊|🔇/.test(x.textContent)); if (b) b.textContent = S.som ? '🔊' : '🔇'; }

// ---------- telas iniciais ----------
function telaInicio() {
  render(`<div class="centro">
    <div class="big"><span class="bob">🎣</span></div>
    <h1>Conversa de<br>Pescador</h1>
    <p class="sub">O jogo de blefe onde só um fala a verdade 🐟</p>
    <div class="glass center" style="text-align:center">📚 ${PERGUNTAS.length} perguntas · ${CATS.length} categorias</div>
    <button class="btn" onclick="telaConfig()">🎮 Novo jogo</button>
    <button class="btn sec" onclick="telaManual()">📖 Manual de regras</button>
    <button class="btn sec" onclick="togSom();telaInicio()">${S.som ? '🔊 Som ligado' : '🔇 Som desligado'}</button>
  </div>`);
}

function telaManual(noJogo) {
  const html = `<div class="manual">
  <h2>📖 Manual de Regras</h2>
  <h3>🎯 Objetivo</h3>
  <p>Fazer mais pontos que todo mundo, seja <b>descobrindo mentirosos</b> quando você é o Pescador, seja <b>enganando o Pescador</b> quando não é.</p>
  <h3>👥 Os papéis (sorteados a cada rodada)</h3>
  <p>🎣 <b>Pescador:</b> o detetive da rodada. Fecha os olhos enquanto os outros preparam as respostas. Todos são Pescador em revezamento.</p>
  <p>💙 <b>Peixe Verdadeiro:</b> sorteado em segredo. Recebe a resposta certa da pergunta e precisa dizê-la, mesmo que pareça absurda.</p>
  <p>❤️ <b>Peixes Mentirosos:</b> todos os outros. Inventam uma resposta falsa e convincente, escolhendo uma sugestão do app ou escrevendo a própria.</p>
  <h3>🔄 Como é uma rodada</h3>
  <p><b>1.</b> O app mostra quem é o Pescador. Ele fecha os olhos.<br>
  <b>2.</b> Toquem em "Sortear funções". Aparece a pergunta e a lista de jogadores.<br>
  <b>3.</b> Quem já pensou no que dizer toca no próprio nome, pega o celular e vê seu papel em segredo.<br>
  <b>4.</b> Quando todos estiverem prontos, o Pescador abre os olhos e cada um lê sua resposta em voz alta.<br>
  <b>5.</b> O Pescador vai tocando em quem ele acha que está <b>mentindo</b>.</p>
  <h3>🏅 Pontuação</h3>
  <table>
  <tr><td>❌ Pescador acerta um mentiroso</td><td><b>+1 em jogo</b> para o Pescador. Ainda não está garantido!</td></tr>
  <tr><td>🪣 Pescador para e guarda</td><td>Pescador ganha os pontos em jogo. Cada mentiroso não pescado ganha <b>+1</b> por ter enganado.</td></tr>
  <tr><td>🏆 Pescou todos os mentirosos</td><td>Pescador ganha os pontos em jogo <b>+2 de bônus</b>.</td></tr>
  <tr><td>💥 Acusou o Verdadeiro</td><td>Pescador <b>perde</b> os pontos em jogo. Verdadeiro ganha <b>+2</b>. Mentirosos não pescados ganham <b>+1</b>.</td></tr>
  </table>
  <p>💡 <b>Exemplo:</b> 5 jogadores. Ana é Pescadora e pesca 2 mentirosos (2 em jogo). Se parar agora, ganha 2, e o mentiroso que sobrou ganha 1. Se arriscar e acertar o último, ganha 3 + 2 de bônus = 5. Se errar e acusar o Verdadeiro, fica com 0, o Verdadeiro ganha 2 e o mentiroso que sobrou ganha 1.</p>
  <h3>🏆 Como se vence</h3>
  <p><b>Modo Meta:</b> quem atingir a meta de pontos no fim de uma rodada vence.<br>
  <b>Modo Voltas:</b> cada um é Pescador o número de vezes escolhido. No fim, vence quem tiver mais pontos.<br>
  <b>Empate:</b> joga-se uma rodada de desempate até alguém ficar na frente.</p>
  <h3>🛠️ Botões durante o jogo</h3>
  <p>📊 <b>Placar:</b> mostra os pontos a qualquer momento.<br>⏭️ <b>Pular:</b> troca a pergunta, sem pontos, caso alguém já saiba a resposta ou ela seja ruim.<br>⏹️ <b>Fim:</b> encerra o jogo, e quem estiver na frente vence.</p>
  <h3>🤫 Dicas</h3>
  <p>Mentirosos: respostas absurdas às vezes enganam melhor, porque as verdades deste jogo são estranhas! Verdadeiro: tente parecer que está inventando 😏</p></div>`;
  if (noJogo) return modal(html, null, null, 'Fechar');
  render(`<div class="card">${html}</div><button class="btn" onclick="telaConfig()">Bora jogar!</button><button class="btn sec" onclick="telaInicio()">Voltar</button>`);
}

function telaConfig() {
  render(`<h2>👥 Jogadores</h2>
  <div class="card"><div class="row">
    <input id="nome" type="text" placeholder="Nome do jogador" maxlength="16" onkeydown="if(event.key==='Enter')addJ()">
    <button class="btn" style="width:auto;padding:0 20px" onclick="addJ()">＋</button></div>
    <ul class="plist" id="plist"></ul><small id="pmsg"></small></div>
  <h2>🏆 Como vencer</h2>
  <div class="card"><div class="chips" id="modo"></div><div class="chips" id="valor" style="margin-top:10px"></div><p id="desc" style="margin:8px 0 0"></p></div>
  <h2>📚 Categorias</h2>
  <div class="card"><div class="chips" id="chips"></div></div>
  <button class="btn" id="go" onclick="iniciar()">Começar 🎣</button>
  <button class="btn sec" onclick="telaInicio()">Voltar</button>`);
  desenhar();
}
function desenhar() {
  plist.innerHTML = S.players.map((p, i) => `<li><span>🐟 ${esc(p.name)}</span><button class="x" onclick="remJ(${i})">✕</button></li>`).join('');
  const f = 4 - S.players.length;
  pmsg.textContent = f > 0 ? `Faltam ${f} jogador(es). O mínimo é 4.` : `✅ ${S.players.length} jogadores prontos!`;
  modo.innerHTML = [['meta', '🎯 Meta de pontos'], ['voltas', '🔁 Número de voltas']].map(([k, t]) => `<button class="chip ${S.modo === k ? 'on' : ''}" onclick="S.modo='${k}';desenhar()">${t}</button>`).join('');
  valor.innerHTML = S.modo === 'meta'
    ? [5, 10, 15, 20].map(n => `<button class="chip ${S.meta === n ? 'on' : ''}" onclick="S.meta=${n};desenhar()">${n} pts</button>`).join('')
    : [1, 2, 3].map(n => `<button class="chip ${S.voltas === n ? 'on' : ''}" onclick="S.voltas=${n};desenhar()">${n}x cada</button>`).join('');
  desc.textContent = S.modo === 'meta' ? `Vence quem chegar a ${S.meta} pontos primeiro.` : `Cada um será Pescador ${S.voltas}x (${S.players.length * S.voltas} rodadas). Vence quem tiver mais pontos.`;
  chips.innerHTML = CATS.map((c, k) => `<button class="chip ${S.cats.has(c) ? 'on' : ''}" onclick="togCat(${k})">${c} (${PERGUNTAS.filter(p => p.cat === c).length})</button>`).join('');
  go.disabled = S.players.length < 4 || !S.cats.size;
}
function addJ() {
  const n = nome_inp(); if (!n) return;
  if (S.players.some(p => norm(p.name) === norm(n))) return toast('Esse nome já existe!');
  if (S.players.length >= 12) return toast('Máximo de 12 jogadores');
  S.players.push({ name: n, score: 0 }); SOM.bolha(); salvar(); desenhar(); document.getElementById('nome').focus();
}
function nome_inp() { const i = document.getElementById('nome'); const v = i.value.trim(); i.value = ''; return v; }
function remJ(i) { S.players.splice(i, 1); salvar(); desenhar(); }
function togCat(k) { const c = CATS[k]; S.cats.has(c) ? S.cats.delete(c) : S.cats.add(c); desenhar(); }

// ---------- fluxo ----------
function iniciar() {
  S.players.forEach(p => p.score = 0);
  S.deck = shuffle(PERGUNTAS.filter(p => S.cats.has(p.cat)));
  S.roundNo = 0; S.emJogo = true; S.desempate = false; salvar(); novaRodada();
}
function carta() { if (!S.deck.length) S.deck = shuffle(PERGUNTAS.filter(p => S.cats.has(p.cat))); return S.deck.pop(); }

function novaRodada(mesmo) {
  const g = mesmo ? S.r.guesser : S.roundNo % S.players.length;
  S.r = { guesser: g, kipper: null, q: carta(), answers: {}, ready: new Set(), revealed: new Set(), pending: 0, perdidos: 0, ordem: [], ganhos: {}, fim: null };
  telaVez();
}

function pular() {
  if (!S.r || S.r.fim) return toast('Nada para pular agora');
  modal('<div class="big">⏭️</div><h3 style="text-align:center">Pular esta rodada?</h3><p style="text-align:center">A pergunta é trocada, o mesmo Pescador continua e ninguém ganha nem perde pontos.</p>',
    'Pular', () => { toast('⏭️ Rodada pulada'); novaRodada(true); });
}

function encerrar() {
  modal('<div class="big">⏹️</div><h3 style="text-align:center">Encerrar o jogo agora?</h3><p style="text-align:center">Vence quem estiver com mais pontos.</p>', 'Encerrar e ver vencedor', () => telaFinal(true), 'Continuar jogando', 'red');
}

function telaVez() {
  const g = nome(S.r.guesser);
  render(`${barraTopo()}
  <div class="glass" style="text-align:center"><span class="tag">${objetivo()}</span></div>
  <div class="card" style="text-align:center">
    <div class="big"><span class="bob">🎣</span></div>
    <h2>${g} é o Pescador!</h2>
    <p><b>${g}</b>, feche os olhos ou vire de costas 🙈</p>
    <p>O resto do grupo: toquem em sortear para receber as funções secretas.</p></div>
  <button class="btn" onclick="sortear()">🎲 Sortear funções</button>`);
}

function sortear() {
  const o = outros(); S.r.kipper = o[Math.random() * o.length | 0];
  SOM.sorteio(); vib(60); telaLista();
}

function telaLista() {
  const r = S.r, o = outros(), p = r.ready.size;
  render(`${barraTopo()}
  <div class="card"><span class="tag">${esc(r.q.cat)}</span><p class="q">${esc(r.q.q)}</p><small>🙈 ${nome(r.guesser)} não pode olhar!</small></div>
  <h2>🐟 Quem já sabe o que dizer? ${p}/${o.length}</h2>
  <p class="sub" style="text-align:left">Toque no seu nome quando tiver uma ideia. Dá para tocar de novo para trocar.</p>
  ${o.map(i => `<button class="status ${r.ready.has(i) ? 'ok' : ''}" onclick="abrir(${i})"><span>${nome(i)}</span><span>${r.ready.has(i) ? '✅ Pronto' : '🤔 Pensando...'}</span></button>`).join('')}
  <button class="btn green" ${p < o.length ? 'disabled' : ''} onclick="telaChamar()">Todos prontos! Chamar o Pescador 🎣</button>`);
}

function abrir(i) {
  modal(`<div class="big">🤫</div><h3 style="text-align:center">Passe o celular para <b>${nome(i)}</b></h3><p style="text-align:center">Só ${nome(i)} pode ver a próxima tela!</p>`, `Sou ${nome(i)}, mostrar`, () => secreta(i));
}

function secreta(i) {
  const r = S.r;
  if (i === r.kipper) {
    render(`<div class="card azul" style="text-align:center"><div class="big">💙🐟</div>
      <h2>${nome(i)}, você é o<br>PEIXE VERDADEIRO!</h2><p class="q">${esc(r.q.q)}</p>
      <p>Diga esta resposta, que é a <b>verdadeira</b>:</p><div class="certa g">${esc(r.q.a)}</div>
      <small>Se o Pescador te acusar de mentir, você ganha +2 😏</small></div>
      <button class="btn blue" onclick="okVerdade(${i})">Entendi! Esconder ✅</button>`);
    return;
  }
  const usadas = new Set(Object.entries(r.answers).filter(([j]) => +j !== i).map(([, v]) => norm(v)));
  S.tmp = shuffle(r.q.f.filter(f => !usadas.has(norm(f)))); S.off = 0;
  const atual = r.answers[i] || '';
  render(`<div class="card vermelho"><div style="text-align:center"><div class="big">❤️🐟</div><h2>${nome(i)}, você é um<br>PEIXE MENTIROSO!</h2></div>
    <p>Invente uma resposta falsa e convincente para:</p><p class="q">${esc(r.q.q)}</p></div>
  <div class="card"><b>💡 Escolha uma sugestão:</b><div id="opts" style="margin-top:8px"></div>
    <b>✍️ ...ou escreva a sua:</b>
    <input id="minha" type="text" maxlength="70" placeholder="Sua mentira" value="${esc(atual)}" oninput="digitou()" style="margin-top:8px"></div>
  <button class="btn" id="conf" ${atual ? '' : 'disabled'} onclick="okMentira(${i})">Confirmar ✅</button>
  <button class="btn sec" onclick="telaLista()">Voltar</button>`);
  opts_();
}
function opts_() {
  const b = document.getElementById('opts'), av = S.tmp;
  if (!av.length) { b.innerHTML = '<p><small>Sem sugestões. Use a criatividade! 😉</small></p>'; return; }
  const val = norm(document.getElementById('minha').value);
  const vis = [...Array(Math.min(3, av.length)).keys()].map(k => (S.off + k) % av.length);
  b.innerHTML = vis.map(k => `<button class="opt ${norm(av[k]) === val ? 'sel' : ''}" onclick="escolher(${k})">${esc(av[k])}</button>`).join('')
    + (av.length > 3 ? `<button class="link" onclick="S.off=(S.off+3)%S.tmp.length;opts_()">🔄 Outras sugestões</button>` : '');
}
function escolher(k) { document.getElementById('minha').value = S.tmp[k]; digitou(); }
function digitou() { document.getElementById('conf').disabled = !document.getElementById('minha').value.trim(); opts_(); }
function okMentira(i) {
  const r = S.r, v = document.getElementById('minha').value.trim().replace(/\s+/g, ' ');
  if (norm(v) === norm(r.q.a)) return toast('😅 Essa é a resposta verdadeira! Invente outra.');
  if (Object.entries(r.answers).some(([j, a]) => +j !== i && norm(a) === norm(v))) return toast('Alguém já usou essa. Escolha outra!');
  r.answers[i] = v; r.ready.add(i); SOM.pronto(); vib(40); telaLista(); toast('🤐 Resposta guardada!');
}
function okVerdade(i) { S.r.answers[i] = S.r.q.a; S.r.ready.add(i); SOM.pronto(); vib(40); telaLista(); toast('🤐 Pronto!'); }

function telaChamar() {
  S.r.ordem = shuffle(outros()); SOM.bolha();
  render(`<div class="centro"><div class="big"><span class="bob">👀</span></div>
    <h1>${nome(S.r.guesser)}, abra os olhos!</h1><p class="sub">Cada um vai ler sua resposta em voz alta.</p>
    <button class="btn" onclick="telaPesca()">🎣 Começar a pescaria</button></div>`);
}

function telaPesca() {
  const r = S.r, rest = r.ordem.length - 1 - r.revealed.size;
  render(`${barraTopo()}
  <div class="card"><span class="tag">${esc(r.q.cat)}</span><p class="q">${esc(r.q.q)}</p>
    <small>🗣️ ${nome(r.guesser)}, toque em quem você acha que está <b>mentindo</b>.</small></div>
  <div class="pend"><div><b>${r.pending}</b>pontos em jogo</div><div><b>${rest}</b>mentirosos restantes</div></div>
  ${r.ordem.map(i => { const rv = r.revealed.has(i);
    return `<button class="ans ${rv ? 'fake' : ''}" ${rv ? 'disabled' : ''} onclick="acusar(${i})">
      <div class="n"><span>${nome(i)}</span>${rv ? '<span>❌ MENTIRA!</span>' : ''}</div><div class="r">“${esc(r.answers[i])}”</div></button>`; }).join('')}
  <button class="btn green" ${r.pending ? '' : 'disabled'} onclick="guardar()">🪣 Parar e guardar ${r.pending} ponto(s)</button>
  <small class="sub">Se acusar o Verdadeiro, perde os pontos em jogo!</small>`);
}

function acusar(i) {
  modal(`<div class="big">🎣</div><h3 style="text-align:center">Acusar <b>${nome(i)}</b>?</h3><p style="text-align:center">“${esc(S.r.answers[i])}”</p>`, 'Sim, é mentira!', () => resolver(i), 'Cancelar', 'red');
}

function resolver(i) {
  const r = S.r;
  if (i === r.kipper) {
    r.fim = 'verdade'; r.perdidos = r.pending; r.pending = 0;
    dar(r.kipper, 2);
    r.ordem.filter(j => j !== r.kipper && !r.revealed.has(j)).forEach(j => dar(j, 1));
    SOM.erro(); vib([300, 100, 300]); document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 400);
    telaResultado();
  } else {
    r.revealed.add(i); r.pending++; SOM.ponto(); vib(80); toast('❌ Mentiroso pescado! +1 em jogo');
    if (r.revealed.size === r.ordem.length - 1) { r.fim = 'todos'; dar(r.guesser, r.pending + 2, '(+2 bônus!)'); SOM.vitoria(); telaResultado(); }
    else telaPesca();
  }
}

function guardar() {
  const r = S.r;
  modal(`<div class="big">🪣</div><h3 style="text-align:center">Guardar ${r.pending} ponto(s)?</h3><p style="text-align:center">Os mentirosos que escaparam ganham +1 cada.</p>`, 'Guardar', () => {
    r.fim = 'guardou'; dar(r.guesser, r.pending);
    r.ordem.filter(j => j !== r.kipper && !r.revealed.has(j)).forEach(j => dar(j, 1));
    SOM.ponto(); telaResultado();
  }, 'Continuar pescando', 'green');
}

function vencedores() {
  const max = Math.max(...S.players.map(p => p.score));
  return { max, lista: S.players.filter(p => p.score === max) };
}
function acabou() {
  const { max, lista } = vencedores();
  if (S.desempate) return lista.length === 1;
  if (S.modo === 'meta') return max >= S.meta;
  return S.roundNo + 1 >= total();
}

function telaResultado() {
  const r = S.r, g = nome(r.guesser);
  const T = {
    todos: ['🏆 Pescaria perfeita!', `${g} pescou todos os mentirosos: <b>${r.ganhos[r.guesser]}</b> pontos (com bônus)!`],
    guardou: ['🪣 Pontos guardados!', `${g} guardou <b>${r.ganhos[r.guesser] || 0}</b> ponto(s). Quem escapou ganhou +1.`],
    verdade: ['💥 Fisgou a verdade!', `${g} acusou o Verdadeiro e perdeu <b>${r.perdidos}</b> ponto(s) em jogo. ${nome(r.kipper)} ganhou +2 e quem escapou ganhou +1.`]
  }[r.fim];
  const fim = acabou();
  let aviso = '';
  if (fim) {
    const { lista } = vencedores();
    if (lista.length > 1) { S.desempate = true; aviso = `<div class="glass" style="text-align:center">⚔️ Empate entre ${lista.map(p => esc(p.name)).join(' e ')}! Vamos para o desempate.</div>`; }
  }
  const final = fim && !aviso;
  render(`<div class="card" style="text-align:center"><h2>${T[0]}</h2><p>${T[1]}</p></div>
  <div class="card"><span class="tag">${esc(r.q.cat)}</span><p class="q">${esc(r.q.q)}</p>
    <div class="certa">✅ Verdade: ${esc(r.q.a)}</div>
    ${r.ordem.map(i => { const k = i === r.kipper, p = r.revealed.has(i);
      return `<div class="lr ${k ? 'real' : p ? 'fake' : ''}"><span><b>${nome(i)}:</b> “${esc(r.answers[i])}”</span><span>${k ? '💙' : p ? '❌' : '🐟 escapou'}</span></div>`; }).join('')}</div>
  <div class="card"><h3>📊 Placar</h3><span class="tag">${objetivo()}</span>${placarHTML(r.ganhos)}</div>
  ${aviso}
  <button class="btn" onclick="${final ? 'telaFinal()' : 'proxima()'}">${final ? 'Ver o vencedor 🏆' : 'Próxima rodada ➜'}</button>
  ${final ? '' : '<button class="btn sec" onclick="encerrar()">⏹️ Encerrar o jogo</button>'}`);
}
function proxima() { S.roundNo++; novaRodada(); }

function telaFinal(forcado) {
  const { max, lista } = vencedores();
  S.emJogo = false;
  const ord = [...S.players].sort((a, b) => b.score - a.score);
  const titulo = lista.length === 1 ? `${esc(lista[0].name)} venceu!` : `Empate: ${lista.map(p => esc(p.name)).join(' e ')}!`;
  render(`<div style="text-align:center"><div class="big"><span class="bob">🏆</span></div><h1>${titulo}</h1>
    <p class="sub">com ${max} ponto(s)${forcado ? ' · jogo encerrado' : ''}</p></div>
  <div class="card">${placarHTML()}</div>
  <button class="btn" onclick="iniciar()">🔁 Jogar de novo</button>
  <button class="btn sec" onclick="telaConfig()">⚙️ Novo jogo</button>
  <button class="btn sec" onclick="telaInicio()">🏠 Início</button>`);
  const em = ['🐟', '🎉', '⭐', '🐠', '🎣', '🏆'];
  for (let k = 0; k < 50; k++) { const s = document.createElement('span'); s.className = 'confete'; s.textContent = em[k % 6];
    s.style.left = Math.random() * 100 + 'vw'; s.style.fontSize = 16 + Math.random() * 22 + 'px'; s.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 5500); }
  SOM.vitoria(); vib([100, 50, 100, 50, 300]);
}

addEventListener('beforeunload', e => { if (S.emJogo) { e.preventDefault(); e.returnValue = ''; } });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
telaInicio();
