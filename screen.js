// Página do player. Hospede em um endereço https:// (Config.PlayerUrl).
// Funciona no painel (com ?controls=1) e na TV via DUI (sem controles).
(function () {
  'use strict';
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  const params = new URLSearchParams(location.search);
  const showControls = params.get('controls') === '1';
  const wait = document.getElementById('wait');
  const inFrame = window.parent && window.parent !== window;

  let player = null, ready = false, pending = null, lastId = null, lastVersion = -1;

  function toParent(payload) {
    if (inFrame) window.parent.postMessage(Object.assign({ source: 'fury_tv_player' }, payload), '*');
  }

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      width: '100%', height: '100%',
      playerVars: {
        autoplay: 1, controls: showControls ? 1 : 0, rel: 0, modestbranding: 1,
        playsinline: 1, fs: showControls ? 1 : 0, disablekb: showControls ? 0 : 1,
        origin: location.origin
      },
      events: {
        onReady: () => { ready = true; if (pending) apply(pending); },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) wait.classList.add('hidden');
          if (e.data === YT.PlayerState.ENDED && lastId) toParent({ event: 'ended', videoId: lastId });
        },
        onError: (e) => {
          wait.textContent = 'Vídeo indisponível';
          wait.classList.remove('hidden');
          toParent({ event: 'error', code: e.data, videoId: lastId });
        }
      }
    });
  };

  function apply(s) {
    if (!ready) { pending = s; return; }
    const hasVideo = !!s.videoId && ID_RE.test(s.videoId);
    if (!hasVideo) {
      if (lastId) { player.stopVideo(); lastId = null; }
      wait.textContent = 'FURY TV';
      wait.classList.remove('hidden');
      return;
    }
    if (s.videoId !== lastId) {
      lastId = s.videoId;
      wait.classList.remove('hidden');
      wait.textContent = 'Carregando...';
      player.loadVideoById({ videoId: s.videoId, startSeconds: s.position || 0 });
    }
    if (typeof player.setVolume === 'function') player.setVolume(Number(s.volume) || 0);
    if (s.playing) player.playVideo(); else player.pauseVideo();
    if (s.playing && typeof player.getCurrentTime === 'function') {
      if (Math.abs(player.getCurrentTime() - (s.position || 0)) > 2) player.seekTo(s.position || 0, true);
    }
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || typeof d !== 'object' || d.source !== 'fury_tv_nui') return;
    if (d.action === 'clear') {
      pending = null; lastVersion = -1;
      if (ready && lastId) { player.stopVideo(); lastId = null; }
      wait.textContent = 'FURY TV'; wait.classList.remove('hidden');
      return;
    }
    if (d.action === 'state' && d.state) {
      if (d.state.version <= lastVersion) return;
      lastVersion = d.state.version;
      apply(d.state);
    }
  });
})();
