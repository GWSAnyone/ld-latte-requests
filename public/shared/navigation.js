(() => {
  const base = new URL('../', document.currentScript.src);
  const countKey = 'ld-latte-request-count';
  const grid = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>';

  class Navigation extends HTMLElement {
    static observedAttributes = ['section', 'count'];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = `
        <style>
          :host { display: block; width: 100%; flex-shrink: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; line-height: normal; font-weight: 400; letter-spacing: normal; color: #f9f0e5; text-rendering: optimizeLegibility; font-synthesis: none; }
          * { box-sizing: border-box; }
          .brand { display: flex; align-items: center; gap: 11px; padding: 0 7px; font-size: 18px; font-weight: 600; letter-spacing: .08em; white-space: nowrap; }
          .mark { display: grid; place-items: center; width: 33px; height: 38px; flex-shrink: 0; border-radius: 11px; background: #f7ebdd; color: #493126; font-size: 23px; font-weight: 500; letter-spacing: 0; }
          .name { display: block; }
          .mobile-title { display: none; }
          small { display: block; font-size: 11px; font-weight: 400; color: #e3cdb9; letter-spacing: .015em; margin-top: 6px; }
          .label { font-size: 11px; color: #dcc2ab; letter-spacing: .12em; padding: 0 14px; margin: 49px 0 17px; }
          nav { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
          a { display: flex; align-items: center; gap: 12px; min-height: 47px; padding: 13px 15px; border: 1px solid #644a37; border-radius: 8px; color: #e7d3be; text-decoration: none; font-size: 14px; font-weight: 500; }
          a:hover { background: #4a3528; }
          a[aria-current] { background: #f1e5d6; color: #382b25; border-color: #f1e5d6; }
          a:focus-visible { outline: 3px solid #b68762; outline-offset: 4px; }
          svg { width: 17px; height: 17px; flex-shrink: 0; }
          .count { display: inline-flex; align-items: center; justify-content: center; margin-left: auto; min-width: 20px; padding: 3px 7px; border-radius: 5px; font-size: 12px; background: #ddcbb7; color: #382b25; }
          [hidden] { display: none; }
          @media (max-width: 900px) {
            .brand { padding: 0 52px 0 0; min-height: 40px; gap: 9px; font-size: 16px; }
            .mark { width: 30px; height: 32px; border-radius: 8px; font-size: 21px; }
            small, .label { display: none; }
            nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 6px 0 0; }
            a { min-width: 0; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 10px 8px; min-height: 44px; font-size: 13px; line-height: 1.4; border-radius: 7px; white-space: normal; overflow-wrap: anywhere; text-align: center; }
            .title { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
            .mobile-title { display: inline; min-width: 0; }
            nav svg { display: none; }
            .count { margin-left: 0; min-width: 18px; padding: 2px 5px; font-size: 11px; }
          }
        </style>
        <div class="brand"><span class="mark" aria-hidden="true">L</span><div><span class="name">LD LATTE</span><small>Автоматизация процессов</small></div></div>
        <div class="label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Разделы системы">
          <a data-section="requests" href="${base.href}">${grid}<span class="title">Мои заявки</span><span class="mobile-title" aria-hidden="true">Заявки</span><span class="count" hidden></span></a>
          <a data-section="instagram" href="${new URL('instagram/', base).href}">${grid}<span class="title">Статистика Instagram</span><span class="mobile-title" aria-hidden="true">Instagram</span></a>
        </nav>`;
    }

    connectedCallback() { this.update(); }
    attributeChangedCallback() { this.update(); }

    update() {
      const count = this.getAttribute('count');
      let saved = null;
      try {
        if (count !== null) sessionStorage.setItem(countKey, count);
        saved = sessionStorage.getItem(countKey);
      } catch { /* Navigation still works when browser storage is blocked. */ }
      const badge = this.shadowRoot.querySelector('.count');
      const value = count ?? saved;
      badge.hidden = value === null || !/^\d+$/.test(value);
      badge.textContent = badge.hidden ? '' : value;
      this.shadowRoot.querySelectorAll('a').forEach(link => {
        if (link.dataset.section === this.getAttribute('section')) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }
  }

  customElements.define('ld-navigation', Navigation);
})();
