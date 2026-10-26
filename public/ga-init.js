// Google Analytics (GA4) — KVKK gereği yalnızca ziyaretçi "Analitik çerezler"e izin verdiyse yüklenir.
// Güvenlik politikası (CSP) satır içi betiğe izin vermediği için ayrı dosyadadır.
(function () {
  var ID = 'G-D2F1KZ11MT';
  var loaded = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.akAnalytics = {
    enable: function () {
      window['ga-disable-' + ID] = false;
      if (loaded) return;
      loaded = true;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
      document.head.appendChild(s);
      window.gtag('js', new Date());
      window.gtag('config', ID);
    },
    disable: function () {
      window['ga-disable-' + ID] = true;
      // Analytics çerezlerini sil
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (name === '_ga' || name.indexOf('_ga_') === 0 || name === '_gid') {
          var host = location.hostname;
          document.cookie = name + '=; Max-Age=0; Path=/';
          document.cookie = name + '=; Max-Age=0; Path=/; Domain=' + host;
          document.cookie = name + '=; Max-Age=0; Path=/; Domain=.' + host;
        }
      });
    },
  };
  try {
    var consent = JSON.parse(localStorage.getItem('ak.consent') || 'null');
    if (consent && consent.analytics === true) window.akAnalytics.enable();
  } catch (e) {
    /* depolama kapalı: Analytics yüklenmez */
  }
})();
