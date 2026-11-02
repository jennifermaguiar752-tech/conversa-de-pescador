// ===== Conversa de Pescador — lógica do jogo =====
const app = document.getElementById('app');
const CATS = [...new Set(PERGUNTAS.map(p => p.cat))];

function carregarNomes() {
  try { return JSON.parse(localStorage.getItem('cp_jogadores') || '[]'); } catch { return []; }
}

const S = {
  players: carregarNomes().map(n => ({ name: n, score: 0 })),
  cats: new Set(CATS),
  voltas: 1,
  bonus: true,
  deck: [],
  roundNo: 0,
  totalRounds: 0,
  emJogo: false,
  r: null,
  tmpAvail: [],
  tmpOff: 0
};

// ---------- utilidades ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const vib = p => { if (navigator.vibrate) navigator.vibrate(p); };
const salvarNomes = () => localStorage.setItem('cp_jogadores', JSON.stringify(S.players.map(p => p.name)));
const naoPescadores = () => S.players.map((_, i) => i).filter(i => i !== S.r.guesser);

function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

let modalCb = null;
function modal(html, okLabel, cb, cancelLabel = 'Cancelar', okClass = '') {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="card center">${html}
    <div class="col">
      <button class="btn ${okClass}" onclick="fecharModal(true)">${okLabel}</button>
      ${cancelLabel ? `<button class="btn ghost" onclick="fecharModal(false)">${cancelLabel}</button>` : ''}
    </div></div>`;
  m.classList.remove('hidden'); modalCb = cb;
}
function fecharModal(ok) {
  document.getElementById('modal').classList.add('hidden');
  const cb = modalCb; modalCb = null;
  if (ok && cb) cb();
}

function confete() {
  const emojis = ['🐟', '🎉', '⭐', '🐠', '🎣', '🏆'];
  for (let i = 0; i < 45; i++) {
    const s = document.createElement('span');
    s.className = 'confete';
    s.textContent = emojis[i % emojis.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.fontSize = (16 + Math.random() * 22) + 'px';
    s.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 5500);
  }
}

function placarMini() {
  return `<div class="mini">${S.players.map(p => `<span>${esc(p.name)} <b>${p.score}</b></span>`).join('')}</div>`;
}

function placarHTML(ganhos = {}) {
  const ord = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  return `<div class="card"><h3>📊 Placar</h3>${ord.map(p => {
    const pos = ord.findIndex(x => x.score === p.score) + 1;
    return `<div class="score"><span>${pos}º ${esc(p.name)}</span>
      <span><b>${p.score}</b> ${ganhos[p.i] ? `<span class="ganho">+${ganhos[p.i]}</span>` : ''}</span></div>`;
  }).join('')}</div>`;
}

// ---------- telas ----------
function telaInicio() {
  render(`
  <div class="centro-tela">
    <div class="big">🎣</div>
    <h1>Conversa de Pescador</h1>
    <p class="sub">Descubra quem está mentindo... antes de fisgar a verdade!</p>
    <button class="btn" onclick="telaConfig()">Novo jogo</button>
    <button class="btn sec" onclick="telaRegras()">Como jogar</button>
  </div>`);
}

function telaRegras() {
  render(`
  <h2>📖 Como jogar</h2>
  <div class="card regras">
    <p><b>Objetivo:</b> o 🎣 <b>Pescador</b> precisa descobrir quais respostas são mentira, sem fisgar a verdadeira!</p>
    <p><b>1.</b> A cada rodada, um jogador é o Pescador e fecha os olhos.</p>
    <p><b>2.</b> O app sorteia em segredo um 💙 <b>Peixe Verdadeiro</b>, que recebe a resposta certa. Todos os outros são ❤️ <b>Peixes Mentirosos</b> e inventam respostas falsas.</p>
    <p><b>3.</b> Quem já souber o que dizer toca no próprio nome na lista, vê sua função em segredo e escolhe uma sugestão do app ou escreve a própria resposta.</p>
    <p><b>4.</b> O Pescador abre os olhos, todos leem suas respostas em voz alta e ele começa a acusar quem acha que está mentindo.</p>
    <p><b>5.</b> Cada mentiroso pescado vale <b>+1 ponto</b>. O Pescador pode parar e guardar os pontos quando quiser, mas se acusar o Peixe Verdadeiro, perde tudo da rodada!</p>
    <p><b>6.</b> Todos são Pescador o mesmo número de vezes. Quem tiver mais pontos no fim vence! 🏆</p>
    <p><b>Modo bônus (opcional):</b> se o Pescador acusar o Verdadeiro, o Verdadeiro e os mentirosos que não foram pescados ganham 1 ponto cada.</p>
  </div>
  <button class="btn" onclick="telaConfig()">Bora jogar!</button>
  <button class="btn sec" onclick="telaInicio()">Voltar</button>`);
}

function telaConfig() {
  render(`
  <h2>👥 Jogadores</h2>
  <div class="card">
    <div class="row">
      <input id="nome" type="text" placeholder="Nome do jogador" maxlength="16"
        onkeydown="if(event.key==='Enter')addJogador()">
      <button class="btn" style="width:auto;padding:0 20px" onclick="addJogador()">+</button>
    </div>
    <ul class="plist" id="plist"></ul>
    <small id="pmsg"></small>
  </div>
  <h2>📚 Categorias</h2>
  <div class="card"><div class="chips" id="chips"></div></div>
  <h2>⚙️ Opções</h2>
  <div class="card">
    <b>Quantas vezes cada um será o Pescador?</b>
    <div class="chips" id="voltas" style="margin-top:8px"></div>
    <label class="check">
      <input type="checkbox" ${S.bonus ? 'checked' : ''} onchange="S.bonus=this.checked">
      <span><b>Modo bônus:</b> se o Pescador fisgar a verdade, o Verdadeiro e os mentirosos não pescados ganham +1.</span>
    </label>
  </div>
  <button class="btn" id="btnStart" onclick="iniciarJogo()">Começar 🎣</button>
  <button class="btn sec" onclick="telaInicio()">Voltar</button>`);
  desenharConfig();
}

function desenharConfig() {
  document.getElementById('plist').innerHTML = S.players.map((p, i) =>
    `<li><span>🐟 ${esc(p.name)}</span><button class="x" onclick="remJogador(${i})">✕</button></li>`).join('');
  const faltam = 4 - S.players.length;
  document.getElementById('pmsg').textContent = faltam > 0
    ? `Adicione mais ${faltam} jogador(es). O mínimo é 4.`
    : `${S.players.length} jogadores prontos!`;
  document.getElementById('chips').innerHTML = CATS.map((c, k) =>
    `<button class="chip ${S.cats.has(c) ? 'on' : ''}" onclick="togCat(${k})">${c} (${PERGUNTAS.filter(p => p.cat === c).length})</button>`).join('');
  document.getElementById('voltas').innerHTML = [1, 2, 3].map(n =>
    `<button class="chip ${S.voltas === n ? 'on' : ''}" onclick="S.voltas=${n};desenharConfig()">${n}x</button>`).join('');
  document.getElementById('btnStart').disabled = S.players.length < 4 || S.cats.size === 0;
}

function addJogador() {
  const inp = document.getElementById('nome');
  const n = inp.value.trim();
  if (!n) return;
  if (S.players.some(p => norm(p.name) === norm(n))) return toast('Esse nome já está na lista!');
  if (S.players.length >= 12) return toast('Máximo de 12 jogadores.');
  S.players.push({ name: n, score: 0 });
  inp.value = ''; inp.focus();
  salvarNomes(); desenharConfig();
}
function remJogador(i) { S.players.splice(i, 1); salvarNomes(); desenharConfig(); }
function togCat(k) { const c = CATS[k]; S.cats.has(c) ? S.cats.delete(c) : S.cats.add(c); desenharConfig(); }

// ---------- fluxo do jogo ----------
function iniciarJogo() {
  S.players.forEach(p => p.score = 0);
  S.deck = shuffle(PERGUNTAS.filter(p => S.cats.has(p.cat)));
  S.roundNo = 0;
  S.totalRounds = S.players.length * S.voltas;
  S.emJogo = true;
  salvarNomes();
  novaRodada();
}

function pegarPergunta() {
  if (!S.deck.length) S.deck = shuffle(PERGUNTAS.filter(p => S.cats.has(p.cat)));
  return S.deck.pop();
}

function novaRodada() {
  S.r = {
    guesser: S.roundNo % S.players.length,
    kipper: null,
    q: pegarPergunta(),
    answers: {},
    ready: new Set(),
    revealed: new Set(),
    pending: 0,
    perdidos: 0,
    ordem: [],
    ganhos: {},
    fim: null
  };
  telaVez();
}

function telaVez() {
  const g = esc(S.players[S.r.guesser].name);
  render(`
  ${placarMini()}
  <div class="card center">
    <span class="tag">Rodada ${S.roundNo + 1} de ${S.totalRounds}</span>
    <div class="big">🎣</div>
    <h2>${g} é o Pescador!</h2>
    <p><b>${g}</b>, feche os olhos ou vire de costas. 🙈</p>
    <p>Os outros jogadores: toquem no botão para sortear as funções secretas.</p>
  </div>
  <button class="btn" onclick="sortear()">🎲 Sortear funções</button>`);
}

function sortear() {
  const outros = naoPescadores();
  S.r.kipper = outros[Math.floor(Math.random() * outros.length)];
  vib(60);
  telaLista();
}

function telaLista() {
  const r = S.r;
  const outros = naoPescadores();
  const prontos = r.ready.size;
  render(`
  <div class="card">
    <span class="tag">${esc(r.q.cat)}</span>
    <p class="q">${esc(r.q.q)}</p>
    <small>🙈 ${esc(S.players[r.guesser].name)} não pode olhar!</small>
  </div>
  <h2>🐟 Quem já sabe o que dizer? (${prontos}/${outros.length})</h2>
  <p class="sub" style="text-align:left">Pensou na sua resposta? Toque no seu nome. Dá para tocar de novo para mudar.</p>
  ${outros.map(i => `
    <button class="status ${r.ready.has(i) ? 'ok' : ''}" onclick="abrirJogador(${i})">
      <span>${esc(S.players[i].name)}</span>
      <span>${r.ready.has(i) ? '✅ Pronto' : '🤔 Pensando...'}</span>
    </button>`).join('')}
  <button class="btn green" ${prontos < outros.length ? 'disabled' : ''} onclick="telaChamar()">Todos prontos! Chamar o Pescador</button>`);
}

function abrirJogador(i) {
  const n = esc(S.players[i].name);
  modal(`<div class="big">🤫</div><h3>Passe o celular para <b>${n}</b></h3><p>Só ${n} pode ver a próxima tela!</p>`,
    `Sou ${n}, mostrar`, () => telaSecreta(i));
}

function telaSecreta(i) {
  const r = S.r, n = esc(S.players[i].name);

  if (i === r.kipper) {
    render(`
    <div class="card center papel azul">
      <div class="big">💙🐟</div>
      <h2>${n}, você é o<br>PEIXE VERDADEIRO!</h2>
      <p>Pergunta:</p>
      <p class="q">${esc(r.q.q)}</p>
      <p>Sua resposta é a <b>verdadeira</b>:</p>
      <div class="resposta-certa grande">${esc(r.q.a)}</div>
      <p><small>Diga exatamente isso. Fazer cara de mentiroso é permitido 😏</small></p>
    </div>
    <button class="btn blue" onclick="confirmarVerdade(${i})">Entendi! Esconder ✅</button>`);
    return;
  }

  const usadas = new Set(Object.entries(r.answers).filter(([j]) => Number(j) !== i).map(([, v]) => norm(v)));
  S.tmpAvail = shuffle(r.q.f.filter(f => !usadas.has(norm(f))));
  S.tmpOff = 0;
  const atual = r.answers[i] || '';

  render(`
  <div class="card papel vermelho">
    <div class="center"><div class="big">❤️🐟</div><h2>${n}, você é um<br>PEIXE MENTIROSO!</h2></div>
    <p>Invente uma resposta falsa (e convincente!) para:</p>
    <p class="q">${esc(r.q.q)}</p>
  </div>
  <div class="card">
    <b>💡 Escolha uma sugestão:</b>
    <div id="opts" style="margin-top:8px"></div>
    <b>✍️ ...ou escreva (ou edite) a sua:</b>
    <input id="minha" type="text" maxlength="70" placeholder="Sua resposta falsa"
      value="${esc(atual)}" oninput="digitou()" style="width:100%;margin-top:8px">
  </div>
  <button class="btn" id="btnConf" ${atual ? '' : 'disabled'} onclick="confirmarMentira(${i})">Confirmar resposta ✅</button>
  <button class="btn sec" onclick="telaLista()">Voltar</button>`);
  desenharOpts();
}

function desenharOpts() {
  const box = document.getElementById('opts');
  const av = S.tmpAvail;
  if (!av.length) { box.innerHTML = '<p><small>Acabaram as sugestões. Use a criatividade! 😉</small></p>'; return; }
  const vis = [];
  for (let k = 0; k < Math.min(3, av.length); k++) vis.push((S.tmpOff + k) % av.length);
  const val = norm(document.getElementById('minha').value);
  box.innerHTML = vis.map(k =>
    `<button class="opt ${norm(av[k]) === val ? 'sel' : ''}" onclick="escolher(${k})">${esc(av[k])}</button>`).join('')
    + (av.length > 3 ? `<button class="link" onclick="S.tmpOff=(S.tmpOff+3)%S.tmpAvail.length;desenharOpts()">🔄 Ver outras sugestões</button>` : '');
}

function escolher(k) { document.getElementById('minha').value = S.tmpAvail[k]; digitou(); }
function digitou() {
  document.getElementById('btnConf').disabled = !document.getElementById('minha').value.trim();
  desenharOpts();
}

function confirmarMentira(i) {
  const r = S.r;
  const v = document.getElementById('minha').value.trim().replace(/\s+/g, ' ');
  if (!v) return;
  if (norm(v) === norm(r.q.a)) return toast('Ops! Essa é justamente a resposta verdadeira 😅 Invente outra.');
  if (Object.entries(r.answers).some(([j, a]) => Number(j) !== i && norm(a) === norm(v)))
    return toast('Outro jogador já usou essa resposta. Escolha outra!');
  r.answers[i] = v; r.ready.add(i);
  vib(40); telaLista(); toast('Resposta guardada! 🤐');
}

function confirmarVerdade(i) {
  const r = S.r;
  r.answers[i] = r.q.a; r.ready.add(i);
  vib(40); telaLista(); toast('Pronto! 🤐');
}

function telaChamar() {
  const r = S.r;
  r.ordem = shuffle(naoPescadores());
  render(`
  <div class="centro-tela">
    <div class="big">👀</div>
    <h2 class="center">${esc(S.players[r.guesser].name)}, pode abrir os olhos!</h2>
    <p class="sub">Todo mundo já tem sua resposta. Hora da pescaria!</p>
    <button class="btn" onclick="telaPesca()">🎣 Começar a pescaria</button>
  </div>`);
}

function telaPesca() {
  const r = S.r, g = esc(S.players[r.guesser].name);
  const restantes = r.ordem.length - 1 - r.revealed.size;
  render(`
  <div class="card">
    <span class="tag">${esc(r.q.cat)}</span>
    <p class="q">${esc(r.q.q)}</p>
    <small>🗣️ Cada um lê sua resposta em voz alta. ${g}, toque em quem você acha que está <b>mentindo</b>.</small>
  </div>
  <div class="pend">🐟 Pontos em jogo: <b>${r.pending}</b> · Mentirosos restantes: <b>${restantes}</b></div>
  ${r.ordem.map(i => {
    const rev = r.revealed.has(i);
    return `<button class="ans ${rev ? 'fake' : ''}" ${rev ? 'disabled' : ''} onclick="acusar(${i})">
      <div class="nome"><span>${esc(S.players[i].name)}</span>${rev ? '<span class="selo">❌ MENTIRA! +1</span>' : ''}</div>
      <div class="resp">“${esc(r.answers[i])}”</div>
    </button>`;
  }).join('')}
  <button class="btn green" ${r.pending ? '' : 'disabled'} onclick="guardar()">🪣 Parar e guardar ${r.pending} ponto(s)</button>`);
}

function acusar(i) {
  modal(`<div class="big">🎣</div><h3>Acusar <b>${esc(S.players[i].name)}</b> de mentir?</h3><p>“${esc(S.r.answers[i])}”</p>`,
    'Sim, é mentira!', () => resolver(i), 'Cancelar', 'red');
}

function resolver(i) {
  const r = S.r;
  if (i === r.kipper) {
    r.fim = 'verdade'; r.perdidos = r.pending; r.pending = 0; r.ganhos = {};
    if (S.bonus) {
      const premiados = [r.kipper, ...r.ordem.filter(j => j !== r.kipper && !r.revealed.has(j))];
      premiados.forEach(j => { S.players[j].score++; r.ganhos[j] = 1; });
    }
    vib([300, 100, 300]);
    telaResultado();
  } else {
    r.revealed.add(i); r.pending++; vib(80);
    if (r.revealed.size === r.ordem.length - 1) {
      r.fim = 'todos';
      S.players[r.guesser].score += r.pending;
      r.ganhos = { [r.guesser]: r.pending };
      telaResultado();
    } else telaPesca();
  }
}

function guardar() {
  const r = S.r;
  if (!r.pending) return;
  modal(`<div class="big">🪣</div><h3>Parar e guardar ${r.pending} ponto(s)?</h3>`, 'Guardar', () => {
    r.fim = 'guardou';
    S.players[r.guesser].score += r.pending;
    r.ganhos = { [r.guesser]: r.pending };
    telaResultado();
  }, 'Continuar pescando', 'green');
}

function telaResultado() {
  const r = S.r, g = esc(S.players[r.guesser].name);
  let titulo, texto;
  if (r.fim === 'todos') { titulo = '🏆 Pescaria perfeita!'; texto = `${g} pescou todos os mentirosos e ganhou <b>${r.pending}</b> ponto(s)!`; }
  else if (r.fim === 'guardou') { titulo = '🪣 Pontos guardados!'; texto = `${g} parou na hora certa e guardou <b>${r.pending}</b> ponto(s).`; }
  else {
    titulo = '💥 Fisgou a verdade!';
    texto = `${g} acusou o Peixe Verdadeiro e perdeu <b>${r.perdidos}</b> ponto(s) da rodada.`
      + (S.bonus ? '<br>O Verdadeiro e os mentirosos que escaparam ganham +1!' : '');
  }
  const ultima = S.roundNo + 1 >= S.totalRounds;
  render(`
  <div class="card center"><h2>${titulo}</h2><p>${texto}</p></div>
  <div class="card">
    <span class="tag">${esc(r.q.cat)}</span>
    <p class="q">${esc(r.q.q)}</p>
    <div class="resposta-certa">✅ Resposta verdadeira: <b>${esc(r.q.a)}</b></div>
    ${r.ordem.map(i => {
      const k = i === r.kipper, pesc = r.revealed.has(i);
      const selo = k ? '💙 Verdadeiro' : (pesc ? '❌ Pescado' : '🐟 Escapou');
      return `<div class="linha-resp ${k ? 'real' : (pesc ? 'fake' : '')}">
        <span><b>${esc(S.players[i].name)}</b>: “${esc(r.answers[i])}”</span><span class="selo">${selo}</span></div>`;
    }).join('')}
  </div>
  ${placarHTML(r.ganhos)}
  <button class="btn" onclick="${ultima ? 'telaFinal()' : 'proxima()'}">${ultima ? 'Ver o vencedor 🏆' : 'Próxima rodada ➜'}</button>
  ${ultima ? '' : '<button class="btn sec" onclick="encerrar()">Encerrar o jogo agora</button>'}`);
}

function proxima() { S.roundNo++; novaRodada(); }

function encerrar() {
  modal('<h3>Encerrar o jogo e ver o vencedor?</h3>', 'Encerrar', telaFinal, 'Continuar jogando', 'red');
}

function telaFinal() {
  S.emJogo = false;
  const ord = [...S.players].sort((a, b) => b.score - a.score);
  const max = ord[0].score;
  const vencedores = ord.filter(p => p.score === max);
  const medalhas = ['🥇', '🥈', '🥉'];
  const titulo = vencedores.length === 1
    ? `${esc(vencedores[0].name)} venceu!`
    : `Empate entre ${vencedores.map(p => esc(p.name)).join(' e ')}!`;
  render(`
  <div class="center"><div class="big">🏆</div><h1>${titulo}</h1><p class="sub">com ${max} ponto(s)</p></div>
  <div class="card">${ord.map(p => {
    const pos = ord.findIndex(x => x.score === p.score);
    return `<div class="score ${p.score === max ? 'win' : ''}"><span>${medalhas[pos] || (pos + 1) + 'º'} ${esc(p.name)}</span><b>${p.score}</b></div>`;
  }).join('')}</div>
  <button class="btn" onclick="iniciarJogo()">🔁 Jogar de novo (mesmos jogadores)</button>
  <button class="btn sec" onclick="telaConfig()">Novo jogo</button>`);
  confete(); vib([100, 50, 100, 50, 200]);
}

// ---------- PWA ----------
window.addEventListener('beforeunload', e => { if (S.emJogo) { e.preventDefault(); e.returnValue = ''; } });
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

telaInicio();
