// index.js - OpenWA + PandaScore (CS2 monitor com seleção e notificações individuais)
require('dotenv').config();
const { create } = require('@open-wa/wa-automate');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------
const CHROME_PATH = process.env.CHROME_PATH || '';
const HEADLESS = String(process.env.HEADLESS || 'false') === 'true';
const PANDASCORE_KEY = process.env.PANDASCORE_KEY;
const AUTO_REFRESH_INTERVAL = parseInt(process.env.AUTO_REFRESH_INTERVAL || '60');
const SESSION_DIR = path.join(__dirname, 'session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);

// ---------- FUNÇÕES AUX ----------
function safeDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function compactTeam(name) {
  if (!name) return '';
  return name.length > 18 ? name.slice(0, 16) + '…' : name;
}

// ---------- API ----------
async function fetchMatches() {
  if (!PANDASCORE_KEY) return [];
  const endpoints = [
    'https://api.pandascore.co/matches/running',
    'https://api.pandascore.co/matches/upcoming',
    'https://api.pandascore.co/matches/past'
  ];
  let out = [];
  for (const url of endpoints) {
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${PANDASCORE_KEY}` },
        timeout: 10000
      });
      if (Array.isArray(res.data)) out.push(...res.data);
    } catch (e) {
      console.warn('[PANDASCORE] erro:', e.response?.status || e.message);
    }
  }
  return out.filter(m => (m.videogame?.name || '').toLowerCase().includes('counter'));
}

async function fetchMatchRounds(matchId) {
  try {
    const res = await axios.get(`https://api.pandascore.co/matches/${matchId}/games`, {
      headers: { Authorization: `Bearer ${PANDASCORE_KEY}` },
      timeout: 10000
    });
    if (!Array.isArray(res.data) || !res.data.length) return null;
    const g = res.data.find(x => x.status === 'running' || x.status === 'live') || res.data.at(-1);
    if (!g?.opponents?.length) return null;
    const map = g.map?.name || 'Mapa';
    const r1 = g.opponents[0]?.score ?? 0;
    const r2 = g.opponents[1]?.score ?? 0;
    return { map, r1, r2 };
  } catch {
    return null;
  }
}

// ---------- FORMATADOR ----------
function formatMatches(matches, tipoKey) {
  const map = {
    'AO_VIVO': { emoji: '🔴', title: 'AO VIVO' },
    'AGENDADAS': { emoji: '🟡', title: 'AGENDADAS' },
    'ENCERRADAS': { emoji: '⚪', title: 'ENCERRADAS' }
  };
  const meta = map[tipoKey] || { emoji: '📌', title: tipoKey };

  if (!matches.length) return `${meta.emoji} *${meta.title}*: nenhuma partida.`;

  return `${meta.emoji} *${meta.title}* (${matches.length})\n\n` + matches.map((m, i) => {
    const t1 = compactTeam(m.opponents?.[0]?.opponent?.name || 'Time A');
    const t2 = compactTeam(m.opponents?.[1]?.opponent?.name || 'Time B');
    const s1 = m.results?.[0]?.score ?? 0;
    const s2 = m.results?.[1]?.score ?? 0;
    const bo = m.number_of_maps ? ` • BO${m.number_of_maps}` : '';
    const event = m.tournament?.name || m.league?.name || 'Evento';
    const hora = safeDate(m.begin_at)?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '??:??';
    return `${i + 1}. *${t1}* [${s1}] x [${s2}] *${t2}*\n   🏟️ ${event} • 🕒 ${hora}${bo}`;
  }).join('\n\n');
}

// ---------- BOT ----------
async function start() {
  const opts = {
    sessionId: 'hltv-openwa-session',
    multiDevice: true,
    disableSpins: true,
    headless: HEADLESS,
    sessionDataPath: SESSION_DIR,
    qrTimeout: 0,
    authTimeout: 0,
    killProcessOnBrowserClose: false,
    useChrome: fs.existsSync(CHROME_PATH),
    executablePath: CHROME_PATH
  };

  console.log('🚀 Iniciando bot CS2...');
  const client = await create(opts);
  console.log('✅ WhatsApp conectado!');

  const userState = {}; // controle do menu
  const userSubscriptions = {}; // { from: matchId }
  const lastScores = {}; // cache dos placares

  client.onAnyMessage(async (msg) => {
    if (msg.fromMe || msg.isGroupMsg) return;
    const from = msg.from;
    const body = msg.body.trim().toLowerCase();
    console.log(`[MSG] ${from}: ${body}`);

    if (body === 'menu' || body === 'jogos' || body === 'cs2') {
      userState[from] = 'menu';
      await client.sendText(from,
        '🎮 *Menu CS2*\n\n' +
        '1️⃣ AO VIVO\n' +
        '2️⃣ PRÓXIMOS\n' +
        '3️⃣ RESULTADOS\n\n' +
        'Envie o número desejado ou *sair*.'
      );
      return;
    }

    // Cancelar alertas
    if (body === 'parar' || body === '🔕' || body === 'cancelar') {
      if (userSubscriptions[from]) {
        delete userSubscriptions[from];
        await client.sendText(from, '🔕 Notificações automáticas desativadas.');
      } else {
        await client.sendText(from, 'ℹ️ Você não está inscrito em nenhuma partida.');
      }
      return;
    }

    // Menu de seleção
    if (userState[from] === 'menu') {
      if (body === '1') {
        await client.sendText(from, '🔍 Buscando partidas *AO VIVO*...');
        const all = await fetchMatches();
        const running = all.filter(m => m.status === 'running');
        if (!running.length) {
          await client.sendText(from, '⚪ Nenhuma partida ao vivo no momento.');
          delete userState[from];
          return;
        }
        userState[from] = { mode: 'select_match', list: running };
        const listText = formatMatches(running, 'AO_VIVO') + '\n\n📲 Envie o número da partida para receber alertas.';
        await client.sendText(from, listText);
        return;
      }

      if (body === '2') {
        const all = await fetchMatches();
        const up = all.filter(m => ['not_started', 'upcoming'].includes(m.status));
        await client.sendText(from, formatMatches(up, 'AGENDADAS'));
        delete userState[from];
        return;
      }

      if (body === '3') {
        const all = await fetchMatches();
        const done = all.filter(m => m.status === 'finished');
        await client.sendText(from, formatMatches(done, 'ENCERRADAS'));
        delete userState[from];
        return;
      }

      if (body === 'sair') {
        delete userState[from];
        await client.sendText(from, '👋 Saindo. Envie *jogos* para abrir o menu novamente.');
        return;
      }

      await client.sendText(from, '❌ Opção inválida.');
      return;
    }

    // Seleção de partida ao vivo
    if (userState[from]?.mode === 'select_match') {
      const list = userState[from].list;
      const idx = parseInt(body);
      if (isNaN(idx) || idx < 1 || idx > list.length) {
        await client.sendText(from, '❌ Número inválido. Envie um número da lista.');
        return;
      }
      const match = list[idx - 1];
      userSubscriptions[from] = match.id;
      delete userState[from];
      await client.sendText(from, `✅ Você agora receberá atualizações de *${match.opponents[0]?.opponent?.name} vs ${match.opponents[1]?.opponent?.name}*.\nEnvie *parar* para cancelar.`);
      return;
    }

    // Padrão
    if (!userState[from]) {
      await client.sendText(from, '🤖 Bot CS2 ativo! Envie *jogos* para abrir o menu.');
    }
  });

  // ---------- LOOP DE ATUALIZAÇÃO ----------
  setInterval(async () => {
    try {
      const matches = await fetchMatches();
      const running = matches.filter(m => m.status === 'running');

      for (const from in userSubscriptions) {
        const matchId = userSubscriptions[from];
        const match = running.find(x => x.id === matchId);
        if (!match) continue;

        const t1 = match.opponents?.[0]?.opponent?.name || 'Time A';
        const t2 = match.opponents?.[1]?.opponent?.name || 'Time B';
        const s1 = match.results?.[0]?.score ?? 0;
        const s2 = match.results?.[1]?.score ?? 0;

        const rounds = await fetchMatchRounds(match.id);
        const roundTxt = rounds ? `🧨 ${rounds.map}: ${rounds.r1}x${rounds.r2}` : '';
        const newScore = `${s1}-${s2}-${roundTxt}`;

        if (lastScores[from] !== newScore) {
          lastScores[from] = newScore;
          const msgText =
            `⚡ *Atualização AO VIVO!*\n\n🔴 *${t1}* [${s1}] x [${s2}] *${t2}*\n${roundTxt}\n🏟️ ${match.tournament?.name || ''}`;
          await client.sendText(from, msgText);
        }
      }
    } catch (err) {
      console.warn('[AutoUpdate]', err.message);
    }
  }, AUTO_REFRESH_INTERVAL * 1000);
}

start().catch(e => {
  console.error('❌ Erro fatal:', e.message);
  process.exit(1);
});
